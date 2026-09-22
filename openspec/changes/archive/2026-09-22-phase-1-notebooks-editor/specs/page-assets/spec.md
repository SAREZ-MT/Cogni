# page-assets Specification

## Purpose

Pipeline de imágenes de página sobre Supabase Storage: bucket privado con RLS por `owner_id`, permisos de subida firmados de corta duración emitidos por el servidor, subida directa desde el navegador, registro de `PageAsset` vinculado a la página propietaria y URLs de lectura firmadas (documento maestro §6.1, §9). Los límites de tamaño y MIME se aplican en el servidor al emitir el permiso y de nuevo al persistir.

## Requirements

### Requirement: Bucket privado con RLS por propietario

MUST existir un bucket privado de Supabase Storage cuyo nombre se lee de la variable de entorno `SUPABASE_STORAGE_BUCKET` (solo servidor). Todo objeto MUST almacenarse bajo la ruta `{ownerId}/{pageId}/{assetId}.{ext}`. Las políticas RLS del bucket MUST permitir leer y escribir un objeto solo cuando el primer segmento de su ruta coincide con `auth.uid()`. MUST NOT existir acceso público ni anónimo. El bucket MUST configurarse con `file_size_limit` de 10 485 760 bytes y `allowed_mime_types` limitado a `image/jpeg`, `image/png`, `image/webp` e `image/gif`, de modo que Storage rechace bytes que no cumplan esos límites incluso con un permiso firmado válido.

#### Scenario: Subida que excede el límite del bucket rechazada (e2e)

- GIVEN un permiso firmado emitido para `image/png` de 2 MB
- WHEN el navegador sube un objeto de 11 MB o de otro tipo
- THEN Storage rechaza la subida y no existe el objeto

#### Scenario: Lectura entre usuarios denegada (e2e)

- GIVEN un asset subido por el primer usuario
- WHEN el segundo usuario solicita el objeto con su propia sesión de Storage
- THEN Storage responde con denegación y no entrega bytes

#### Scenario: Acceso anónimo denegado (e2e)

- GIVEN la ruta de un asset existente
- WHEN se solicita sin sesión
- THEN Storage responde con denegación

### Requirement: Permiso de subida firmado con límites del servidor

El caso de uso `RequestImageUpload` MUST recibir `ownerId`, `pageId`, `mime` y `sizeBytes`, verificar que la página está activa y pertenece al owner, verificar que `mime` es `image/jpeg`, `image/png`, `image/webp` o `image/gif` y que `sizeBytes` no supera 10 485 760 bytes, y devolver un permiso de subida firmado hacia la ruta canónica del asset con vigencia máxima de 10 minutos. Cualquier verificación fallida MUST devolver un `DomainError`. Este es el primer nivel de rechazo, sobre metadatos declarados por el cliente; los límites del bucket sobre los bytes reales son el segundo nivel.

#### Scenario: Permiso emitido (unit)

- GIVEN una página activa del usuario
- WHEN invoca `RequestImageUpload` con `image/png` y 2 MB
- THEN recibe un permiso firmado hacia `{ownerId}/{pageId}/{assetId}.png` con expiración de 10 minutos o menos

#### Scenario: MIME no permitido (unit)

- GIVEN una solicitud con `mime` `image/svg+xml`
- WHEN se invoca `RequestImageUpload`
- THEN el caso de uso devuelve un `DomainError` y no contacta a Storage

#### Scenario: Tamaño excedido (unit)

- GIVEN una solicitud de 10 485 761 bytes
- WHEN se invoca `RequestImageUpload`
- THEN el caso de uso devuelve un `DomainError` y no contacta a Storage

#### Scenario: Página ajena o archivada (unit)

- GIVEN un `pageId` de otro usuario o con `archived_at` definido
- WHEN se invoca `RequestImageUpload`
- THEN el caso de uso devuelve un `DomainError`

### Requirement: Subida directa desde el navegador

Los bytes de la imagen MUST viajar directamente del navegador a Storage usando el permiso firmado. Ninguna Server Action ni route handler de la aplicación MUST recibir ni almacenar en memoria el contenido del archivo. Las Server Actions del pipeline MUST transportar únicamente metadatos.

