# notebooks Specification

## Purpose

Jerarquía de dos niveles Usuario → Cuaderno → Página (documento maestro §3.1), ciclo de vida de cuadernos y páginas con borrado lógico, autorización por propiedad, orden de creación mediante `position`, persistencia del contenido de página como JSON de Tiptap con `plain_text` materializado en el servidor y control de concurrencia optimista por `content_version` (§6.1, §6.2). Módulo hexagonal `src/modules/notebooks` con la misma forma que `identity`.

## Requirements

### Requirement: Jerarquía estricta de dos niveles

El sistema MUST modelar exactamente dos niveles bajo el usuario: `Notebook` pertenece a un `owner_id` y `Page` pertenece a un `notebook_id`. MUST NOT existir subpáginas, cuadernos anidados ni páginas sin cuaderno.

#### Scenario: Página creada dentro de un cuaderno (unit)

- GIVEN un cuaderno activo del usuario
- WHEN el caso de uso `CreatePage` recibe ese `notebookId`
- THEN la página se crea con `notebook_id` igual al cuaderno indicado

#### Scenario: Página sin cuaderno rechazada (unit)

- GIVEN un `notebookId` inexistente
- WHEN se invoca `CreatePage`
- THEN el caso de uso devuelve un `DomainError` y no crea ninguna página

### Requirement: Modelo de datos según §6.1

MUST existir una migración Drizzle versionada que cree `notebooks` (`id` UUID v7, `owner_id`, `title`, `icon`, `color`, `position`, `archived_at`, `created_at`, `updated_at`), `pages` (`id` UUID v7, `owner_id`, `notebook_id` con clave foránea a `notebooks.id`, `title`, `content` jsonb, `plain_text`, `content_version` entero con valor inicial `1`, `position`, `archived_at`, `created_at`, `updated_at`) y `page_assets` (`id` UUID v7, `owner_id`, `page_id` con clave foránea a `pages.id`, `storage_path` único, `mime`, `size_bytes`, `created_at`, `updated_at`). Cada migración MUST entregarse con su migración de reversión.

#### Scenario: Migración aplicada (db smoke)

- GIVEN una base de datos con las migraciones de la fase 0
- WHEN se aplica la migración de la fase 1
- THEN existen las tres tablas con las columnas declaradas y `pages.content_version` tiene valor por defecto `1`

#### Scenario: Migración revertida (db smoke)

- GIVEN la migración de la fase 1 aplicada
- WHEN se aplica su migración de reversión
- THEN las tres tablas dejan de existir y el esquema de la fase 0 queda intacto

### Requirement: Ciclo de vida del cuaderno

El sistema MUST permitir crear, renombrar, definir `icon` y `color` y archivar cuadernos mediante casos de uso de `application`. `title` MUST ser texto no vacío tras recortar espacios y de máximo 120 caracteres. `icon` MAY ser nulo o un único emoji elegido por el usuario. `color` MAY ser nulo o uno de los nombres de la paleta pastel de Cogni (`pink`, `green`, `yellow`, `purple`, `orange`, `blue`, `mint`).

#### Scenario: Creación con título válido (unit)

- GIVEN un usuario autenticado
- WHEN invoca `CreateNotebook` con `title` "Cálculo I"
- THEN se crea un cuaderno con ese título, `archived_at` nulo y `owner_id` igual al usuario

#### Scenario: Título vacío rechazado (unit)

- GIVEN un usuario autenticado
- WHEN invoca `CreateNotebook` o `RenameNotebook` con un título vacío o solo espacios
- THEN el caso de uso devuelve un `DomainError` y no persiste nada

#### Scenario: Color fuera de la paleta rechazado (unit)

- GIVEN un cuaderno del usuario
- WHEN se actualiza `color` con un valor que no pertenece a la paleta
- THEN el caso de uso devuelve un `DomainError` y el cuaderno conserva su color anterior

#### Scenario: Renombrar y cambiar ícono desde el sidebar (e2e)

- GIVEN un cuaderno visible en el sidebar
- WHEN el usuario lo renombra y elige un ícono
- THEN el sidebar muestra el nuevo título y el ícono, y ambos persisten tras recargar

### Requirement: Ciclo de vida de la página

El sistema MUST permitir crear, renombrar y archivar páginas dentro de un cuaderno activo del mismo `owner_id`. Una página nueva MUST crearse con `title` "Sin título" cuando no se indica uno, `content` igual a un documento Tiptap vacío, `plain_text` vacío y `content_version` igual a `1`. Las reglas de `title` son las mismas del cuaderno.

#### Scenario: Página nueva con valores iniciales (unit)

- GIVEN un cuaderno activo del usuario
- WHEN invoca `CreatePage` sin título
- THEN la página tiene `title` "Sin título", `content_version` `1`, `plain_text` vacío y `archived_at` nulo

