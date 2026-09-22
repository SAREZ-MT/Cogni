# observability-and-delivery Specification

## Purpose

Configuración validada de entorno, observabilidad con Sentry y PostHog, pipeline de CI en GitHub Actions, deploy en Vercel, cabeceras de seguridad, keep-alive diario de Supabase y cierre de la fase en `openspec/config.yaml`.

## Requirements

### Requirement: Entorno validado con Zod al arranque

`src/shared/config` MUST validar con Zod las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor), `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (solo CI), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` y `CRON_SECRET`. La validación MUST fallar al arranque si falta o es inválida alguna variable requerida.

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

### Requirement: Captura de errores con Sentry

Sentry MUST estar configurado para cliente, servidor y un `global-error` raíz que reporte la excepción.

#### Scenario: Error de servidor reportado

- GIVEN una Server Action que lanza una excepción no manejada
- WHEN se invoca
- THEN Sentry recibe el evento con entorno y versión

#### Scenario: Error de renderizado en cliente

- GIVEN un componente de cliente que lanza durante el renderizado
- WHEN el usuario abre la pantalla
- THEN se muestra la pantalla de `global-error` y Sentry recibe la excepción

### Requirement: Analítica con eventos explícitos

PostHog MUST inicializarse en cliente y servidor y MUST registrar únicamente eventos declarados. En la fase 0 los eventos son `user_signed_up` y `user_signed_in`. La autocaptura masiva MUST estar desactivada.

#### Scenario: Registro exitoso emite evento

- GIVEN PostHog configurado
- WHEN un usuario completa el registro
- THEN se envía exactamente un evento `user_signed_up`

#### Scenario: Sin autocaptura

- GIVEN la aplicación en ejecución
- WHEN el usuario navega e interactúa con el shell
- THEN no se envían eventos distintos de los declarados

### Requirement: Pipeline de integración continua en pull request

GitHub Actions MUST ejecutar en cada pull request, en este orden: `pnpm install --frozen-lockfile`, `biome ci`, `tsc --noEmit`, `vitest run`, dependency-cruiser y `pnpm audit --audit-level=high`. Cualquier paso fallido MUST fallar el workflow.

#### Scenario: Pull request conforme

- GIVEN una rama sin violaciones
- WHEN se abre un pull request
- THEN todos los pasos pasan y el workflow queda verde

#### Scenario: Violación de arquitectura

- GIVEN una rama con una importación que rompe la sección 5.3
- WHEN se abre un pull request
- THEN el paso de dependency-cruiser falla y el workflow queda rojo

#### Scenario: Vulnerabilidad alta

- GIVEN una dependencia con vulnerabilidad de severidad alta
- WHEN corre el workflow de pull request
- THEN `pnpm audit --audit-level=high` falla el workflow

### Requirement: Pipeline en `main` con migraciones antes del deploy

El workflow de `main` MUST ejecutar los pasos del pull request, además Playwright contra el despliegue de preview. `drizzle migrate` MUST aplicarse dentro del build command de Vercel (`vercel.json` o el build command configurado en el dashboard), no como un job de workflow posterior al deploy, y únicamente cuando el build es de producción (`VERCEL_ENV === "production"`); un build de Preview de cualquier rama MUST NOT ejecutar migraciones. El build de Vercel MUST fallar de forma segura (fail-closed) si la migración falla, dejando el despliegue anterior activo.

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

### Requirement: Despliegue en Vercel

La producción MUST desplegarse desde `main` por la integración Git de Vercel y cada rama MUST generar un despliegue de preview. Preview MUST apuntar al proyecto Supabase `cogni-dev` y producción a `cogni-prod`.

#### Scenario: Preview por rama

- GIVEN una rama con un pull request abierto
- WHEN se empuja un commit
- THEN Vercel publica un preview con las variables de `cogni-dev`

### Requirement: Cabeceras de seguridad

`next.config` MUST definir cabeceras de seguridad, incluyendo una CSP básica, para todas las respuestas de la aplicación.

#### Scenario: Cabeceras presentes

- GIVEN la aplicación desplegada
- WHEN se solicita cualquier página
- THEN la respuesta incluye las cabeceras de seguridad declaradas

### Requirement: Keep-alive autenticado de Supabase

MUST existir un route handler `GET /api/keep-alive` que exija `Authorization: Bearer $CRON_SECRET` y ejecute `select 1` contra la base de datos mediante Drizzle.

#### Scenario: Invocación autorizada

