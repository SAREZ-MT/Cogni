# pdf-import Specification

## Purpose

Segunda puerta de entrada de contenido de Cogni (documento maestro §3.1, §3.2, §13 Fase 2): un PDF con capa de texto se convierte en una página editable de un cuaderno. Cubre el bucket privado `page-pdfs` con RLS por propietario, el permiso de subida firmado con revalidación server-side, la entidad `ImportJob` y su ciclo de vida, el procesamiento en segundo plano (§8.1 regla 5: las Server Actions solo encolan y consultan), la extracción de texto página por página, la heurística texto→bloques (decisión de producto 5), la importación parcial y la detección de PDF sin capa de texto (decisión 6, sin OCR según documento maestro líneas 34 y 89), la consulta de estado para el progreso en la interfaz, la autorización por propiedad, la idempotencia frente a reintentos y el presupuesto de 60 segundos para un PDF de 30 páginas. Módulo hexagonal `src/modules/ingestion`, con la misma forma que `notebooks`. Las decisiones de producto 1 a 6 de la propuesta están cerradas; esta spec las fija como comportamiento verificable.

## Requirements

### Requirement: Bucket privado `page-pdfs` con RLS por propietario y límites

MUST existir un bucket privado de Supabase Storage dedicado a PDFs, independiente del bucket de imágenes de `page-assets`, cuyo nombre se lee de la variable de entorno servidor `SUPABASE_PDF_BUCKET`. Todo objeto MUST almacenarse bajo una ruta cuyo primer segmento es el `ownerId` del usuario que sube el archivo y cuyo nombre de objeto asigna el servidor (identificador único generado en el servidor, con extensión `.pdf`); el cliente MUST NOT elegir la ruta. Las políticas RLS del bucket MUST permitir leer, escribir y borrar un objeto solo cuando el primer segmento de su ruta coincide con `auth.uid()`. MUST NOT existir acceso público ni anónimo. El bucket MUST configurarse con `file_size_limit` de 20 971 520 bytes (20 MiB) y `allowed_mime_types` limitado a `application/pdf`, de modo que Storage rechace bytes que no cumplan esos límites incluso con un permiso firmado válido. La migración que crea el bucket y sus políticas MUST entregarse con su migración de reversión y MUST NOT modificar el bucket de `page-assets`.

#### Scenario: Migración del bucket aplicada y revertida (db smoke)

- GIVEN una base de datos con las migraciones de la fase 1
- WHEN se aplica la migración del bucket de PDFs y luego su reversión
- THEN tras aplicarla existe el bucket con `file_size_limit` 20 971 520 y `allowed_mime_types` igual a `["application/pdf"]`, y tras revertirla el bucket y sus políticas dejan de existir mientras `page-assets` queda intacto

#### Scenario: Subida que excede el límite del bucket rechazada (e2e)

- GIVEN un permiso firmado emitido para `application/pdf` de 2 MB
- WHEN el navegador sube un objeto de 21 MB o un objeto con content type `image/png`
- THEN Storage rechaza la subida y no existe el objeto

#### Scenario: Lectura entre usuarios denegada (e2e)

- GIVEN un PDF subido por el primer usuario
- WHEN el segundo usuario solicita el objeto o su listado con su propia sesión de Storage
- THEN Storage responde con denegación y no entrega bytes

#### Scenario: Acceso anónimo denegado (e2e)

- GIVEN la ruta de un PDF existente
- WHEN se solicita sin sesión
- THEN Storage responde con denegación

### Requirement: Permiso de subida firmado con límites del servidor

El caso de uso `RequestPdfUpload` MUST recibir `ownerId`, `notebookId`, `fileName`, `mime` y `sizeBytes`, verificar que el cuaderno está activo y pertenece al owner, verificar que `mime` es exactamente `application/pdf`, que `sizeBytes` es mayor que 0 y no supera 20 971 520 bytes y que `fileName` no está vacío tras recortar espacios y no supera 255 caracteres, y devolver un permiso de subida firmado hacia la ruta canónica del objeto con vigencia máxima de 10 minutos. Cualquier verificación fallida MUST devolver un `DomainError` sin contactar a Storage. Este es el primer nivel de rechazo en el servidor, sobre metadatos declarados por el cliente; los límites del bucket sobre los bytes reales son el segundo nivel y la revalidación al encolar es el tercero.

#### Scenario: Permiso emitido (unit)

