## Exploration: Fase 0 — Cimientos de Cogni

### Current State

- El repositorio **no contiene código de aplicación**. Confirmado con `git rev-parse --show-toplevel` y listado de directorio: solo existen `docs/`, `openspec/`, `.agents/`, `.atl/`, `.git/` y `.gitignore`. No hay `package.json`, `src/`, ni ningún runner de tests instalado.
- `docs/documento-maestro.md` (v1.0.0, estado "Aprobado") es la fuente de verdad de producto, stack y arquitectura. `docs/adr/0001-decisiones-fundacionales.md` adopta ese documento íntegramente; cualquier cambio a sus decisiones requiere un ADR nuevo.
- `openspec/config.yaml` ya declara el stack, las convenciones y `strict_tdd: false`, con la nota explícita de que debe pasar a `true` cuando la Fase 0 deje `pnpm test` funcionando. `openspec/changes/` solo contiene la carpeta `archive/` vacía; esta exploración crea la primera carpeta de change (`phase-0-foundations`).
- `docs/design-system/` (README + `colors_and_type.css` + `preview/` + `ui_kits/app/`) aporta únicamente tokens visuales, tal como exige la skill `cogni-design`: no debe usarse para derivar alcance, módulos ni arquitectura.

### Verified, current setup facts (Context7, consulta 2026-09-14)

1. **Next.js** — `pnpm create next-app@latest --yes` activa por defecto TypeScript, Tailwind CSS, ESLint, App Router, Turbopack y el alias `@/*`, e incluye `AGENTS.md`/`CLAUDE.md`. El App Router tiene React Strict Mode activo por defecto desde Next.js 13.5.1 (no requiere configuración manual). El corpus de documentación indexa versiones hasta `v16.2.9`; el documento maestro (§4) exige no fijar versión aquí, así que la versión exacta se resuelve en el momento de aplicar (`pnpm create next-app@latest`) y debe reverificarse entonces.
2. **Tailwind v4** — configuración *CSS-first*: no hace falta `tailwind.config.js`; los tokens se declaran con `@theme { --color-...: ... }` dentro del archivo CSS que ya tiene `@import "tailwindcss"`. Un archivo JS de config sigue siendo cargable vía `@config`, pero no es necesario para Cogni.
3. **shadcn/ui** — el paquete de CLI se renombró de `shadcn-ui` a `shadcn`; se invoca con `npx shadcn@latest init`, ofrece selector de plantilla (Next.js entre otras) y genera `components.json` donde el campo `tailwind.config` se deja vacío en proyectos v4 (no hay archivo de config al que apuntar). La bandera `--defaults` aplica el preset de tema `base-nova`, que **no** debe usarse porque compite con los tokens propios de Cogni.
4. **Drizzle + Supabase Postgres** — conexión con `drizzle-orm/postgres-js` + driver `postgres`; si se usa el connection string agrupado (*pooler*) de Supabase en modo "Transaction", es obligatorio `prepare: false` en el cliente `postgres.js` porque ese modo no soporta prepared statements. Migraciones con `drizzle-kit generate`; `migrations.prefix: 'supabase'` en `drizzle.config.ts` genera nombres de archivo con prefijo de timestamp compatibles con la convención de Supabase.
5. **`@supabase/ssr`** — `createServerClient`/`createBrowserClient` reciben un adaptador `cookies: { getAll, setAll }`; el patrón de middleware refresca la sesión con `supabase.auth.getClaims()`/`getSession()` antes de que corran los route handlers. Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } })` seguido de `redirect(data.url)` desde una Server Action.
6. **Biome** — instalación con `pnpm add -D --save-exact @biomejs/biome`; `biome.json` soporta `formatter`, `linter.rules` (recomendadas por defecto), `vcs: { clientKind: "git", useIgnoreFile: true }` y `assist.actions.source.organizeImports`.
7. **Vitest** — configuración en `vite.config.ts` (con `/// <reference types="vitest/config" />`) o en `vitest.config.ts` independiente. El stack de *browser mode* que la documentación actual recomienda (`@vitejs/plugin-react` + `@vitest/browser-playwright` + `vitest-browser-react`) es una alternativa moderna; el documento maestro (§4.4) pide explícitamente Testing Library, así que la Fase 0 debe usar el combo clásico jsdom/happy-dom + `@testing-library/react` + `@testing-library/jest-dom` (API estable, no requirió reverificación adicional).
8. **Playwright** — `playwright.config.ts` usa `webServer: { command, url, reuseExistingServer: !process.env.CI }` para levantar la app antes de correr specs; `projects` selecciona navegadores (Chromium primero, acorde a "3 a 5 flujos críticos").
9. **Sentry** — paquete `@sentry/nextjs`; el setup de App Router usa `instrumentation-client.ts` para el SDK de cliente y un `global-error.tsx` raíz que llama `Sentry.captureException` dentro de un componente `"use client"`.
10. **PostHog** — lado cliente con `posthog-js` envuelto en un `PostHogProvider` (`@posthog/react`) inicializado en `app/providers.tsx` y montado en el layout raíz; lado servidor con `posthog-node`, instanciado por request con `flushAt: 1, flushInterval: 0` porque las funciones serverless son de vida corta.

