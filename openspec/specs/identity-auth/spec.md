# identity-auth Specification

## Purpose

Autenticación e identidad del usuario con Supabase Auth: registro con verificación de correo, inicio y cierre de sesión, recuperación de contraseña, Google OAuth, sesión por cookies con `@supabase/ssr`, protección de rutas y tabla `profiles`.

## Requirements

### Requirement: Registro con verificación de correo obligatoria

El sistema MUST permitir registro con correo y contraseña y MUST exigir verificación del correo antes de conceder acceso al shell. El correo de verificación se envía con el SMTP por defecto de Supabase.

#### Scenario: Registro exitoso

- GIVEN un visitante sin cuenta
- WHEN envía el formulario de registro con correo y contraseña válidos
- THEN se crea el usuario en estado no verificado
- AND recibe un correo de verificación
- AND ve una pantalla que le pide revisar su bandeja

#### Scenario: Acceso antes de verificar

- GIVEN un usuario registrado y no verificado
- WHEN intenta iniciar sesión
- THEN el acceso se rechaza con un mensaje que le indica verificar su correo

#### Scenario: Correo ya registrado

- GIVEN un correo con cuenta existente
- WHEN se envía el formulario de registro con ese correo
- THEN se muestra un mensaje amable que ofrece iniciar sesión

#### Scenario: Enlace de verificación consumido

- GIVEN un usuario no verificado con su enlace de verificación
- WHEN abre el enlace
- THEN queda verificado y con sesión iniciada en el shell

### Requirement: Inicio de sesión con correo y contraseña

El sistema MUST autenticar usuarios verificados por correo y contraseña.

#### Scenario: Credenciales válidas

- GIVEN un usuario verificado
- WHEN envía credenciales correctas
- THEN obtiene sesión y llega al shell autenticado

#### Scenario: Credenciales inválidas

- GIVEN un usuario verificado
- WHEN envía una contraseña incorrecta
- THEN el acceso se rechaza sin revelar si el correo existe

### Requirement: Cierre de sesión

El sistema MUST cerrar la sesión e invalidar las cookies de sesión.

#### Scenario: Cierre exitoso

- GIVEN un usuario con sesión activa
- WHEN solicita cerrar sesión
- THEN las cookies de sesión se eliminan y queda en la pantalla de inicio de sesión

### Requirement: Recuperación de contraseña

El sistema MUST permitir solicitar un enlace de restablecimiento y definir una contraseña nueva.

#### Scenario: Restablecimiento completo

- GIVEN un usuario verificado que olvidó su contraseña
- WHEN solicita el restablecimiento y abre el enlace recibido
- THEN puede definir una contraseña nueva e iniciar sesión con ella

#### Scenario: Correo desconocido

- GIVEN un correo sin cuenta
- WHEN se solicita el restablecimiento
- THEN la respuesta es idéntica a la del caso válido y no revela la existencia de la cuenta

### Requirement: Inicio de sesión con Google OAuth

El sistema MUST ofrecer acceso con Google mediante `signInWithOAuth` y una ruta de callback que intercambia el código por sesión.

#### Scenario: Autorización concedida

- GIVEN un visitante en la pantalla de inicio de sesión
- WHEN elige continuar con Google y autoriza en Google
- THEN el callback establece la sesión y llega al shell

#### Scenario: Autorización cancelada

- GIVEN un visitante que inició el flujo de Google
- WHEN cancela en la pantalla de Google
- THEN vuelve al inicio de sesión con un mensaje neutro y sin sesión

### Requirement: Sesión por cookies con refresco en middleware

La sesión MUST gestionarse con cookies a través de `@supabase/ssr` con adaptador `getAll`/`setAll`, y el middleware MUST refrescarla antes de ejecutar route handlers y Server Actions.

#### Scenario: Refresco de token expirado

- GIVEN una sesión con token de acceso expirado y refresh token válido
- WHEN el usuario navega a una ruta protegida
- THEN el middleware refresca la sesión y la navegación continúa sin pedir credenciales

### Requirement: Protección de rutas

Las rutas del grupo `(app)` MUST requerir sesión. Un usuario con sesión que visite las rutas de autenticación MUST ser redirigido al shell.

#### Scenario: Visitante en ruta protegida

- GIVEN un visitante sin sesión
- WHEN abre una ruta del grupo `(app)`
- THEN es redirigido a la pantalla de inicio de sesión

#### Scenario: Usuario autenticado en ruta de autenticación

- GIVEN un usuario con sesión activa
- WHEN abre la pantalla de registro o de inicio de sesión
- THEN es redirigido al shell autenticado

### Requirement: Tabla `profiles` con creación automática

MUST existir una migración Drizzle versionada que cree `profiles` con `id` (igual a `auth.users.id`), `display_name`, `locale` con valor por defecto `es`, `timezone` (IANA), `onboarding_completed_at`, `created_at` y `updated_at`. La fila MUST crearla el caso de uso idempotente `EnsureProfile` de la capa `application`, invocado en la primera petición autenticada (layout de `(app)`), mediante un upsert que no falla si la fila ya existe. NO se usa un trigger sobre `auth.users`: ese esquema no lo gestiona Drizzle y el caso de uso debe ser testeable con un repositorio en memoria.

#### Scenario: Perfil creado en la primera petición autenticada

- GIVEN un usuario recién verificado (por correo o por Google) sin fila en `profiles`
- WHEN accede por primera vez a una ruta del grupo `(app)`
- THEN `EnsureProfile` crea una fila en `profiles` con el mismo `id` y `locale` igual a `es`

#### Scenario: Registro repetido sin duplicar perfil

- GIVEN un usuario con perfil existente
- WHEN inicia sesión varias veces
- THEN sigue existiendo exactamente una fila en `profiles` para ese `id`

### Requirement: Autorización por propiedad en la capa de aplicación

Cada caso de uso MUST recibir el `ownerId` de la sesión y filtrar por él. MUST NOT existir acceso a datos de otro usuario.

#### Scenario: Lectura de perfil ajeno

- GIVEN dos usuarios autenticados distintos
- WHEN uno solicita el perfil del otro por su identificador
- THEN el caso de uso devuelve un error de dominio y ningún dato

### Requirement: Validación de entradas y mensajes de error amables

Todo formulario y Server Action MUST validar su entrada con Zod antes de llegar a `application`, y los mensajes de error MUST estar en español con "tú", ser accionables y no exponer detalles técnicos.

#### Scenario: Entrada inválida

- GIVEN el formulario de registro
- WHEN se envía un correo con formato inválido
- THEN la validación falla en el servidor y se muestra un mensaje accionable en español

### Requirement: Clave de servicio fuera del cliente

`SUPABASE_SERVICE_ROLE_KEY` MUST usarse solo en servidor y MUST NOT aparecer en el bundle del cliente ni en variables `NEXT_PUBLIC_*`.

#### Scenario: Auditoría del bundle

- GIVEN la aplicación construida
- WHEN se inspecciona el bundle del cliente
- THEN no contiene la clave de servicio