- GIVEN un cuaderno activo del usuario
- WHEN invoca `RequestPdfUpload` con `application/pdf`, 2 MB y `fileName` "apuntes.pdf"
- THEN recibe un permiso firmado hacia una ruta cuyo primer segmento es su `ownerId`, con extensión `.pdf` y expiración de 10 minutos o menos

#### Scenario: MIME no permitido (unit)

- GIVEN una solicitud con `mime` `application/octet-stream` o `image/png`
- WHEN se invoca `RequestPdfUpload`
- THEN el caso de uso devuelve un `DomainError` y no contacta a Storage

#### Scenario: Tamaño excedido o nulo (unit)

- GIVEN una solicitud de 20 971 521 bytes o de 0 bytes
- WHEN se invoca `RequestPdfUpload`
- THEN el caso de uso devuelve un `DomainError` y no contacta a Storage

#### Scenario: Cuaderno ajeno o archivado (unit)

- GIVEN un `notebookId` de otro usuario o con `archived_at` definido
- WHEN se invoca `RequestPdfUpload`
- THEN el caso de uso devuelve un `DomainError` sin revelar si el cuaderno existe

### Requirement: Validación en el cliente antes de solicitar el permiso

Antes de solicitar un permiso de subida, la interfaz MUST verificar en el navegador que el archivo elegido tiene tipo `application/pdf` (por content type o por extensión `.pdf` cuando el navegador no informa el tipo) y que no supera 20 971 520 bytes, y MUST rechazar con un mensaje en español con "tú" sin enviar ningún byte ni invocar ninguna Server Action. El selector de archivos MUST aceptar un único archivo por importación.

#### Scenario: Archivo demasiado grande rechazado en el cliente (unit)

- GIVEN un archivo de 25 MB seleccionado en el selector
- WHEN la interfaz lo valida
- THEN muestra un mensaje de límite en español y no solicita permiso de subida

#### Scenario: Tipo de archivo no permitido rechazado en el cliente (unit)

- GIVEN un archivo `apuntes.docx` seleccionado
- WHEN la interfaz lo valida
- THEN muestra un mensaje en español indicando que solo se aceptan PDF y no solicita permiso de subida

### Requirement: Subida directa desde el navegador

Los bytes del PDF MUST viajar directamente del navegador a Storage usando el permiso firmado. Ninguna Server Action ni route handler de la aplicación MUST recibir ni almacenar en memoria el contenido del archivo. Las Server Actions del pipeline MUST transportar únicamente identificadores y metadatos.

#### Scenario: Server Actions solo con metadatos (unit)

- GIVEN las Server Actions de solicitud de permiso, de encolado y de consulta de estado
- WHEN se inspecciona su esquema de entrada Zod
- THEN aceptan solo identificadores, `fileName`, `mime`, `sizeBytes` y `storagePath`, nunca datos binarios

#### Scenario: Subida completa (e2e)

- GIVEN un permiso emitido
- WHEN el navegador sube el archivo
- THEN el objeto existe en la ruta canónica y ninguna petición a la aplicación transporta el cuerpo del archivo

### Requirement: Modelo de datos de `ImportJob`

MUST existir una migración Drizzle versionada que cree `import_jobs` con `id` (UUID v7), `owner_id`, `page_id` con clave foránea a `pages.id`, `storage_path` único, `file_name`, `status` restringido a `queued`, `processing`, `done` y `failed`, `page_count` entero nulo hasta que se conoce, `pages_without_text` entero con valor inicial `0`, `error` texto nulo, `trigger_run_id` texto nulo, `created_at` y `updated_at` (documento maestro §6.1, más el contador de páginas sin texto de la decisión 6). Un `ImportJob` MAY registrar además el instante de su transición terminal. Cada migración MUST entregarse con su migración de reversión y ninguna otra tabla MUST depender de `import_jobs`.

#### Scenario: Migración aplicada (db smoke)

- GIVEN una base de datos con las migraciones de la fase 1
- WHEN se aplica la migración de `import_jobs`
- THEN existe la tabla con las columnas declaradas, `status` rechaza valores fuera del conjunto y `storage_path` es único

#### Scenario: Migración revertida (db smoke)

- GIVEN la migración de `import_jobs` aplicada
- WHEN se aplica su migración de reversión
- THEN la tabla deja de existir y las tablas de la fase 1 quedan intactas

### Requirement: Ciclo de vida del `ImportJob`