### Affected Areas

Al no existir código, estas son las áreas que la Fase 0 debe **crear** (no modificar), según la sección 5.4 del documento maestro:

- `src/app/` — rutas públicas, shell autenticado y route handlers (incluye el de keep-alive).
- `src/modules/identity/` y `src/modules/shared/` — únicos módulos con código real en Fase 0.
- `src/modules/{notebooks,editor,ingestion,ai,study-engine,flashcards,exams,active-recall,scheduling,analytics}/` — esqueletos de carpeta, sin lógica.
- `drizzle/` — migración inicial de `profiles`.
- `.github/workflows/` — pipeline de CI (y posiblemente el cron de keep-alive).
- `openspec/config.yaml` — actualizar `strict_tdd: true` y `projects: []` al cierre de la fase.

### Approaches

1. **`create-next-app` y luego reorganizar** — generar el proyecto con el CLI oficial y mover/ajustar la salida a la estructura de 5.4.
   - Pros: TypeScript, Tailwind, ESLint y Turbopack quedan configurados correctamente desde el inicio; menor riesgo de desalinearse con las convenciones oficiales de Next.js; `AGENTS.md`/`CLAUDE.md` generados sirven de referencia.
   - Cons: genera archivos que hay que mover o borrar (ESLint se reemplaza por Biome, hay que decidir si se conserva o se retira); el diff inicial mezcla boilerplate generado con reestructuración manual, lo que complica contar líneas "autoría" para el presupuesto de 400 líneas.
   - Esfuerzo: Bajo.

2. **Scaffold manual** — escribir `package.json`, configuración de Next.js, TS y Tailwind a mano desde cero.
   - Pros: control total sobre cada archivo desde el primer commit; ningún archivo generado que limpiar.
   - Cons: alto riesgo de desalinearse con defaults oficiales (alias de imports, Turbopack, `tsconfig` estricto); mucho más tiempo y superficie de error en una fase que debe ser rápida.
   - Esfuerzo: Alto.

**Recomendación**: opción 1 (`create-next-app` y reorganizar). Es el camino oficial, verificado con Context7, y el reordenamiento hacia la estructura de 5.4 es mecánico.

### Module Skeleton Plan

Dos variantes evaluadas para los 11 módulos de `src/modules/`:

- **Esqueleto completo** — las 11 carpetas con `domain/application/infrastructure/ui/index.ts` desde el día uno; solo `identity` y `shared` llevan código real, el resto lleva `index.ts` vacío (`export {}`) más un `README.md` que indica "Pendiente: Fase N".
- **Mínimo** — solo se crean `identity` y `shared`; el resto de módulos se crea recién en su propia fase.

**Recomendación**: esqueleto completo. La sección 5.4 dibuja el árbol de los 11 módulos como parte del entregable "repositorio con estructura de 5.4" de la Fase 0, y tener la forma desde el inicio evita renegociar la estructura en cada fase futura y le da a la regla de dependencias (5.3) carpetas reales sobre las que aplicar verificación en CI. El riesgo de "código muerto" se mitiga con `index.ts` vacío + README explícito, no con lógica de negocio placeholder.

### Dependency-Rule Enforcement

El documento maestro (§5.3, punto 7) ya nombra la alternativa: "reglas de Biome o... test de arquitectura (dependency-cruiser)".

- **Biome solo** (`noRestrictedImports` por archivo) — cubre casos puntuales pero no expresa bien reglas por patrón de ruta (`domain` no importa `infrastructure` de ningún módulo, un módulo solo se importa vía su `index.ts`).
- **dependency-cruiser** — herramienta dedicada a reglas de arquitectura por regex de ruta, corre como paso propio de CI, genera grafo de dependencias.
- **eslint-plugin-boundaries** — requiere ESLint, lo que contradice la decisión cerrada "Biome, una sola herramienta" (§4.1).

**Recomendación**: dependency-cruiser como paso adicional de CI (no reemplaza a Biome, solo agrega el chequeo de arquitectura), con reglas para las 6 restricciones de 5.3: `domain` no importa infraestructura/Next/React, `application` no importa `infrastructure`/`ui`, un módulo solo se importa vía su `index.ts`, y `study-engine` no importa ninguna técnica.

### Environment Variables (validadas con Zod, §9)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor, Supabase Auth/Storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; nunca al cliente |
| `DATABASE_URL` (pooler) | Drizzle, `prepare: false` en transaction mode |
| `NEXT_PUBLIC_SITE_URL` | Redirect de OAuth, enlaces de verificación de correo |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Errores servidor/cliente |
| `SENTRY_AUTH_TOKEN` | Solo CI, subida de source maps |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Analítica cliente y servidor |
| `CRON_SECRET` | Autenticación del route handler de keep-alive |

Todas se validan centralizadamente en `shared/config` con Zod al arranque, ninguna clave de proveedor llega al cliente salvo las explícitamente `NEXT_PUBLIC_*`.

### Supabase Keep-Alive (decisión pendiente)

