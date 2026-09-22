# observability-and-delivery Specification (Delta)

## MODIFIED Requirements

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

## ADDED Requirements

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