La entidad `ImportJob` de `ingestion.domain` MUST nacer en `queued` y admitir únicamente las transiciones `queued` → `processing`, `processing` → `done` y `processing` → `failed`; `queued` → `failed` MUST admitirse solo cuando el encolado en la plataforma de tareas falla. `done` y `failed` son estados terminales: cualquier transición desde ellos MUST rechazarse con un `DomainError` sin modificar el job. Pasar a `done` MUST exigir `page_count` conocido y `pages_without_text` menor que `page_count`; pasar a `failed` MUST exigir un `error` no vacío. Las transiciones MUST implementarse como funciones puras de `domain` con cobertura del 100 %.

#### Scenario: Flujo feliz de transiciones (unit)

- GIVEN un job recién creado
- WHEN se aplica `start` y luego `complete` con `page_count` 30 y `pages_without_text` 0
- THEN el estado pasa por `queued`, `processing` y termina en `done` con los contadores persistidos y `error` nulo

#### Scenario: Transición desde estado terminal rechazada (unit)

- GIVEN un job en `done` o en `failed`
- WHEN se intenta `start`, `complete` o `fail`
- THEN la función devuelve un `DomainError` y el job conserva su estado y sus campos

#### Scenario: `complete` sin contadores válidos rechazado (unit)

- GIVEN un job en `processing`
- WHEN se intenta `complete` con `page_count` nulo, o con `pages_without_text` igual a `page_count`
- THEN la función devuelve un `DomainError` y el job sigue en `processing`

#### Scenario: `fail` sin mensaje rechazado (unit)

- GIVEN un job en `processing`
- WHEN se intenta `fail` con `error` vacío o solo espacios
- THEN la función devuelve un `DomainError` y el job sigue en `processing`

### Requirement: Encolado de la importación con revalidación del objeto real

El caso de uso `EnqueuePdfImport` MUST recibir `ownerId`, `notebookId`, `storagePath`, `fileName`, `mime` y `sizeBytes`, verificar de nuevo que el cuaderno está activo y pertenece al owner y que `storagePath` comienza con `{ownerId}/`, y leer los metadatos reales del objeto en Storage. MUST rechazar con `DomainError` sin crear página ni job cuando el objeto no existe, su content type real no es `application/pdf` o su tamaño real supera 20 971 520 bytes; los valores persistidos MUST provenir del objeto real, no de los declarados. Si la revalidación pasa, el caso de uso MUST crear una página nueva en el cuaderno a través de la API pública de `notebooks`, con `title` derivado de `fileName` sin la extensión `.pdf`, recortado y truncado a 120 caracteres, o "Sin título" si queda vacío; MUST crear el `ImportJob` en `queued` vinculado a esa página; MUST encolar exactamente una ejecución en segundo plano cuyo único dato de entrada es el `importJobId`; y MUST guardar el identificador de ejecución en `trigger_run_id`. Si el encolado en la plataforma falla, el job MUST pasar a `failed` con un `error` legible y la página MUST conservarse vacía y editable. Un encolado repetido para el mismo `storagePath` MUST devolver el job existente sin crear una segunda página ni un segundo job.

#### Scenario: Encolado exitoso (unit)

- GIVEN un PDF subido a la ruta canónica y un cuaderno activo del usuario
- WHEN se invoca `EnqueuePdfImport` con `fileName` "Cálculo I - unidad 3.pdf"
- THEN existe una página con `title` "Cálculo I - unidad 3" en ese cuaderno, un `ImportJob` en `queued` con `page_id` igual a la página, `storage_path` igual a la ruta y `trigger_run_id` no nulo, y el doble de la plataforma registra exactamente una ejecución con el `importJobId`

#### Scenario: Objeto real fuera de política (unit)

- GIVEN un `storagePath` cuyo objeto real mide 21 MB o tiene content type `text/plain` según el gateway
- WHEN se invoca `EnqueuePdfImport` declarando `application/pdf` y 2 MB
- THEN devuelve un `DomainError`, no crea página, no crea job y no encola nada

#### Scenario: Objeto inexistente (unit)

- GIVEN un `storagePath` que no existe en Storage
- WHEN se invoca `EnqueuePdfImport`
- THEN devuelve un `DomainError` y no crea página ni job

#### Scenario: Ruta fuera del prefijo del owner (unit)

- GIVEN un `storagePath` cuyo primer segmento no es el `ownerId` de la sesión
- WHEN se invoca `EnqueuePdfImport`
- THEN devuelve un `DomainError` sin consultar Storage y sin crear nada