#### Scenario: Página en cuaderno archivado rechazada (unit)

- GIVEN un cuaderno con `archived_at` definido
- WHEN se invoca `CreatePage` sobre ese cuaderno
- THEN el caso de uso devuelve un `DomainError`

#### Scenario: Crear y abrir una página (e2e)

- GIVEN un cuaderno en el sidebar
- WHEN el usuario crea una página desde el cuaderno
- THEN la página aparece bajo el cuaderno en el sidebar y se abre en la vista de página

### Requirement: Orden de creación con `position` solo agregando al final

Cada cuaderno y página nuevos MUST recibir un `position` estrictamente mayor que el de todos sus hermanos existentes del mismo alcance (cuadernos del owner; páginas del cuaderno), incluidos los archivados. MUST NOT existir un caso de uso de reordenamiento ni una interfaz para arrastrar y soltar.

#### Scenario: Posiciones crecientes (unit)

- GIVEN un cuaderno con páginas de `position` 1 y 2, la segunda archivada
- WHEN se crea una tercera página
- THEN su `position` es mayor que 2

#### Scenario: Listado en orden de creación (unit)

- GIVEN tres cuadernos creados en secuencia
- WHEN se listan los cuadernos del owner
- THEN se devuelven en orden ascendente de `position`

### Requirement: Autorización por propiedad

Cada caso de uso del módulo MUST recibir el `ownerId` de la sesión y filtrar por él en toda lectura y escritura. Un cuaderno, página o asset de otro usuario MUST tratarse como inexistente: el caso de uso devuelve un `DomainError` y ningún dato, sin revelar que el recurso existe.

#### Scenario: Página ajena (unit)

- GIVEN dos usuarios distintos y una página del primero
- WHEN el segundo invoca `GetPage`, `RenamePage`, `ArchivePage` o `SavePage` con ese `pageId`
- THEN cada caso de uso devuelve un `DomainError` y la página no cambia

#### Scenario: Ruta de página ajena (e2e)

- GIVEN un usuario autenticado con la URL de una página de otro usuario
- WHEN abre esa URL
- THEN ve la vista de recurso no encontrado y ningún contenido de la página

### Requirement: Archivado lógico sin restauración

Archivar MUST fijar `archived_at` con la fecha actual y MUST NOT borrar filas. Los elementos archivados MUST desaparecer del sidebar y sus rutas MUST responder como no encontradas. Archivar un cuaderno MUST ocultar también sus páginas. Archivar un elemento ya archivado MUST ser idempotente. MUST NOT existir papelera, restauración ni borrado físico en esta fase.

#### Scenario: Cuaderno archivado desaparece con sus páginas (unit)

- GIVEN un cuaderno con dos páginas activas
- WHEN se invoca `ArchiveNotebook`
- THEN el listado del sidebar no incluye el cuaderno ni sus páginas, y las filas siguen existiendo con `archived_at` definido

#### Scenario: Archivado repetido (unit)

- GIVEN una página ya archivada
- WHEN se invoca `ArchivePage` de nuevo
- THEN el caso de uso devuelve éxito y `archived_at` conserva su valor original

#### Scenario: Archivar desde el sidebar (e2e)

- GIVEN una página visible en el sidebar
- WHEN el usuario la archiva y confirma
- THEN la página deja de aparecer y no existe ninguna opción de restaurarla

### Requirement: Guardado de contenido con comparar-e-intercambiar de `content_version`

El caso de uso `SavePage` MUST recibir `ownerId`, `pageId`, `content` (JSON de Tiptap con nodo raíz `doc`) y `expectedVersion`. Si `expectedVersion` coincide con `content_version` actual, MUST persistir `content`, incrementar `content_version` en uno, materializar `plain_text` y devolver la nueva versión. Si no coincide, MUST devolver un `DomainError` de conflicto de versión que incluya la versión actual, sin escribir nada. El caso de uso MUST NOT aceptar `plain_text` del cliente.

#### Scenario: Guardado con versión vigente (unit)

- GIVEN una página con `content_version` 3
- WHEN se invoca `SavePage` con `expectedVersion` 3 y contenido nuevo
- THEN la página queda con el contenido nuevo, `content_version` 4 y `plain_text` recalculado

#### Scenario: Guardado obsoleto rechazado (unit)

- GIVEN una página con `content_version` 4
- WHEN se invoca `SavePage` con `expectedVersion` 3
- THEN el caso de uso devuelve un `DomainError` de conflicto que indica la versión 4 y el contenido almacenado no cambia

#### Scenario: `plain_text` enviado por el cliente ignorado (unit)

- GIVEN una entrada de `SavePage` que incluye un campo `plain_text`
- WHEN se valida la entrada
- THEN el campo se rechaza o se descarta y el `plain_text` persistido proviene únicamente del cálculo del servidor

