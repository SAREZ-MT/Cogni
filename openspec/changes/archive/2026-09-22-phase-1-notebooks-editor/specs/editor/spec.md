# editor Specification

## Purpose

Editor de bloques sobre Tiptap con todos los bloques y marcas del documento maestro §3.2, menú de comandos `/`, paleta de resaltado de Cogni, autosave optimista con debounce a través del puerto de guardado de `notebooks` y reconciliación de conflictos de versión. Módulo `src/modules/editor`; Tiptap y ProseMirror viven únicamente en su capa `ui`.

## Requirements

### Requirement: Conjunto completo de bloques de §3.2

El editor MUST ofrecer los bloques: encabezados H1, H2 y H3; párrafo; lista con viñetas; lista numerada; lista de tareas con casilla; cita; bloque de código con resaltado de sintaxis y selector de lenguaje; imagen; divisor; tabla con filas y columnas editables; callout de tipo `idea`, `note` y `warning`. Cada bloque MUST serializarse al JSON de Tiptap y restaurarse sin pérdida al recargar la página.

#### Scenario: Ida y vuelta de cada familia de bloques (e2e)

- GIVEN una página nueva
- WHEN el usuario inserta un bloque de cada familia con contenido y espera el autosave
- AND recarga la página
- THEN cada bloque reaparece con el mismo tipo y contenido

#### Scenario: Casilla de tarea persistida (unit)

- GIVEN una lista de tareas con un ítem marcado
- WHEN se serializa el documento
- THEN el ítem conserva su estado marcado en el JSON

#### Scenario: Bloque de código con lenguaje (unit)

- GIVEN un bloque de código con lenguaje `typescript`
- WHEN se renderiza
- THEN el código muestra resaltado de sintaxis y el atributo de lenguaje se persiste

#### Scenario: Tabla editable (e2e)

- GIVEN una tabla insertada desde el menú `/`
- WHEN el usuario agrega una fila y una columna y escribe en una celda
- THEN la tabla persiste con las dimensiones y el texto nuevos

### Requirement: Marcas de texto

El editor MUST ofrecer las marcas negrita, cursiva, subrayado, tachado, código en línea, enlace y resaltado. Los atajos de teclado estándar (`Mod+B`, `Mod+I`, `Mod+U`, `Mod+Shift+S`, `Mod+E`) MUST aplicar la marca correspondiente. Un enlace MUST aceptar solo URLs `http`, `https` o `mailto` y MUST abrirse en una pestaña nueva con `rel="noopener noreferrer"`.

#### Scenario: Marca por atajo (unit)

- GIVEN texto seleccionado en el editor
- WHEN el usuario presiona `Mod+B`
- THEN el texto queda con la marca de negrita y así se serializa

#### Scenario: Enlace con esquema no permitido (unit)

- GIVEN un intento de enlace con URL `javascript:alert(1)`
- WHEN se aplica la marca
- THEN el enlace se rechaza y el texto queda sin marca

### Requirement: Paleta de resaltado de Cogni y callouts

La marca de resaltado MUST almacenar el nombre de color de la paleta de Cogni (`pink`, `green`, `yellow`, `purple`, `orange`, `blue`, `mint`) y MUST NOT almacenar códigos hexadecimales. El renderizado MUST usar los tokens del sistema de diseño con su variante `-fg` para el texto. Los callouts MUST mapear `idea` → `yellow`, `note` → `blue` y `warning` → `orange`.

#### Scenario: Resaltado por nombre (unit)

- GIVEN texto seleccionado
- WHEN el usuario elige el resaltado `purple`
- THEN el JSON contiene la marca con `color: "purple"` y el texto se renderiza con el fondo y el `-fg` del token `purple`

#### Scenario: Callout de advertencia (unit)

- GIVEN un callout de tipo `warning`
- WHEN se renderiza
- THEN usa los tokens del color `orange` y muestra su ícono de Lucide

### Requirement: Menú de comandos `/`

Escribir `/` al inicio de una línea o tras un espacio MUST abrir un menú con todos los bloques de §3.2, con etiquetas en español y filtrado por lo que el usuario escribe a continuación. Las flechas MUST mover la selección, `Enter` MUST insertar el bloque seleccionado reemplazando el texto del comando y `Escape` MUST cerrar el menú sin cambios. El menú MUST ser accesible por teclado y por puntero.

#### Scenario: Inserción por comando (e2e)

- GIVEN el cursor en una línea vacía
- WHEN el usuario escribe `/tabla` y presiona `Enter`
- THEN se inserta una tabla y el texto `/tabla` desaparece

#### Scenario: Filtro sin resultados (unit)

- GIVEN el menú abierto
- WHEN el usuario escribe un término que no coincide con ningún bloque
- THEN el menú muestra un mensaje de sin resultados y `Enter` no inserta nada

#### Scenario: Cierre con Escape (unit)

- GIVEN el menú abierto tras escribir `/`
- WHEN el usuario presiona `Escape`
- THEN el menú se cierra y el carácter `/` permanece en el texto

### Requirement: Autosave con debounce y actualización optimista