#### Scenario: Fallo al encolar en la plataforma (unit)

- GIVEN un doble de la plataforma de tareas que rechaza el encolado
- WHEN se invoca `EnqueuePdfImport`
- THEN el job queda en `failed` con un `error` legible, la página existe vacía con `content_version` 1 y el caso de uso devuelve el job para que la interfaz muestre el error

#### Scenario: Encolado repetido (unit)

- GIVEN un job ya creado para un `storagePath`
- WHEN se invoca `EnqueuePdfImport` de nuevo con el mismo `storagePath`
- THEN se devuelve el job existente y sigue habiendo una sola página y un solo job

#### Scenario: Título largo truncado (unit)

- GIVEN un `fileName` de 150 caracteres más `.pdf`
- WHEN se invoca `EnqueuePdfImport`
- THEN la página se crea con un `title` de exactamente 120 caracteres sin la extensión

### Requirement: Procesamiento del job en segundo plano

El caso de uso `ProcessImportJob` MUST recibir únicamente el `importJobId`, cargar el job persistido y tomar el `ownerId` del job, nunca de la entrada. MUST pasar el job a `processing`, descargar el objeto de Storage mediante un puerto de descarga propio de `ingestion`, extraer el texto página por página, convertirlo a bloques con la función pura de `domain`, persistir el contenido y `plain_text` a través de la API pública de `notebooks` en una sola escritura, y pasar el job a `done` con `page_count` igual al total de páginas del PDF y `pages_without_text` igual a las páginas omitidas. Ante cualquier fallo (descarga, PDF corrupto, extracción, persistencia, conflicto de versión de la página) el job MUST pasar a `failed` con un `error` legible y la página MUST quedar sin contenido parcial: o conserva el documento vacío o tiene el contenido completo, nunca un estado intermedio. La ejecución MUST tener un límite de tiempo explícito no mayor que 300 segundos; superarlo MUST terminar el job en `failed`. La tarea de `src/trigger/` MUST limitarse a invocar este caso de uso y MUST NOT contener lógica de conversión ni de persistencia.

#### Scenario: Importación completa (unit)

- GIVEN un job en `queued` cuyo objeto en el doble de Storage es un PDF de 3 páginas con texto
- WHEN se invoca `ProcessImportJob` con su `importJobId`
- THEN la página queda con el documento convertido y `plain_text` materializado, y el job termina en `done` con `page_count` 3 y `pages_without_text` 0

#### Scenario: Fallo de descarga (unit)

- GIVEN un job en `queued` cuyo objeto ya no existe en Storage
- WHEN se invoca `ProcessImportJob`
- THEN el job termina en `failed` con un `error` legible y la página conserva el documento vacío con `content_version` 1

#### Scenario: PDF corrupto (unit)

- GIVEN un job cuyo objeto no es un PDF válido aunque su content type sea `application/pdf`
- WHEN se invoca `ProcessImportJob`
- THEN el job termina en `failed` con un `error` legible y la página no cambia

#### Scenario: Página modificada durante el procesamiento (unit)

- GIVEN un job en `processing` cuya página fue guardada por otra vía y ya no está en `content_version` 1
- WHEN el caso de uso intenta persistir el contenido convertido
- THEN la escritura se rechaza, el job termina en `failed` con un `error` que indica que la página cambió durante la importación y el contenido existente de la página se conserva

#### Scenario: `ownerId` tomado del job persistido (unit)

- GIVEN un job persistido con `owner_id` A
- WHEN se invoca `ProcessImportJob` con su `importJobId`
- THEN toda lectura y escritura se ejecuta con `ownerId` A y la entrada del caso de uso no admite ningún campo de owner

#### Scenario: Job inexistente (unit)

- GIVEN un `importJobId` que no existe
- WHEN se invoca `ProcessImportJob`
- THEN devuelve un `DomainError` y no escribe nada

### Requirement: Idempotencia frente a reintentos

Cada `ImportJob` MUST producir sus efectos a lo sumo una vez, aunque la plataforma de tareas reintente o duplique la ejecución. Invocar `ProcessImportJob` sobre un job en `done` o `failed` MUST devolver éxito sin descargar, convertir ni escribir nada. Una ejecución repetida sobre un job en `processing` MAY continuar el procesamiento, pero al terminar la página MUST contener exactamente una copia del contenido importado y el evento de analítica MUST emitirse una sola vez.

#### Scenario: Reintento sobre job terminado (unit)

