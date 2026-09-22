# notebooks Specification (Delta)

## MODIFIED Requirements

### Requirement: Ciclo de vida de la página

El sistema MUST permitir crear, renombrar y archivar páginas dentro de un cuaderno activo del mismo `owner_id`. Una página nueva MUST crearse con `title` "Sin título" cuando no se indica uno, `content` igual a un documento Tiptap vacío, `plain_text` vacío y `content_version` igual a `1`. Las reglas de `title` son las mismas del cuaderno. Una página creada por una importación de PDF MUST seguir exactamente las mismas reglas de creación (`title` derivado del nombre del archivo o "Sin título", `position` al final, `owner_id` de la sesión, `content_version` inicial `1`) y, una vez que la importación termina, MUST ser una página normal: se renombra, archiva, guarda con autosave y reconcilia conflictos igual que cualquier otra, sin ningún estado ni marca especial persistente en `pages`.
(Previously: no existía la creación de páginas por importación; se agrega que las páginas importadas siguen las mismas reglas y no tienen estado especial.)

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

#### Scenario: Página importada se comporta como cualquier otra (e2e)

- GIVEN una página cuya importación terminó en `done`
- WHEN el usuario escribe en el editor, la renombra desde el sidebar y luego la archiva
- THEN el autosave persiste el cambio incrementando `content_version`, el nuevo título aparece en el sidebar y la página desaparece al archivarla, sin ninguna diferencia respecto a una página creada a mano

### Requirement: Rutas de cuaderno y página

El grupo `(app)` MUST exponer una ruta de vista de cuaderno y una ruta de vista de página. La vista de cuaderno MUST listar las páginas activas del cuaderno y permitir crear una nueva. La vista de página MUST cargar `title`, `content` y `content_version` y alojar el editor. Un identificador inexistente, ajeno o archivado MUST producir la vista de no encontrado. Cuando la página tiene una importación de PDF en estado no terminal (`queued` o `processing`), la vista de página MUST mostrar el indicador de progreso de importación en lugar del editor y MUST NOT permitir editar el contenido hasta que el job llegue a un estado terminal; al llegar a `done` MUST cargar el contenido y la versión vigentes y mostrar el editor sin que el usuario recargue; al llegar a `failed` MUST mostrar el mensaje de error del job y el editor vacío para que la página siga siendo usable.
(Previously: la vista de página siempre alojaba el editor; se agrega el estado de importación en curso y su resolución a editor o error.)

#### Scenario: Vista de página carga la versión (e2e)

- GIVEN una página con contenido guardado
- WHEN el usuario abre su ruta
- THEN ve el título, el contenido renderizado en el editor y el editor conoce el `content_version` vigente

#### Scenario: Identificador inválido (e2e)

- GIVEN una URL de página con un identificador que no existe
- WHEN el usuario la abre
- THEN ve la vista de no encontrado en español

#### Scenario: Página con importación en curso (unit)

- GIVEN una página cuyo job está en `processing`
- WHEN el usuario abre su ruta
- THEN ve el indicador de progreso, no ve el editor y no existe ningún control para escribir contenido

#### Scenario: Transición a editor al terminar (e2e)

- GIVEN la vista de una página con importación en `processing`
- WHEN el job pasa a `done`
- THEN la vista muestra el editor con el contenido importado y el `content_version` vigente sin recargar la página

#### Scenario: Importación fallida deja la página usable (e2e)

- GIVEN la vista de una página con importación en curso
- WHEN el job pasa a `failed`
- THEN la vista muestra el mensaje de error del job y el editor vacío, y el usuario puede escribir y guardar

## ADDED Requirements

### Requirement: Creación de página con contenido inicial desde una importación

La API pública de `notebooks` (`index.ts`) MUST permitir que otro módulo cree una página en un cuaderno activo del owner y, más tarde, persista en ella un contenido inicial no vacío junto con su `plain_text` materializado en el servidor, respetando todas las reglas existentes: `ownerId` de la sesión o del job, cuaderno activo y propio, `content` con nodo raíz `doc`, `plain_text` calculado por la función pura de `domain` y nunca aceptado del llamador, y comparar-e-intercambiar de `content_version` de modo que la escritura solo tenga éxito si la página sigue en la versión con la que fue creada. La escritura del contenido inicial MUST ser una única operación atómica que deja la página con el contenido completo y `content_version` incrementado en uno, o no la modifica en absoluto. Ningún módulo distinto de `notebooks` MUST escribir en `pages` directamente.

#### Scenario: Contenido inicial persistido (unit)

- GIVEN una página recién creada en `content_version` 1 y un documento con un `heading` y dos `paragraph`
- WHEN se persiste el contenido inicial a través de la API pública con la versión esperada 1
- THEN la página queda con ese contenido, `content_version` 2 y `plain_text` igual al texto de los tres bloques separados por salto de línea

#### Scenario: Página ya modificada rechazada (unit)

- GIVEN una página en `content_version` 2
- WHEN se intenta persistir el contenido inicial con la versión esperada 1
- THEN la operación devuelve el `DomainError` de conflicto indicando la versión 2 y el contenido no cambia

#### Scenario: Contenido inválido rechazado (unit)

- GIVEN un contenido inicial sin nodo raíz `doc` o con un `plain_text` enviado por el llamador
- WHEN se intenta persistir
- THEN la validación falla con un `DomainError` y no se escribe nada

#### Scenario: Página o cuaderno ajenos (unit)

- GIVEN un `pageId` de otro usuario
- WHEN se intenta persistir el contenido inicial con el `ownerId` de la sesión
- THEN la operación devuelve un `DomainError` y la página no cambia

#### Scenario: Escritura solo por la API pública (unit)

- GIVEN el módulo `ingestion` implementado
- WHEN se ejecuta `pnpm depcruise`
- THEN ninguna importación de `ingestion` apunta a `modules/notebooks/infrastructure` ni a `shared/db` para escribir en `pages`, y el comando termina con código 0

### Requirement: Punto de entrada "Importar PDF" en el menú del cuaderno

El menú de acciones de cada cuaderno activo en el sidebar MUST ofrecer la acción "Importar PDF" como único punto de entrada de la importación (decisión 3). Al elegirla, la interfaz MUST abrir un selector de un solo archivo, validar el archivo en el cliente, solicitar el permiso de subida, subir el archivo directamente a Storage, encolar la importación y navegar a la página recién creada, en ese orden. Si cualquier paso falla antes del encolado, MUST NOT quedar ninguna página creada y el usuario MUST ver un mensaje en español. MUST NOT existir un punto de entrada dentro del editor ni en la vista de cuaderno.

#### Scenario: Importación desde el menú del cuaderno (e2e)

- GIVEN un cuaderno activo visible en el sidebar
- WHEN el usuario abre su menú, elige "Importar PDF" y selecciona un PDF válido
- THEN aparece una página nueva bajo ese cuaderno en el sidebar con el título derivado del archivo y la vista de página muestra el indicador de progreso

#### Scenario: Fallo de subida no deja página (e2e)

- GIVEN un permiso de subida emitido y una subida que Storage rechaza
- WHEN la interfaz recibe el rechazo
- THEN muestra un mensaje en español, no navega y el sidebar no muestra ninguna página nueva

#### Scenario: Sin entrada en el editor (unit)

- GIVEN el menú de comandos `/` del editor y la vista de cuaderno
- WHEN se inspeccionan sus acciones
- THEN ninguna ofrece importar PDF