El editor MUST guardar automáticamente tras una pausa de escritura de entre 800 y 1500 ms, enviando solo el JSON de `content` y el `content_version` conocido a través del puerto de guardado de `notebooks`. Mientras hay cambios pendientes MUST mostrar el estado "Guardando…" y tras confirmar "Guardado". Los cambios realizados durante un guardado en curso MUST producir un nuevo guardado al terminar. Al salir de la página con cambios pendientes el editor MUST intentar guardarlos. Ante un fallo de red o servidor MUST conservar el contenido local, mostrar un estado de error en español y reintentar en la siguiente pausa.

#### Scenario: Guardado tras pausa (unit)

- GIVEN el usuario escribiendo de forma continua
- WHEN deja de escribir
- THEN se invoca el puerto de guardado exactamente una vez dentro de la ventana declarada con el contenido final

#### Scenario: Escritura durante el guardado (unit)

- GIVEN un guardado en curso
- WHEN el usuario sigue escribiendo
- THEN al terminar el primero se lanza un segundo guardado con el contenido más reciente

#### Scenario: Fallo de red (unit)

- GIVEN el puerto de guardado que falla
- WHEN vence el debounce
- THEN el editor muestra el estado de error, conserva el contenido y vuelve a intentar en la siguiente pausa

#### Scenario: Persistencia al volver (e2e)

- GIVEN un usuario que escribe notas con varios bloques y espera el estado "Guardado"
- WHEN cierra el navegador, vuelve a iniciar sesión y abre la página
- THEN el contenido está intacto

### Requirement: Reconciliación del conflicto de versión

Cuando el puerto de guardado devuelve un conflicto de `content_version`, el editor MUST NOT sobrescribir el contenido del servidor, MUST volver a cargar el contenido y la versión vigentes, MUST informar al usuario en español que la página cambió en otra pestaña y MUST conservar el borrador local disponible para el usuario hasta que este decida descartarlo o volver a aplicarlo. Tras reconciliar, el siguiente guardado MUST usar la versión vigente.

#### Scenario: Conflicto detectado (unit)

- GIVEN un editor con `content_version` 3 y un servidor en versión 4
- WHEN vence el debounce y el puerto devuelve conflicto
- THEN el editor muestra el aviso, carga el contenido de la versión 4 y expone el borrador local sin perderlo

#### Scenario: Guardado tras reconciliar (unit)

- GIVEN un conflicto reconciliado
- WHEN el usuario vuelve a escribir
- THEN el siguiente guardado envía `expectedVersion` 4 y se acepta

### Requirement: Flujo de inserción de imagen

El bloque de imagen MUST insertarse desde el menú `/` o arrastrando un archivo. Antes de solicitar un permiso de subida el editor MUST verificar tamaño máximo de 10 MB y MIME `image/jpeg`, `image/png`, `image/webp` o `image/gif`, y rechazar con un mensaje en español sin enviar ningún byte. Durante la subida MUST mostrar un marcador de progreso. El nodo persistido MUST referenciar el asset por su `storage_path` o identificador y MUST NOT almacenar la URL firmada. Al renderizar, la imagen MUST resolverse mediante una URL de lectura firmada.

#### Scenario: Subida y renderizado (e2e)

- GIVEN una página abierta
- WHEN el usuario inserta una imagen PNG de 2 MB
- THEN la imagen se muestra en el editor, persiste y se vuelve a mostrar tras recargar

#### Scenario: Archivo demasiado grande (unit)

- GIVEN un archivo de 12 MB
- WHEN el usuario intenta insertarlo
- THEN el editor muestra un mensaje de límite en español y no solicita permiso de subida

#### Scenario: Nodo sin URL firmada (unit)

- GIVEN una imagen insertada
- WHEN se serializa el documento
- THEN el nodo contiene la referencia al asset y ninguna URL con firma o fecha de expiración

### Requirement: Puerto de guardado como única dependencia hacia `notebooks`

`editor` MUST acceder a `notebooks` solo a través de su `index.ts` público, mediante un puerto de guardado que expone guardar contenido y obtener la versión vigente. `editor` MUST NOT importar `infrastructure` de ningún módulo. Tiptap, ProseMirror y sus extensiones MUST importarse solo desde `src/modules/editor/ui`.

#### Scenario: Grafo conforme (unit)

- GIVEN el módulo `editor` implementado
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0

#### Scenario: Import de Tiptap fuera de `ui` (unit)

- GIVEN un archivo de `src/modules/editor/domain` que importa `@tiptap/core`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla violada

### Requirement: Apariencia y copy del editor

Los bloques, el menú `/` y los estados de guardado MUST usar los tokens del sistema de diseño (DM Sans, JetBrains Mono para código, radios y sombras declarados) sin códigos hexadecimales en línea. Todo texto visible MUST estar en español con "tú", en oración con minúscula inicial y sin emoji. El editor MUST cumplir foco visible y respetar `prefers-reduced-motion`.

#### Scenario: Revisión de textos del editor (e2e)

- GIVEN el editor con el menú `/` abierto
- WHEN se revisan las etiquetas y estados visibles
- THEN están en español con "tú", sin Title Case y sin emoji

#### Scenario: Ausencia de valores literales (unit)

- GIVEN los componentes de `editor/ui`
- WHEN se inspeccionan sus clases y estilos
- THEN no contienen códigos hexadecimales en línea