- GIVEN un job en `done`
- WHEN se invoca `ProcessImportJob` de nuevo
- THEN devuelve éxito, el doble de Storage no registra descargas, la página no cambia y no se emite un segundo evento

#### Scenario: Ejecución duplicada durante el procesamiento (unit)

- GIVEN un job en `processing` cuyo contenido ya fue persistido en la página
- WHEN se invoca `ProcessImportJob` de nuevo
- THEN la página sigue con una sola copia del contenido y el job termina en un estado terminal coherente con el contenido persistido

### Requirement: Extracción de texto página por página

La extracción MUST producir una entrada de texto por página del PDF, en orden, y MUST reportar el total de páginas del documento como `page_count`. Una página cuyo texto extraído es vacío o solo espacios en blanco tras la normalización MUST considerarse "sin texto": se omite de la conversión y se cuenta en `pages_without_text`. Cada página se convierte de forma independiente y los bloques resultantes se concatenan en orden de página; ningún bloque MUST abarcar dos páginas y MUST NOT insertarse ningún marcador de salto de página.

#### Scenario: Salto de página separa párrafos (unit)

- GIVEN un PDF cuya página 1 termina con la línea "termina aquí" y cuya página 2 empieza con "y sigue acá"
- WHEN se convierte el documento
- THEN el resultado tiene dos párrafos consecutivos, "termina aquí" y "y sigue acá", sin ningún bloque divisor entre ellos

#### Scenario: Página en blanco omitida (unit)

- GIVEN un PDF de 3 páginas cuya página 2 devuelve el texto "   \n\n"
- WHEN se convierte el documento
- THEN el resultado contiene solo los bloques de las páginas 1 y 3, `page_count` es 3 y `pages_without_text` es 1

### Requirement: Heurística texto→bloques

Una función pura de `ingestion.domain` MUST convertir la lista de textos por página en un documento Tiptap (`{ type: "doc", content: [...] }`) usando únicamente bloques `heading` (con `attrs.level` 1, 2 o 3), `paragraph`, `bulletList` y `orderedList` (cada uno con `listItem` que contiene un `paragraph`), sin depender de Tiptap ni ProseMirror, sin importar `unpdf` y con cobertura del 100 %. MUST NOT emitir nodos de texto vacíos ni bloques sin contenido. Las reglas siguientes se aplican en este orden:

1. **Normalización**: `\r\n` y `\r` MUST convertirse en `\n`; los caracteres de control distintos de `\n` MUST eliminarse; los espacios no separables MUST tratarse como espacios; dentro de cada línea, toda secuencia de espacios y tabuladores MUST colapsarse en un solo espacio y la línea MUST recortarse por ambos extremos.
2. **Líneas descartadas**: una línea vacía tras la normalización es una "línea en blanco"; una línea compuesta solo por dígitos MUST descartarse como numeración de página.
3. **Ítem de lista con viñeta**: una línea que empieza con `-`, `•` o `*` seguido de un espacio y al menos un carácter no blanco MUST ser un ítem de `bulletList`; el marcador se elimina del texto.
4. **Ítem de lista ordenada**: una línea que empieza con `N)` seguido de un espacio y texto MUST ser un ítem de `orderedList`; una línea que empieza con `N.` seguido de un espacio y texto MUST ser un ítem de `orderedList` cuando la línea no blanca inmediatamente anterior es un ítem ordenado con número `N-1` o la línea no blanca inmediatamente siguiente empieza con `N+1.` o `N+1)`. El marcador se elimina del texto y la lista MUST conservar el número del primer ítem en `attrs.start` cuando es distinto de 1.
5. **Encabezado** (decisión 5): una línea no clasificada como ítem de lista MUST ser un `heading` cuando tiene 80 caracteres o menos, contiene al menos una letra, no termina en `.`, `,`, `;`, `:`, `!` ni `?`, y cumple al menos una de: (a) empieza con prefijo numerado `N.` o `N.N`, `N.N.N`… seguido de un espacio (con o sin punto final en el prefijo), (b) empieza con un numeral romano en mayúsculas seguido de `.` y un espacio, (c) todas sus letras son mayúsculas. El texto del encabezado MUST conservar el prefijo tal como aparece.
6. **Nivel del encabezado**: un prefijo romano o numerado de un solo segmento (`1.`) MUST dar nivel 1; dos segmentos (`1.1`) nivel 2; tres o más segmentos nivel 3; una línea en mayúsculas sin prefijo MUST dar nivel 1. Cuando la línea tiene prefijo y además está en mayúsculas, el prefijo decide el nivel.
7. **Párrafo**: toda línea no clasificada como ítem ni encabezado es texto de párrafo. Líneas de párrafo consecutivas MUST unirse en un solo `paragraph` separadas por un espacio, salvo que la línea anterior termine en un guion `-` precedido de una letra y la siguiente empiece con minúscula, en cuyo caso MUST unirse sin espacio y sin el guion.
8. **Continuación de ítem**: una línea de párrafo que sigue inmediatamente a un ítem de lista, sin línea en blanco entre ambas, MUST anexarse al texto de ese ítem con la misma regla de unión del punto 7.
9. **Cierre de bloques**: una o más líneas en blanco, un encabezado, o un cambio de tipo de ítem (viñeta ↔ ordenado) MUST cerrar el párrafo o la lista en curso. Ítems consecutivos del mismo tipo MUST agruparse en una sola lista. Un encabezado nunca se une con otra línea.