- GIVEN el handler desplegado
- WHEN se invoca con el encabezado `Authorization: Bearer $CRON_SECRET` correcto
- THEN responde 200 y la consulta `select 1` se ejecuta

#### Scenario: Invocación sin credencial

- GIVEN el handler desplegado
- WHEN se invoca sin el encabezado o con un valor incorrecto
- THEN responde 401 y no ejecuta ninguna consulta

### Requirement: Programación diaria del keep-alive

`vercel.json` MUST declarar un cron diario que invoque `/api/keep-alive`.

#### Scenario: Cron declarado

- GIVEN `vercel.json` en la raíz
- WHEN se inspecciona su sección de crons
- THEN contiene una entrada diaria hacia `/api/keep-alive`

### Requirement: Cierre de la fase en la configuración SDD

Como último paso de la fase, `openspec/config.yaml` MUST fijar `strict_tdd: true` y completar `projects` con el proyecto raíz y sus comandos. Este cambio MUST NOT aplicarse antes de que `pnpm test` pase.

#### Scenario: Cierre tras suite verde

- GIVEN `pnpm test` pasando en local y en CI
- WHEN se cierra la fase 0
- THEN `openspec/config.yaml` queda con `strict_tdd: true` y `projects` completo

#### Scenario: Cierre prematuro rechazado

- GIVEN `pnpm test` inexistente o fallando
- WHEN se intenta fijar `strict_tdd: true`
- THEN el cambio no se aplica y la tarea queda pendiente

### Requirement: Nonces de CSP

La cabecera de seguridad `Content-Security-Policy` MUST generar un nonce por petición mediante el proxy (middleware) y aplicarlo tanto en la cabecera como en cada `<script>` en línea que la aplicación renderice. MUST NOT usar `'unsafe-inline'` para scripts cuando el nonce está disponible.

#### Scenario: Nonce único por petición (unit)

- GIVEN dos peticiones distintas a la misma ruta
- WHEN el proxy genera la CSP de cada una
- THEN el nonce difiere entre ambas peticiones

#### Scenario: Script en línea sin nonce rechazado (e2e)

- GIVEN la aplicación desplegada con nonces de CSP activos
- WHEN un navegador intenta ejecutar un script en línea sin el nonce correcto
- THEN el navegador bloquea el script según la política reportada

### Requirement: `img-src` habilitado para Supabase Storage

La directiva `img-src` de la CSP y `images.remotePatterns` de `next.config` MUST incluir el host del bucket de Supabase Storage usado por `page-assets`, además de los orígenes ya declarados en la fase 0.

#### Scenario: Imagen de Storage se renderiza (e2e)

- GIVEN una página con una imagen subida a Storage
- WHEN el usuario abre la página
- THEN la imagen carga sin ser bloqueada por la CSP ni rechazada por `next/image`

### Requirement: Anclaje del proxy matcher a rutas de aplicación

El `matcher` del proxy (middleware) MUST anclar la exclusión de rutas de observabilidad con el patrón `monitoring(?:/|$)` en lugar de un prefijo sin ancla, de modo que rutas legítimas cuyo segmento comience con `monitoring` pero no correspondan a la ruta de observabilidad no queden excluidas por error.

#### Scenario: Ruta de observabilidad excluida (unit)

- GIVEN una petición a `/monitoring` o `/monitoring/algo`
- WHEN el proxy evalúa el `matcher`
- THEN la petición queda excluida del procesamiento del proxy

#### Scenario: Ruta con prefijo similar no excluida (unit)

- GIVEN una petición a `/monitoring-extra`
- WHEN el proxy evalúa el `matcher`
- THEN la petición NO queda excluida y el proxy la procesa normalmente

### Requirement: Evento `user_signed_in` en el callback de OAuth

El callback de Google OAuth MUST registrar el evento `user_signed_in` de PostHog tras establecer la sesión, con la misma disciplina de eventos declarados que `user_signed_up`.

#### Scenario: Inicio de sesión con Google emite evento (unit)

- GIVEN un callback de OAuth que establece sesión exitosamente
- WHEN el flujo completa
- THEN se envía exactamente un evento `user_signed_in`

### Requirement: Redirect del dominio apex

Las peticiones al dominio apex (sin subdominio `www`) MUST redirigirse de forma permanente al dominio canónico configurado en `NEXT_PUBLIC_SITE_URL`, preservando ruta y query string.

#### Scenario: Apex redirige al dominio canónico (e2e)

- GIVEN una petición al dominio apex con una ruta y query string
- WHEN el servidor procesa la petición
- THEN responde con una redirección permanente al dominio canónico con la misma ruta y query string
