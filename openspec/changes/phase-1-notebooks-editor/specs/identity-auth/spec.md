# identity-auth Specification (Delta)

## MODIFIED Requirements

### Requirement: Tabla `profiles` con creación automática

MUST existir una migración Drizzle versionada que cree `profiles` con `id` (igual a `auth.users.id`, con clave foránea `profiles.id` → `auth.users.id`), `display_name`, `locale` con valor por defecto `es`, `timezone` (IANA), `onboarding_completed_at`, `created_at` y `updated_at`. La fila MUST crearla el caso de uso idempotente `EnsureProfile` de la capa `application`, invocado en la primera petición autenticada (layout de `(app)`), mediante un upsert que no falla si la fila ya existe. NO se usa un trigger sobre `auth.users`: ese esquema no lo gestiona Drizzle y el caso de uso debe ser testeable con un repositorio en memoria. `EnsureProfile` MUST tolerar y recuperarse de un fallo transitorio del repositorio (por ejemplo una escritura concurrente) sin dejar al usuario sin perfil ni bloquear el acceso al shell en el siguiente intento.

#### Scenario: Perfil creado en la primera petición autenticada (unit)

- GIVEN un usuario recién verificado (por correo o por Google) sin fila en `profiles`
- WHEN accede por primera vez a una ruta del grupo `(app)`
- THEN `EnsureProfile` crea una fila en `profiles` con el mismo `id` y `locale` igual a `es`

#### Scenario: Registro repetido sin duplicar perfil (unit)

- GIVEN un usuario con perfil existente
- WHEN inicia sesión varias veces
- THEN sigue existiendo exactamente una fila en `profiles` para ese `id`

#### Scenario: Fila huérfana rechazada por la clave foránea (db smoke)

- GIVEN un `id` que no existe en `auth.users`
- WHEN se intenta insertar una fila en `profiles` con ese `id`
- THEN la base de datos rechaza la inserción por violación de la clave foránea

#### Scenario: Migración rechaza borrar perfiles cuando auth.users está vacío (db smoke)

- GIVEN `auth.users` sin filas y `profiles` con filas
- WHEN corre el bloque de guarda de la migración 0002
- THEN falla con una excepción y no borra nada

#### Scenario: Escritura concurrente resuelta por el upsert (unit)

- GIVEN dos invocaciones concurrentes de `EnsureProfile` para el mismo usuario sin fila previa
- WHEN ambas ejecutan el upsert
- THEN una completa la creación, la otra no falla el flujo del usuario y al final existe exactamente una fila para ese `id`

### Requirement: Sesión por cookies con refresco en middleware

La sesión MUST gestionarse con cookies a través de `@supabase/ssr` con adaptador `getAll`/`setAll`, y el middleware (proxy) MUST refrescarla antes de ejecutar route handlers y Server Actions. El gateway de sign-in (Server Action) MUST exponer el `userId` de la sesión resultante en su valor de retorno, para que los casos de uso de `notebooks` reciban el `ownerId` sin una segunda consulta a Supabase Auth.

#### Scenario: Refresco de token expirado (e2e)

- GIVEN una sesión con token de acceso expirado y refresh token válido
- WHEN el usuario navega a una ruta protegida
- THEN el middleware refresca la sesión y la navegación continúa sin pedir credenciales

#### Scenario: Gateway de sign-in expone `userId` (unit)

- GIVEN credenciales válidas de un usuario verificado
- WHEN se invoca la Server Action de inicio de sesión
- THEN el valor de retorno incluye el `userId` de la sesión establecida

### Requirement: Cierre de sesión

El sistema MUST cerrar la sesión e invalidar las cookies de sesión. La Server Action de cierre de sesión MUST manejar explícitamente el resultado de la llamada a Supabase (éxito o error) y MUST NOT dar por cerrada la sesión en la UI si Supabase reporta un error.

#### Scenario: Cierre exitoso (e2e)

- GIVEN un usuario con sesión activa
- WHEN solicita cerrar sesión
- THEN las cookies de sesión se eliminan y queda en la pantalla de inicio de sesión

#### Scenario: Error al cerrar sesión no se oculta (unit)

- GIVEN una llamada de cierre de sesión que Supabase rechaza con error
- WHEN se invoca la Server Action de cierre de sesión
- THEN la acción devuelve el error y la UI no asume que la sesión terminó

### Requirement: Autorización por propiedad en la capa de aplicación

Cada caso de uso MUST recibir el `ownerId` de la sesión y filtrar por él. MUST NOT existir acceso a datos de otro usuario. El repositorio de `profiles` MUST exponer una semántica de upsert explícita (crear si no existe, no sobrescribir campos no provistos si ya existe) usada por `EnsureProfile`.

#### Scenario: Lectura de perfil ajeno (unit)

- GIVEN dos usuarios autenticados distintos
- WHEN uno solicita el perfil del otro por su identificador
- THEN el caso de uso devuelve un error de dominio y ningún dato

#### Scenario: Upsert no sobrescribe campos existentes (unit)

- GIVEN un perfil existente con `display_name` definido
- WHEN `EnsureProfile` ejecuta su upsert de nuevo para ese `id`
- THEN el `display_name` existente se conserva sin cambios