#### Scenario: Encabezado numerado y nivel derivado (unit)

- GIVEN las líneas "1. Introducción", "1.1 Contexto histórico" y "1.1.1 Antecedentes"
- WHEN se convierten
- THEN el resultado es tres `heading` con `level` 1, 2 y 3 y con el texto completo incluido el prefijo

#### Scenario: Encabezado romano y en mayúsculas (unit)

- GIVEN las líneas "II. Marco teórico" y "CAPÍTULO 2"
- WHEN se convierten
- THEN ambas producen `heading` con `level` 1

#### Scenario: Línea corta sin prefijo ni mayúsculas es párrafo (unit)

- GIVEN la línea "Introducción"
- WHEN se convierte
- THEN el resultado es un `paragraph`, no un `heading`

#### Scenario: Encabezado candidato con puntuación final o demasiado largo rechazado (unit)

- GIVEN la línea "1. La célula es la unidad básica." y una línea en mayúsculas de 81 caracteres
- WHEN se convierten
- THEN ambas producen `paragraph`

#### Scenario: Párrafo con líneas envueltas y guion de corte (unit)

- GIVEN las líneas "La mitocondria produce ener-", "gía para la célula y", "participa en la apoptosis."
- WHEN se convierten
- THEN el resultado es un único `paragraph` con el texto "La mitocondria produce energía para la célula y participa en la apoptosis."

#### Scenario: Lista con viñetas agrupada (unit)

- GIVEN las líneas "- Primera idea", "• Segunda idea", "* Tercera idea"
- WHEN se convierten
- THEN el resultado es un único `bulletList` con tres `listItem` cuyos textos no incluyen el marcador

#### Scenario: Lista ordenada secuencial frente a encabezado numerado aislado (unit)

- GIVEN las líneas "1. Preparar el material", "2. Leer el capítulo", "3. Resumir", una línea en blanco y "1. Conclusiones"
- WHEN se convierten
- THEN las tres primeras forman un `orderedList` con tres ítems sin marcador, y "1. Conclusiones" es un `heading` de `level` 1

#### Scenario: Lista ordenada con paréntesis y `start` distinto de 1 (unit)

- GIVEN las líneas "3) Tercer paso" y "4) Cuarto paso"
- WHEN se convierten
- THEN el resultado es un `orderedList` con `attrs.start` 3 y dos ítems

#### Scenario: Continuación de ítem envuelto (unit)

- GIVEN las líneas "- Un ítem que continúa", "en la línea siguiente", una línea en blanco y "Párrafo aparte"
- WHEN se convierten
- THEN el `bulletList` tiene un solo ítem con texto "Un ítem que continúa en la línea siguiente" y le sigue un `paragraph` "Párrafo aparte"

#### Scenario: Líneas en blanco y numeración de página (unit)

- GIVEN las líneas "Primer párrafo", "", "", "12", "Segundo párrafo"
- WHEN se convierten
- THEN el resultado es dos `paragraph` separados y ningún bloque contiene "12"

#### Scenario: Normalización de espacios (unit)

- GIVEN la línea "  Texto\tcon   espacios raros  \r\n"
- WHEN se convierte
- THEN el `paragraph` contiene exactamente "Texto con espacios raros"

#### Scenario: Cambio de tipo de lista cierra la lista (unit)

- GIVEN las líneas "- Viñeta", "1) Ordenado"
- WHEN se convierten
- THEN el resultado es un `bulletList` con un ítem seguido de un `orderedList` con un ítem