Trigger.dev no está disponible hasta la Fase 3 (§13). Dos formas de cubrir el `select 1` diario de la sección 10.3 en Fase 0:

- **Vercel Cron Jobs** (Hobby permite 1 cron/día) invocando un route handler `app/api/keep-alive/route.ts` que ejecuta `select 1` vía Drizzle. Vercel firma la petición del cron; no requiere exponer secretos adicionales.
- **GitHub Actions con `schedule: cron`** haciendo `curl` autenticado (bearer `CRON_SECRET`) contra el mismo route handler.

**Marcado explícitamente como decisión abierta**: se recomienda Vercel Cron por simplicidad (sin duplicar secretos entre GitHub y Vercel), pero la elección final debe confirmarse con el usuario antes de `sdd-propose`.

### Work Split for Auto-Chain Delivery

El presupuesto de revisión es 400 líneas por PR (`openspec/config.yaml`, regla `tasks`). Fase 0 lo excede; propuesta de corte en 4 PRs encadenadas:

| PR | Contenido | Estimado (líneas) |
|---|---|---|
| 1 — Scaffold y tooling | `create-next-app`, reorganización a 5.4, Tailwind v4 + tokens Cogni, Biome, TS estricto, `pnpm` fijado | ~300–350 |
| 2 — Design tokens + shell | `shadcn init`, componentes base, shell autenticado (sidebar/topbar), esqueleto de los 11 módulos | ~250–350 |
| 3 — Supabase Auth + Drizzle | esquema `profiles`, migración inicial, `@supabase/ssr` (cliente/servidor/middleware), registro/login/callback, Google OAuth, verificación de correo | ~350–400 (posible sub-corte 3a auth / 3b Drizzle si crece) |
| 4 — Observabilidad + CI + deploy | Sentry, PostHog, GitHub Actions, dominio en Cloudflare apuntado a Vercel, route handler de keep-alive | ~250–300 |

Nota: el PR 1 incluye boilerplate generado por `create-next-app`; `sdd-tasks` debe pronosticar si ese volumen cuenta como riesgo de 400 líneas o si se trata como scaffolding excluible, y decidirlo explícitamente en el forecast.

### Open Product Decisions (el orchestrator debe confirmarlas con el usuario)

1. Nombre de dominio a comprar en Cloudflare.
2. Si la Fase 0 despliega una landing pública o solo pantallas de auth (el criterio de "hecho" de §13 solo exige registro/verificación/login/shell vacío, no landing).
3. Nomenclatura de los proyectos Supabase de desarrollo y producción (el plan free permite 2 proyectos activos).
4. Si Google OAuth es obligatorio para el criterio de "hecho" de la Fase 0 o puede diferirse si la configuración de Google Cloud Console bloquea el avance.
5. Remitente de correo de verificación: SMTP por defecto de Supabase (limitado en volumen, remitente genérico) vs. SMTP/dominio propio configurado desde ya.

### Recommendation

Escalar directo a `sdd-propose` con: scaffold vía `create-next-app` + reorganización, esqueleto completo de los 11 módulos (solo `identity`/`shared` con código real), dependency-cruiser en CI, y las 5 decisiones de producto resueltas antes o durante la propuesta. El corte en 4 PRs encadenadas debe formalizarse en `sdd-tasks` con el forecast de líneas exigido por la guía de revisión.

### Risks

- **Deriva de versiones**: el corpus de Context7 indexa Next.js hasta v16.x; la versión real que resuelva `pnpm create next-app@latest` en el momento de aplicar puede diferir y debe reverificarse en `sdd-apply`, no asumirse desde esta exploración.
- **Renombre del CLI de shadcn**: el paquete pasó de `shadcn-ui` a `shadcn`; usar el nombre viejo produce un CLI desactualizado o inexistente.
- **`prepare: false` en Drizzle+Supabase**: omitirlo bajo el pooler en modo "Transaction" rompe las queries de forma silenciosa o con errores confusos.
- **Google OAuth depende de Google Cloud Console** (pantalla de consentimiento, URIs de redirect, posible verificación) — riesgo real y externo al criterio de "hecho" de la Fase 0.
- **Pausa de Supabase Free tras 7 días de inactividad** — el keep-alive debe quedar operativo antes de la primera ventana de pausa tras el deploy.
- **Secuencia del flip de `strict_tdd`**: cambiarlo a `true` antes de que `pnpm test` funcione bloquearía indebidamente `sdd-apply`; debe ser el último paso de la Fase 0.
- **Preset `--defaults` de shadcn** (tema `base-nova`) compite con los tokens propios de Cogni; debe evitarse explícitamente y usar `--css-variables` con mapeo manual de `colors_and_type.css`.

### Ready for Proposal

**Sí.** Hay suficientes hechos verificados, enfoques comparados y decisiones identificadas para avanzar a `sdd-propose`. Se recomienda al orchestrator presentar al usuario las 5 decisiones de producto abiertas (dominio, landing pública, nombres de proyectos Supabase, obligatoriedad de Google OAuth, remitente de correo) antes de cerrar la propuesta, y llevar a diseño los dos riesgos técnicos más críticos (nombre del CLI de shadcn, `prepare: false` de Drizzle).