#### Scenario: Contenido que no es un documento Tiptap (unit)

- GIVEN una entrada cuyo `content` no tiene nodo raíz `doc`
- WHEN se invoca `SavePage`
- THEN la validación falla con un `DomainError` y no se escribe nada

### Requirement: Materialización de `plain_text` en el servidor

`plain_text` MUST calcularse en cada guardado mediante una función pura de `domain` que recorre el JSON de Tiptap sin depender de Tiptap ni ProseMirror. La función MUST concatenar el texto de los nodos de texto, separar bloques con un salto de línea, representar `hardBreak` como salto de línea, separar celdas de tabla con un tabulador y filas con salto de línea, conservar el texto de los bloques de código, incluir el texto de callouts, citas y listas, ignorar marcas y atributos, no aportar texto por imágenes ni divisores, descender en nodos desconocidos y devolver cadena vacía para un documento vacío. Esta función MUST tener cobertura del 100 %.

#### Scenario: Documento con varios bloques (unit)

- GIVEN un documento con un encabezado "Tema", un párrafo "Hola **mundo**" y una lista con dos ítems
- WHEN se calcula `plain_text`
- THEN el resultado es "Tema\nHola mundo\nítem 1\nítem 2" sin marcas ni sintaxis

#### Scenario: Imágenes y divisores sin aporte (unit)

- GIVEN un documento con solo una imagen y un divisor
- WHEN se calcula `plain_text`
- THEN el resultado es la cadena vacía

#### Scenario: Nodo desconocido (unit)

- GIVEN un documento con un nodo de tipo no reconocido que contiene texto
- WHEN se calcula `plain_text`
- THEN el texto interno se incluye y la función no lanza excepción

### Requirement: Listado del sidebar

El sistema MUST exponer un caso de uso que devuelva los cuadernos activos del owner en orden de `position` y, para cada uno, sus páginas activas en orden de `position`, con `id`, `title`, `icon` y `color`. La consulta MUST NOT devolver `content` ni `plain_text`.

#### Scenario: Árbol del owner (unit)

- GIVEN un usuario con dos cuadernos activos, uno archivado y páginas mixtas
- WHEN invoca `ListSidebar`
- THEN recibe solo los dos cuadernos activos con sus páginas activas, sin `content`

#### Scenario: Usuario sin cuadernos (e2e)

- GIVEN un usuario recién verificado
- WHEN entra al shell
- THEN el sidebar muestra el mensaje "Aún no tienes cuadernos. Crea uno para empezar." y un control para crear el primero

### Requirement: Rutas de cuaderno y página

El grupo `(app)` MUST exponer una ruta de vista de cuaderno y una ruta de vista de página. La vista de cuaderno MUST listar las páginas activas del cuaderno y permitir crear una nueva. La vista de página MUST cargar `title`, `content` y `content_version` y alojar el editor. Un identificador inexistente, ajeno o archivado MUST producir la vista de no encontrado.

#### Scenario: Vista de página carga la versión (e2e)

- GIVEN una página con contenido guardado
- WHEN el usuario abre su ruta
- THEN ve el título, el contenido renderizado en el editor y el editor conoce el `content_version` vigente

#### Scenario: Identificador inválido (e2e)

- GIVEN una URL de página con un identificador que no existe
- WHEN el usuario la abre
- THEN ve la vista de no encontrado en español

### Requirement: Puntos de entrada mediante Server Actions validadas

Toda mutación del módulo (crear, renombrar, ícono y color, archivar, guardar contenido) MUST exponerse como Server Action que exija sesión, valide su entrada con Zod antes de llamar a `application` y devuelva errores en español con "tú". MUST NOT agregarse route handlers para estas operaciones.

#### Scenario: Server Action sin sesión (unit)

- GIVEN una petición sin sesión válida
- WHEN se invoca cualquier Server Action del módulo
- THEN la acción rechaza la petición sin tocar `application`

#### Scenario: Entrada inválida en Server Action (unit)

- GIVEN una Server Action de renombrar con un título de 200 caracteres
- WHEN se invoca
- THEN la validación falla en el servidor y el mensaje es accionable y en español

### Requirement: Dobles en memoria para pruebas

`application` MUST poder ejecutarse en Vitest sin base de datos mediante `InMemoryNotebookRepository`, `InMemoryPageRepository` e `InMemoryPageAssetRepository` que cumplen los mismos puertos que los adaptadores Drizzle.

#### Scenario: Suite unitaria sin conexión (unit)

- GIVEN los tests de `application` del módulo
- WHEN se ejecuta `pnpm test` sin `DATABASE_URL`
- THEN todos los tests pasan usando los dobles en memoria