#### Scenario: Server Actions solo con metadatos (unit)

- GIVEN las Server Actions de solicitud de permiso y de registro de asset
- WHEN se inspecciona su esquema de entrada Zod
- THEN aceptan solo identificadores, `mime`, `sizeBytes` y `storagePath`, nunca datos binarios

#### Scenario: Subida completa (e2e)

- GIVEN un permiso emitido
- WHEN el navegador sube el archivo
- THEN el objeto existe en la ruta canónica y ningún registro de servidor muestra el cuerpo del archivo pasando por la aplicación

### Requirement: Registro de `PageAsset` con revalidación

El caso de uso `RegisterPageAsset` MUST recibir `ownerId`, `pageId`, `storagePath`, `mime` y `sizeBytes`, verificar de nuevo la propiedad de la página y que `storagePath` comienza con `{ownerId}/{pageId}/`, y persistir una fila de `page_assets`. MUST leer los metadatos reales del objeto en Storage a través del gateway y MUST rechazar con `DomainError` sin persistir cuando el objeto no existe, excede los límites o su content type no está permitido; el `mime`/`size_bytes` persistidos MUST provenir del objeto real, no de los valores declarados. Un registro repetido para el mismo `storagePath` MUST devolver la fila existente sin duplicarla.

#### Scenario: Registro exitoso (unit)

- GIVEN una subida completada con ruta canónica
- WHEN se invoca `RegisterPageAsset`
- THEN existe una fila con `page_id`, `storage_path`, con `mime` y `size_bytes` del objeto real

#### Scenario: Objeto real fuera de política (unit)

- GIVEN un `storagePath` cuyo objeto real mide 12 MB según el gateway
- WHEN se invoca `RegisterPageAsset` declarando 2 MB
- THEN devuelve un `DomainError` y no crea la fila

#### Scenario: Ruta fuera del prefijo del owner (unit)

- GIVEN un `storagePath` cuyo primer segmento no es el `ownerId` de la sesión
- WHEN se invoca `RegisterPageAsset`
- THEN el caso de uso devuelve un `DomainError` y no crea la fila

#### Scenario: Registro repetido (unit)

- GIVEN un asset ya registrado
- WHEN se invoca `RegisterPageAsset` con el mismo `storagePath`
- THEN se devuelve el asset existente y sigue habiendo una sola fila

### Requirement: URLs de lectura firmadas de corta duración

El caso de uso `GetAssetReadUrl` MUST emitir una URL firmada con vigencia máxima de 1 hora únicamente para assets cuyo `owner_id` coincide con el de la sesión. Un asset ajeno MUST producir un `DomainError`. Las URLs firmadas MUST NOT persistirse en el contenido de la página ni en la base de datos.

#### Scenario: URL emitida para asset propio (unit)

- GIVEN un asset del usuario
- WHEN invoca `GetAssetReadUrl`
- THEN recibe una URL firmada con expiración de 1 hora o menos

#### Scenario: Asset ajeno (unit)

- GIVEN un asset de otro usuario
- WHEN se invoca `GetAssetReadUrl`
- THEN el caso de uso devuelve un `DomainError` y ninguna URL

#### Scenario: URL expirada (e2e)

- GIVEN una URL firmada cuya vigencia venció
- WHEN se solicita
- THEN Storage responde con denegación

### Requirement: Renderizado de imágenes permitido por la configuración

`next.config` MUST incluir el host de Supabase Storage en `images.remotePatterns` y la directiva `img-src` de la CSP MUST permitir ese host, además de `'self'`, `data:` y `blob:` para las vistas previas locales.

#### Scenario: Imagen renderizada sin bloqueo (e2e)

- GIVEN una página con una imagen registrada
- WHEN el usuario la abre
- THEN la imagen se muestra y la consola del navegador no reporta violaciones de CSP

### Requirement: Assets de páginas archivadas

Archivar una página MUST NOT borrar sus objetos de Storage ni sus filas de `page_assets`. El borrado físico queda para un job de limpieza futuro.

#### Scenario: Página archivada conserva assets (unit)

- GIVEN una página con un asset registrado
- WHEN se invoca `ArchivePage`
- THEN la fila de `page_assets` sigue existiendo y el objeto de Storage no se elimina
