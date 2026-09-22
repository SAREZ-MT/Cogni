# observability-and-delivery Specification (Delta)

## MODIFIED Requirements

### Requirement: Entorno validado con Zod al arranque

`src/shared/config` MUST validar con Zod las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor), `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (solo CI), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` y `CRON_SECRET`, y a partir de esta fase también `TRIGGER_SECRET_KEY` (solo servidor, requerida, no vacía) y `SUPABASE_PDF_BUCKET` (solo servidor, requerida, no vacía). `TRIGGER_ACCESS_TOKEN` es un secreto exclusivo de CI para el deploy de tareas y MUST NOT ser requerido por el esquema de arranque de la aplicación. La validación MUST fallar al arranque si falta o es inválida alguna variable requerida.
(Previously: no existían `TRIGGER_SECRET_KEY` ni `SUPABASE_PDF_BUCKET`; se agregan como requeridas de servidor y se aclara que `TRIGGER_ACCESS_TOKEN` es solo de CI.)

#### Scenario: Entorno completo

- GIVEN todas las variables requeridas presentes y válidas
- WHEN arranca la aplicación
- THEN la validación pasa y expone la configuración tipada

#### Scenario: Variable ausente

- GIVEN `DATABASE_URL` sin definir
- WHEN arranca la aplicación
- THEN el arranque falla con un error que nombra la variable faltante

#### Scenario: Secretos no expuestos al cliente

- GIVEN la configuración validada
- WHEN se importa desde un componente de cliente
- THEN solo están accesibles las variables `NEXT_PUBLIC_*`

#### Scenario: Variables de la fase 2 ausentes (unit)

- GIVEN `TRIGGER_SECRET_KEY` o `SUPABASE_PDF_BUCKET` sin definir
- WHEN se evalúa el esquema de entorno del servidor
- THEN la validación falla nombrando la variable faltante

#### Scenario: `TRIGGER_ACCESS_TOKEN` no requerido en ejecución (unit)

- GIVEN un entorno completo sin `TRIGGER_ACCESS_TOKEN`
- WHEN se evalúa el esquema de entorno del servidor
- THEN la validación pasa

### Requirement: Analítica con eventos explícitos

PostHog MUST inicializarse en cliente y servidor y MUST registrar únicamente eventos declarados. En la fase 0 los eventos son `user_signed_up` y `user_signed_in`; a partir de esta fase se agrega `pdf_imported` (documento maestro §10.3). `pdf_imported` MUST emitirse desde el servidor exactamente una vez por `ImportJob`, en el momento en que el job alcanza un estado terminal, con las propiedades `page_count` (entero o nulo), `pages_without_text` (entero), `duration_ms` (milisegundos entre la creación del job y la transición terminal) y `status` (`done` o `failed`), sin el nombre del archivo ni contenido de la página. La emisión MUST NOT depender de que el navegador del usuario esté abierto. La autocaptura masiva MUST estar desactivada.
(Previously: solo `user_signed_up` y `user_signed_in`; se agrega `pdf_imported` con sus propiedades y su punto de emisión.)

#### Scenario: Registro exitoso emite evento

- GIVEN PostHog configurado
- WHEN un usuario completa el registro
- THEN se envía exactamente un evento `user_signed_up`

#### Scenario: Sin autocaptura

- GIVEN la aplicación en ejecución
- WHEN el usuario navega e interactúa con el shell
- THEN no se envían eventos distintos de los declarados

#### Scenario: Importación terminada emite `pdf_imported` (unit)

- GIVEN un job que pasa a `done` con `page_count` 30 y `pages_without_text` 2
- WHEN se registra la transición
- THEN el doble de analítica recibe exactamente un evento `pdf_imported` con `page_count` 30, `pages_without_text` 2, `status` `done` y un `duration_ms` mayor o igual que 0, sin ninguna propiedad con el nombre del archivo

#### Scenario: Importación fallida emite `pdf_imported` con `status` `failed` (unit)

- GIVEN un job que pasa a `failed`
- WHEN se registra la transición
- THEN el doble de analítica recibe exactamente un evento `pdf_imported` con `status` `failed`

#### Scenario: Reintento no duplica el evento (unit)

- GIVEN un job ya en `done` cuyo evento fue emitido
- WHEN la ejecución se repite
- THEN no se envía un segundo evento `pdf_imported`

### Requirement: Pipeline en `main` con migraciones antes del deploy

El workflow de `main` MUST ejecutar los pasos del pull request, además Playwright contra el despliegue de preview. `drizzle migrate` MUST aplicarse dentro del build command de Vercel (`vercel.json` o el build command configurado en el dashboard), no como un job de workflow posterior al deploy, y únicamente cuando el build es de producción (`VERCEL_ENV === "production"`); un build de Preview de cualquier rama MUST NOT ejecutar migraciones. El build de Vercel MUST fallar de forma segura (fail-closed) si la migración falla, dejando el despliegue anterior activo. A partir de esta fase, `main.yml` MUST incluir además un job de deploy de las tareas de Trigger.dev al entorno de producción que se ejecute únicamente cuando el push a `main` modifica `src/trigger/**`, `trigger.config.ts`, `package.json` o `pnpm-lock.yaml`, que use el secreto `TRIGGER_ACCESS_TOKEN`, que dependa del job `verify` y cuyo fallo MUST fallar el workflow. El job `e2e` de `main.yml` MUST disponer de `TRIGGER_SECRET_KEY` del entorno dev de Trigger.dev y de `SUPABASE_PDF_BUCKET`, y durante su ejecución la tarea de importación MUST estar disponible para ejecutar runs de ese entorno, de modo que el spec de importación real corra contra Trigger.dev dev y `cogni-dev`. `pr.yml` MUST NOT recibir secretos de Trigger.dev ni ejecutar importaciones reales.
(Previously: sin deploy de Trigger.dev ni secretos de importación; se agrega el job de deploy gated por rutas y los secretos del e2e de importación.)