#### Scenario: Entrada sin texto útil (unit)

- GIVEN una lista de páginas cuyos textos son todos vacíos o solo espacios
- WHEN se convierten
- THEN el resultado es un documento `doc` con `content` vacío y la función no lanza excepción

### Requirement: Importación parcial y PDF sin capa de texto

Cuando al menos una página tiene texto, el job MUST terminar en `done` con el contenido de las páginas con texto y con `pages_without_text` igual al número de páginas omitidas (decisión 6). Cuando ninguna página tiene texto, el job MUST terminar en `failed` con un `error` que indique que el PDF no tiene capa de texto y que Cogni no hace OCR, y la página MUST conservar el documento vacío. MUST NOT intentarse OCR ni ningún procesamiento de imágenes.

#### Scenario: PDF mixto importado parcialmente (unit)

- GIVEN un PDF de 5 páginas donde las páginas 2 y 4 no tienen texto
- WHEN se procesa el job
- THEN el job termina en `done` con `page_count` 5 y `pages_without_text` 2, y la página contiene solo los bloques de las páginas 1, 3 y 5 en ese orden

#### Scenario: PDF escaneado sin texto (unit)

- GIVEN un PDF de 4 páginas sin texto en ninguna
- WHEN se procesa el job
- THEN el job termina en `failed` con `page_count` 4, `pages_without_text` 4 y un `error` que menciona la ausencia de capa de texto, y la página conserva el documento vacío con `content_version` 1

#### Scenario: PDF mixto de extremo a extremo (e2e)

- GIVEN el fixture de PDF mixto versionado en `tests/e2e/fixtures/`
- WHEN el usuario lo importa y espera el estado terminal
- THEN la página muestra el contenido de las páginas con texto y el aviso indica cuántas páginas no tenían texto

### Requirement: Consulta de estado para el progreso

El caso de uso `GetImportJobStatus` MUST recibir `ownerId` y `pageId`, y devolver el job asociado a esa página con `status`, `page_count`, `pages_without_text`, `error`, `created_at` y `updated_at`, sin `storage_path` ni `trigger_run_id`. Una página sin job MUST responder que no hay importación. Un job de otro owner MUST tratarse como inexistente. La consulta MUST ser de solo lectura.

#### Scenario: Estado del job propio (unit)

- GIVEN un job en `processing` de una página del usuario
- WHEN invoca `GetImportJobStatus` con ese `pageId`
- THEN recibe `status` `processing` sin `storage_path` ni `trigger_run_id`

#### Scenario: Página sin importación (unit)

- GIVEN una página creada a mano por el usuario
- WHEN invoca `GetImportJobStatus`
- THEN recibe la indicación de que no existe importación y ningún `DomainError`

#### Scenario: Job ajeno (unit)

- GIVEN un job de otro usuario
- WHEN se invoca `GetImportJobStatus` con el `pageId` de ese job
- THEN el caso de uso devuelve un `DomainError` sin revelar que el job existe

### Requirement: Autorización por propiedad en todo el pipeline

Cada caso de uso de `ingestion` MUST recibir el `ownerId` de la sesión (o tomarlo del job persistido en `ProcessImportJob`) y filtrar por él en toda lectura y escritura. Un cuaderno, página, job u objeto de Storage de otro usuario MUST tratarse como inexistente: el caso de uso devuelve un `DomainError` y ningún dato. Solo el owner MUST poder solicitar el permiso, encolar, consultar el estado y abrir la página resultante.

#### Scenario: Job ajeno en cada caso de uso (unit)

- GIVEN dos usuarios distintos y un job del primero
- WHEN el segundo invoca `GetImportJobStatus` con el `pageId` del job, o `EnqueuePdfImport` con un `storagePath` bajo el prefijo del primero
- THEN cada caso de uso devuelve un `DomainError` y nada cambia

#### Scenario: Página importada ajena por ruta (e2e)

- GIVEN un usuario autenticado con la URL de una página importada por otro usuario
- WHEN abre esa URL
- THEN ve la vista de recurso no encontrado y ningún contenido ni estado de importación

#### Scenario: PDF ajeno no descargable (e2e)

- GIVEN la ruta del PDF de otro usuario
- WHEN el usuario intenta obtenerlo con su sesión
- THEN Storage deniega la petición y no entrega bytes

### Requirement: Errores seguros para la interfaz

