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

El workflow de `main` MUST ejecutar los pasos del pull request, además Playwright contra el despliegue de preview, y MUST aplicar `drizzle migrate` como paso explícito antes del deploy de producción.

#### Scenario: Merge exitoso

- GIVEN un merge a `main`
- WHEN corre el workflow
- THEN pasan los chequeos, pasa Playwright, se aplican las migraciones y luego se despliega producción

#### Scenario: Migración fallida

- GIVEN una migración que falla al aplicarse
- WHEN corre el workflow de `main`
- THEN el deploy de producción no se ejecuta

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