#### Scenario: Build de Vercel aplica migraciones (db smoke)

- GIVEN un push a `main` con una migración pendiente
- WHEN Vercel ejecuta el build command
- THEN `drizzle migrate` corre antes de que el build compile la aplicación y la migración queda aplicada en la base de datos del entorno correspondiente

#### Scenario: Migración fallida bloquea el build (db smoke)

- GIVEN una migración que falla al aplicarse
- WHEN Vercel ejecuta el build command en `main`
- THEN el build termina con error, no se genera un nuevo despliegue y el despliegue de producción anterior sigue activo

#### Scenario: Merge exitoso (e2e)

- GIVEN un merge a `main` sin migraciones pendientes con error
- WHEN corre el workflow y el build de Vercel
- THEN pasan los chequeos, pasa Playwright contra el preview, el build aplica las migraciones y luego se despliega producción

#### Scenario: Build de preview no ejecuta migraciones (unit)

- GIVEN `VERCEL_ENV` distinto de `production` y sin `RUN_DB_MIGRATIONS`
- WHEN corre el build
- THEN `drizzle-kit migrate` no se ejecuta y el build continúa

#### Scenario: Gate previo a producción (usuario)

- GIVEN un cambio que va a `main`
- WHEN se intenta hacer merge del pull request
- THEN la protección de rama de `main` exige que pasen los checks de `pr.yml` (`verify`, y `e2e` si el pipeline lo agrega) antes de permitir el merge

#### Scenario: Deploy de Trigger.dev solo con cambios en tareas (usuario)

- GIVEN un push a `main` que modifica `src/trigger/process-pdf-import.ts`
- WHEN corre `main.yml`
- THEN el job de deploy de Trigger.dev se ejecuta tras `verify` y la versión desplegada en el dashboard de Trigger.dev coincide con el commit

#### Scenario: Deploy de Trigger.dev omitido sin cambios en tareas (usuario)

- GIVEN un push a `main` que solo modifica `src/modules/notebooks/ui`
- WHEN corre `main.yml`
- THEN el job de deploy de Trigger.dev se omite y el resto del workflow corre normalmente

#### Scenario: E2E de importación real en `main` (e2e)

- GIVEN el job `e2e` de `main.yml` con los secretos de Trigger.dev dev y `cogni-dev`
- WHEN corre el spec de importación
- THEN la importación se ejecuta de verdad, el job llega a `done` y el spec pasa

#### Scenario: `pr.yml` sin secretos de Trigger.dev (unit)

- GIVEN el archivo `.github/workflows/pr.yml`
- WHEN se inspeccionan sus variables y secretos
- THEN no referencia `TRIGGER_SECRET_KEY` ni `TRIGGER_ACCESS_TOKEN` y no ejecuta Playwright

## ADDED Requirements

### Requirement: Captura en Sentry de importaciones fallidas

Cada transición de un `ImportJob` a `failed` MUST reportarse a Sentry desde el servidor con el `importJobId`, el `ownerId`, la categoría del fallo (descarga, PDF inválido, sin capa de texto, persistencia, tiempo agotado, encolado) y la excepción original cuando exista, sin incluir el contenido del PDF ni el nombre del archivo. Un fallo determinista por PDF sin capa de texto MUST reportarse con nivel de advertencia, no de error, para no generar alertas por comportamiento esperado.

#### Scenario: Fallo de infraestructura reportado (unit)

- GIVEN un job que pasa a `failed` por una excepción del adaptador de Storage
- WHEN se registra la transición
- THEN el doble de Sentry recibe un evento de nivel error con el `importJobId`, la categoría `download` y la excepción original

#### Scenario: PDF sin texto reportado como advertencia (unit)

- GIVEN un job que pasa a `failed` porque ninguna página tiene texto
- WHEN se registra la transición
- THEN el doble de Sentry recibe un evento de nivel advertencia con la categoría `no_text_layer` y sin el nombre del archivo

### Requirement: Espera del e2e por el estado del job

El spec de Playwright de importación MUST esperar a que el `ImportJob` alcance un estado terminal observando el estado que la interfaz muestra o consultando el estado del job, y MUST NOT considerar terminada la importación por la respuesta 2xx de una Server Action ni por cualquier POST exitoso. Los helpers de espera de acciones en `tests/e2e/` que hoy resuelven con cualquier POST 2xx MUST acotarse a la petición de la acción concreta que se disparó, de modo que un beacon de analítica u otra petición en vuelo no pueda resolver la espera.

#### Scenario: Espera por `done` y no por la respuesta de la acción (e2e)

- GIVEN el spec de importación con un PDF válido
- WHEN la Server Action de encolado responde 2xx
- THEN el spec sigue esperando hasta que la interfaz muestra el estado "listo" o el aviso de páginas sin texto y solo entonces verifica el contenido

#### Scenario: Helper de espera acotado (unit)

- GIVEN el helper de espera de acciones de `tests/e2e/`
- WHEN durante la espera llega una respuesta 2xx de una petición de analítica no relacionada
- THEN el helper no resuelve hasta recibir la respuesta de la acción esperada