El campo `error` de un job en `failed` y todo mensaje de error que la interfaz muestre MUST ser un texto corto en español con "tú" que explique qué pasó y qué puede hacer el usuario. MUST NOT contener trazas de pila, rutas de archivos, URLs firmadas, nombres de variables de entorno, secretos ni mensajes crudos de proveedores. El detalle técnico MUST enviarse solo a la observabilidad del servidor.

#### Scenario: Excepción de infraestructura traducida (unit)

- GIVEN un adaptador de Storage que lanza una excepción con una URL firmada y una traza
- WHEN el job pasa a `failed`
- THEN `error` contiene un mensaje en español sin la URL, sin la traza y sin nombres de variables de entorno

#### Scenario: Mensaje de PDF sin texto accionable (unit)

- GIVEN un PDF sin capa de texto
- WHEN el job pasa a `failed`
- THEN `error` indica que el PDF no tiene texto seleccionable y sugiere usar un PDF con texto

### Requirement: Server Actions delgadas que solo encolan y consultan

Las operaciones de solicitar permiso, encolar y consultar estado MUST exponerse como Server Actions que exijan sesión, validen su entrada con Zod antes de llamar a `application` y devuelvan errores en español con "tú". Ninguna Server Action MUST descargar, extraer ni convertir un PDF (documento maestro §8.1 regla 5). MUST NOT agregarse route handlers para estas operaciones.

#### Scenario: Server Action sin sesión (unit)

- GIVEN una petición sin sesión válida
- WHEN se invoca cualquier Server Action de `ingestion`
- THEN la acción rechaza la petición sin tocar `application`

#### Scenario: Entrada inválida (unit)

- GIVEN una Server Action de encolado con `sizeBytes` negativo o `mime` vacío
- WHEN se invoca
- THEN la validación falla en el servidor y el mensaje es accionable y en español

#### Scenario: La acción de encolar responde sin esperar el procesamiento (unit)

- GIVEN una invocación de la Server Action de encolado con un doble de plataforma que tarda
- WHEN la acción responde
- THEN devuelve el job en `queued` sin que se haya ejecutado `ProcessImportJob`

### Requirement: Dobles en memoria para pruebas

`ingestion.application` MUST poder ejecutarse en Vitest sin base de datos, sin Storage y sin la plataforma de tareas mediante dobles en memoria del repositorio de `ImportJob`, del puerto de descarga y del puerto de encolado, que cumplen los mismos puertos que los adaptadores reales. La extracción de texto MUST estar detrás de un puerto sustituible en los tests de `application`.

#### Scenario: Suite unitaria sin conexión (unit)

- GIVEN los tests de `domain` y `application` de `ingestion`
- WHEN se ejecuta `pnpm test` sin `DATABASE_URL`, sin `SUPABASE_PDF_BUCKET` y sin `TRIGGER_SECRET_KEY`
- THEN todos los tests pasan usando los dobles en memoria

#### Scenario: Cobertura total de las funciones puras (unit)

- GIVEN la función texto→bloques y las transiciones de `ImportJob`
- WHEN se ejecuta la suite con cobertura
- THEN ambas reportan 100 % de líneas y ramas

### Requirement: Presupuesto de 60 segundos para un PDF de 30 páginas

Un PDF de 30 páginas con capa de texto SHOULD terminar como página editable en menos de 60 segundos medidos desde que el usuario confirma el archivo en el selector hasta que la interfaz muestra el editor con el contenido (criterio de hecho de §13). La medición MUST realizarse contra el entorno de preview con el fixture de 30 páginas antes de archivar el change, registrando el desglose (subida, encolado, espera en cola, procesamiento, latencia del polling) y la fecha. Si la medición supera 60 segundos, el resultado MUST registrarse igualmente y la desviación MUST tratarse antes del cierre de la fase.

#### Scenario: Medición registrada (manual)

- GIVEN el fixture de 30 páginas y el entorno de preview con la tarea desplegada
- WHEN el usuario ejecuta la importación y se cronometra el flujo completo
- THEN el tiempo total y su desglose quedan registrados en `tasks.md` del change con la fecha de la medición

#### Scenario: Flujo de aceptación (e2e)

- GIVEN un usuario autenticado con un cuaderno y el fixture de 30 páginas
- WHEN elige "Importar PDF", sube el archivo y espera el estado `done`
- THEN la página muestra encabezados, párrafos o listas provenientes del PDF, el editor permite escribir y el autosave persiste el cambio
