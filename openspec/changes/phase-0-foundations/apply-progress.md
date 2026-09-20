# Apply Progress: Fase 0 — Cimientos de Cogni

## Batch PR1 — Tooling (Phase 1, tasks 1.1–1.9) — mergeado en `main` (PR #1, 43f8757)

Rama: `feat/phase-0-pr1-tooling` (creada desde `main`). Sin commits creados en
este batch; el árbol de trabajo queda con todos los cambios sin confirmar
para que el humano revise y confirme la entrega.

## Tareas completadas

- [x] 1.1 Scaffold `create-next-app@16.3.5` (TypeScript, App Router, Tailwind v4, Biome, `src/`); reorganizado dentro del repo existente; `packageManager` y `engines.pnpm`/`engines.node` fijados en `package.json`.
- [x] 1.2 `tsconfig.json` con `strict: true` (heredado del scaffold oficial, sin modificar) y alias `@/*` → `src/*`; sin ESLint ni Prettier (ni configuración ni dependencias); Biome como única herramienta (`pnpm biome ci .`).
- [x] 1.3 Vitest + jsdom + Testing Library (`pnpm test`) y Playwright (`pnpm test:e2e`), ambos verificados con al menos un test real cada uno.
- [x] 1.4 `.dependency-cruiser.cjs` con las 6 reglas de §5.3 codificadas como `severity: error`; `pnpm depcruise` verde y las reglas verificadas activamente (ver "Verificación de las reglas de dependencia").
- [x] 1.5 Estructura de carpetas creada: `src/app/{(public),(app),api}`, `src/shared/{kernel,db,ui,config}`, `drizzle/`, `tests/e2e/`.
- [x] 1.6 TDD estricto: `result`, `domain-error`, `id`, `clock` en `src/shared/kernel/*`, cada uno con RED → GREEN → REFACTOR documentado (ver tabla de evidencia TDD).
- [x] 1.7 Los 10 módulos restantes de §5.4 (`notebooks`, `editor`, `ingestion`, `ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) con `index.ts` (`export {}`) y `README.md` indicando responsabilidad y fase pendiente.
- [x] 1.8 `src/modules/identity/{domain,application,infrastructure,ui}/index.ts` como placeholders (`export {}`), más `src/modules/identity/index.ts` como API pública del módulo (todos pendientes de PR3).
- [x] 1.9 Gate PR1: `install`, `biome ci .`, `tsc --noEmit`, `test`, `test:e2e`, `depcruise` — los 6 comandos terminan en verde (ver tabla de verificación).

## Decisiones tomadas

1. **`create-next-app --biome`**: se usó la bandera oficial `--biome` en vez de instalar Biome manualmente después; produjo `biome.json` ya configurado y evitó cualquier rastro de ESLint.
2. **`only-allow` + `preinstall`**: el requisito "cualquier otro gestor MUST fallar la instalación" (spec.md, "Instalación con otro gestor") se implementó con el patrón estándar `only-allow`: `"preinstall": "npx only-allow pnpm"` en `package.json` más `only-allow` como devDependency. Verificado invocando el binario directamente con `npm_config_user_agent` simulado (ver sección de verificación) en vez de correr `npm install` real, para no arriesgar corromper el `node_modules` administrado por pnpm.
3. **`"type": "module"` en `package.json`**: Vitest 5 advertía sobre el uso de sintaxis ESM en un archivo cargado como CommonJS. Se añadió `"type": "module"` y se ajustó `vitest.config.ts` para usar `import.meta.dirname` en vez de `__dirname`. No rompe Next.js (sus configs ya usan `export default`) ni el resto del tooling.
4. **`next typegen` como `postinstall`**: Next.js 16 requiere que `.next/types/**` exista para que tipos globales como `LayoutProps<'/'>` resuelvan; ese directorio es un artefacto de build (gitignorado). Se agregó `"postinstall": "next typegen"` para que un clon limpio (`pnpm install`) deje `pnpm tsc --noEmit` funcional sin pasos manuales adicionales.
5. **`biome.json` excluye `docs/`, `openspec/`, `.agents/`, `.atl/`, `pnpm-lock.yaml`**: por defecto Biome escanea `**`, lo que incluía los mocks HTML de `docs/design-system/ui_kits/` (más de 300 errores de accesibilidad en markup que no es código de la app). Se acotó `files.includes` a las carpetas que sí son código del proyecto.
6. **`id.ts` sin `BigInt`**: la implementación de UUID v7 originalmente usaba literales `BigInt` (`40n`, `0xffn`), pero el `tsconfig.json` oficial del scaffold fija `target: ES2017`, que no soporta literales BigInt. Se reescribió con aritmética de `Number` (división/módulo), válida porque un timestamp de 48 bits está muy por debajo de `Number.MAX_SAFE_INTEGER`. Se prefirió esto a subir el `target` del `tsconfig.json` para no desviarse del scaffold oficial de Next.js (decisión de diseño: "alias, Turbopack y `tsconfig` oficiales sin deriva").
7. **`pnpm test:e2e` usa `next build && next start` reales**: el `webServer` de Playwright ejecuta un build de producción real, no `next dev`, para que el gate de PR1 pruebe la app tal como se serviría en Vercel. `pnpm start -- -p <puerto>` no reenvía el flag correctamente a través del wrapper de pnpm (el proceso hijo recibía `-p` como si fuera el argumento de directorio); se resolvió invocando `next build`/`next start` directamente vía `pnpm exec`.
8. **`README.md` reescrito**: el `README.md` generado por `create-next-app` mencionaba npm/yarn/bun como alternativas válidas, lo cual contradice la decisión de pnpm único. Se reemplazó por un README corto y específico de Cogni (español neutro), enlazando a `docs/documento-maestro.md` como fuente de verdad.
9. **`.gitkeep` en carpetas vacías**: `src/app/(public)`, `src/app/(app)`, `src/app/api`, `src/shared/{db,ui,config}` y `drizzle/` quedan vacías hasta PR2/PR3/PR4; se añadió un `.gitkeep` en cada una para que Git las trackee (Git no versiona directorios vacíos). `src/shared/kernel` no lo necesita porque ya tiene contenido real.

## Desviaciones del diseño

Ninguna decisión de arquitectura del `design.md` fue contradicha. Las desviaciones anteriores son detalles de implementación no especificados por el diseño (versión de Node.js en `tsconfig`, manejo de BigInt, exclusiones de Biome) y no afectan ninguna decisión architecturalmente relevante del ADR 0001 ni de §5.3/§5.4.

## Verificación de las reglas de dependencia (más allá del gate verde)

Un `pnpm depcruise` verde sobre un esqueleto sin código real podría pasar
trivialmente sin que las reglas funcionen. Se verificó activamente cada regla
crítica creando una violación real, confirmando que `depcruise` la nombra y
falla, y luego revirtiendo el archivo temporal (no queda rastro en el árbol
de trabajo):

| Regla probada | Violación introducida | Resultado |
|---|---|---|
| `domain-no-npm` / `domain-is-pure` | `import "next";` dentro de `src/modules/identity/domain/` | `error domain-no-npm` + `error domain-is-pure`, exit code 2 |
| `cross-module-via-index` | import relativo resuelto desde `identity/domain` hacia un archivo interno de `notebooks/domain` (no via `index.ts`) | `error cross-module-via-index`, exit code 1 |

Tras cada prueba se eliminaron los archivos temporales y se confirmó
`pnpm depcruise` verde de nuevo (`git status --short` sin rastros).

## Tabla de verificación (gate PR1 / tarea 1.9)

| Comando | Resultado observado |
|---|---|
| `pnpm install` | Exit 0. `postinstall` ejecuta `next typegen` y genera `.next/types` correctamente. |
| `pnpm biome ci .` | Exit 0. "Checked 37 files ... No fixes applied." |
| `pnpm tsc --noEmit` | Exit 0. Sin salida (sin errores de tipos). |
| `pnpm test` | Exit 0. 5 archivos de test, 18 tests, todos verdes (17 del kernel + 1 de `page.test.tsx`). |
| `pnpm test:e2e` | Exit 0. 1 test de Chromium contra un build de producción real (`next build && next start`), verde en 4.6s. Playwright/Chromium 1243 se instaló en este entorno (`pnpm exec playwright install chromium --with-deps`). |
| `pnpm depcruise` | Exit 0. "no dependency violations found (33 modules, 18 dependencies cruised)". |

Verificación adicional (no parte del gate pero relevante para spec.md):

| Escenario de spec.md | Cómo se verificó | Resultado |
|---|---|---|
| "Instalación con otro gestor" (`npm install` debe fallar) | Se invocó `./node_modules/.bin/only-allow pnpm` directamente con `npm_config_user_agent` simulado como npm y como pnpm (en vez de correr `npm install` real, que empezó a re-resolver el árbol completo y se abortó tras 30 s para no arriesgar corromper el `node_modules` de pnpm) | Con user-agent de npm: rechaza con mensaje "Use pnpm install..." y exit 1. Con user-agent de pnpm: exit 0. |
| "solo existe `pnpm-lock.yaml`" | `fd -H -d 1 "lock" .` | Solo `pnpm-lock.yaml` presente. |
| "Ausencia de ESLint y Prettier" | `rg -i "eslint\|prettier"` sobre `package.json`; `fd` de archivos de config | Sin resultados. |
| "Árbol presente" (§5.4) | `find src drizzle` | Las 11 rutas de §5.4 existen; alias `@/*` confirmado en `tsconfig.json`. |
| "Módulos pendientes vacíos" | Inspección de `src/modules/notebooks/` | `index.ts` sin exports de dominio (`export {}`) + `README.md` con fase pendiente. |

## Tabla de evidencia TDD (Strict TDD — tarea 1.6)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.6 (result) | `src/shared/kernel/result.test.ts` | Unit | N/A (new) | ✅ Written (falla: `Failed to resolve import "./result"`) | ✅ Passed (6/6 tests) | ✅ 3+ casos (ok/err, map en Ok y en Err, unwrapOr en Ok y en Err) | ➖ None needed — API mínima ya limpia |
| 1.6 (domain-error) | `src/shared/kernel/domain-error.test.ts` | Unit | N/A (new) | ✅ Written (falla: `Failed to resolve import "./domain-error"`) | ✅ Passed (4/4 tests) | ✅ 3 casos (DomainError real, isDomainError true, isDomainError false en Error y en objeto plano) | ➖ None needed |
| 1.6 (id) | `src/shared/kernel/id.test.ts` | Unit | N/A (new) | ✅ Written (falla: `Failed to resolve import "./id"`) | ✅ Passed (4/4 tests) | ✅ 3 casos (formato UUID v7, orden temporal creciente, isValidId true/false) | ✅ Reescrito de `BigInt` a aritmética `Number` tras el error de `tsc` por `target: ES2017`; tests siguieron en verde |
| 1.6 (clock) | `src/shared/kernel/clock.test.ts` | Unit | N/A (new) | ✅ Written (falla: `Failed to resolve import "./clock"`) | ✅ Passed (3/3 tests) | ✅ 2 casos (fecha fija repetida, fecha fija distinta) | ➖ None needed |

### Test Summary

- **Total tests written**: 17 (kernel) + 1 (`page.test.tsx`, componente, fuera del alcance estricto de TDD de dominio) = 18
- **Total tests passing**: 18/18
- **Layers used**: Unit (17, puro Node sin jsdom), Component (1, Testing Library + jsdom)
- **Approval tests** (refactoring): None — no había código previo que refactorizar
- **Pure functions created**: `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `unwrapOr` (result.ts); `createId`, `isValidId`, `formatUuid` (id.ts); `createFixedClock` (clock.ts) — 11 funciones puras. `systemClock.now()` es el único punto impuro, aislado intencionalmente como puerto.

## Work Unit Evidence (PR1 — Tooling)

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → "Test Files 5 passed (5)" / "Tests 18 passed (18)" |
| Comando/escenario de runtime y resultado exacto | `pnpm test:e2e` → 1 test de Playwright/Chromium contra `next build && next start` real → "1 passed (4.6s)" |
| Rollback boundary | Revertir el scaffold completo: todo el contenido de este batch es nuevo (`git status --short` solo muestra `??` salvo `.gitignore` modificado). Revertir equivale a `git clean -fdx` sobre los paths listados más restaurar `.gitignore` a su versión anterior (solo tenía `.atl/`). No toca `docs/` ni el resto de `openspec/` (pre-existentes). |

## Trabajo restante (PR3–PR4)

- PR3 (Phase 3, tasks 3.1–3.11): dominio `Profile`, migración Drizzle, `EnsureProfile`, Supabase Auth (registro/login/logout/reset/Google OAuth), middleware de sesión.
- PR4 (Phase 4, tasks 4.1–4.10): env con Zod, Sentry, PostHog, GitHub Actions, cabeceras de seguridad, keep-alive cron, cierre con `strict_tdd: true`.

`chain_strategy` confirmado en `state.yaml`: `stacked-to-main` (PR2 se rama desde PR1, etc.).

## Impacto en el presupuesto de revisión (400 líneas)

| Métrica | Valor |
|---|---|
| Archivos nuevos/modificados (git status) | 20 líneas de `git status --short` (varias son directorios completos: `drizzle/`, `openspec/`, `public/`, `src/`, `tests/`) |
| Archivos individuales tras expandir directorios (excluyendo `openspec/` preexistente y `pnpm-lock.yaml`) | 66 |
| Líneas totales (excluyendo `pnpm-lock.yaml` y el binario `favicon.ico`) | 1028 |
| Líneas "autoría propia" (excluyendo boilerplate de `create-next-app`: `page.tsx`, `layout.tsx`, `globals.css`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `AGENTS.md`, `CLAUDE.md`, `pnpm-workspace.yaml`, SVGs de `public/`) | 843, en 42 archivos |

El pronóstico de `sdd-tasks` estimaba PR1 en ~350–500 líneas (scaffold
excluido). El número real de autoría propia (843) lo excede. La causa
principal no es lógica de negocio sino contenido mecánico y repetitivo
exigido explícitamente por la spec: 10 módulos × (`index.ts` + `README.md`)
≈ 300 líneas de esqueleto casi idéntico, más 4 archivos de kernel + sus 4
tests con triangulación real (~400 líneas) que Strict TDD y
`work-unit-commits` prohíben recortar (nunca separar test de su código, ni
comprimir código para caber en el presupuesto). Phase 1 de `tasks.md` es un
único work unit ("Unit 1: Tooling verde") y un único PR según el propio plan
de tareas; no hay una forma cohesiva de partirlo sin dejar el tooling a
medias (p. ej. Biome sin Vitest, o dependency-cruiser sin los módulos que
verifica). Se reporta el número real honestamente y se recomienda
**`size:exception`** para PR1 en vez de fragmentar el work unit.

## Batch actual: PR2 — Tokens y shell (Phase 2, tasks 2.1–2.7)

Rama: `feat/phase-0-pr2-design-shell`, creada desde `main` ya con PR1
mergeado (`stacked-to-main`). Sin commits creados en este batch; el árbol de
trabajo queda sin confirmar para el review nativo y la entrega humana.

### Tareas completadas

| Tarea | Evidencia |
|---|---|
| 2.1 Tokens `@theme` + fuentes | `src/app/globals.css` (primitivas, pastel, semánticos, radios, layout 240/64/52) y `src/app/layout.tsx` con `DM_Sans`/`JetBrains_Mono` de `next/font/google`, `lang="es"` |
| 2.2 shadcn sin preset | `components.json` escrito a mano (`tailwind.config: ""`, `cssVariables: true`, `iconLibrary: lucide`, alias `@/shared/ui`); `pnpm dlx shadcn add button`; `--primary` mapeado a `#1C1917` |
| 2.3 Shell `(app)` | `layout.tsx` (lee cookie en servidor), `_components/{sidebar,topbar,user-menu,sidebar-cookie}` |
| 2.4 Layout `(public)` | `(public)/layout.tsx` panel partido + `(public)/login/page.tsx` placeholder visual |
| 2.5 A11y | objetivos ≥ 44 px (Button default `h-11`, toggle `size-11`), `:focus-visible` con ring, `prefers-reduced-motion` sin `!important` fuera de capa, `aria-*` en nav/menú, copy "tú" sin emoji |
| 2.6 RED → GREEN | `tests/e2e/shell-empty-state.spec.ts` (6 casos) + `sidebar.test.tsx`, `user-menu.test.tsx`, `(app)/page.test.tsx`, `no-inline-hex.test.ts` |
| 2.7 Gate | ver tabla de verificación |

### Tabla de verificación (gate PR2 / tarea 2.7)

| Comando | Resultado observado |
|---|---|
| `pnpm biome ci .` | 50 archivos, 0 errores, 2 warnings documentados (`noDocumentCookie`, cookieStore ausente en jsdom) |
| `pnpm typecheck` | sin errores |
| `pnpm test` | 9 archivos, 28 tests en verde |
| `pnpm test:e2e` | 7/7 en Chromium contra `next build && next start` |
| `pnpm depcruise` | 0 violaciones (55 módulos) |
| Navegable sin auth | `/` renderiza el shell vacío; `/login` el layout público (middleware llega en PR3) |

### Evidencia TDD (Strict TDD)

RED: `pnpm test` con 3 archivos fallando por módulos inexistentes; `pnpm test:e2e`
no arrancó el `webServer` porque `next build` falló el typecheck sobre los tests.
GREEN: los cinco comandos anteriores en verde. Un fallo intermedio real
(cookie vacía por un `sd` que interpretó `${}` como grupos de captura) lo
detectó el e2e de persistencia, no el unit test: jsdom había pasado antes de
la regresión.

### Decisiones tomadas

- `style: "radix-nova"` en `components.json` es la variante de código de los
  componentes (Radix + Lucide); no se importó ningún preset de tema, que era
  el objetivo de la spec. Los nombres `--background/--primary/...` de shadcn
  se alimentan de los tokens Cogni en `:root`.
- Persistencia del sidebar por cookie `cogni-sidebar` (`collapsed|expanded`,
  1 año, `samesite=lax`): el layout servidor la lee con `cookies()` y evita el
  parpadeo que daría `localStorage`. Esto hace `/` dinámica, que de todos
  modos lo será por la sesión en PR3.
- `SIDEBAR_COOKIE` vive en `sidebar-cookie.ts` sin directiva: un export de
  string desde un módulo `"use client"` llega al servidor como referencia de
  cliente, no como valor.
- Tamaños de `Button` subidos (`default h-11`, `lg h-12`, `icon size-11`)
  para cumplir los 44 px de la spec; el resto del componente generado queda
  intacto.
- Menú de usuario propio (60 líneas, `role="menu"`, Escape, click fuera) en
  vez de `dropdown-menu` de shadcn (~250 líneas generadas) por presupuesto.
- "Cerrar sesión" es un `Link` a `/login` hasta que PR3 lo convierta en
  Server Action (tarea 3.6).
- El `e2e` verifica bg/radio del contenedor `data-testid="content-area"` y no
  de `main`: el `header` debe quedar fuera de `main` para exponer `role=banner`.

### Corrección del review nativo (lineage `review-712ba2d8377e865b`)

Hallazgo CRÍTICO `R3-login-form-get-leak` (lente reliability): el `<form>` de
`/login` no tenía `action`, así que un submit hacía GET y ponía la contraseña
en la URL, el historial y los logs. Corrección acotada (plan: 40 líneas):
Server Action stub `signInPlaceholder` (`"use server"`, no-op) como `action`
del formulario, más `login/page.test.tsx` y un e2e que envía credenciales y
comprueba método POST y URL sin query string. PR3 reemplaza el stub por la
acción real (tarea 3.10).

Resultado: **approved**, autoridad quemada (`gentle-ai.review-acknowledged/v1`,
revision `sha256:5a2283ef…`). Advisories no bloqueantes, para trabajo posterior:

- `R3-login-page-no-unit-test`: `login/page.test.tsx` ya existe en el árbol
  pero quedó fuera del alcance congelado del review (archivo nuevo tras el
  START); entra con este mismo PR.
- `R3-usermenu-outside-click-untested`: falta un unit test del cierre por
  click fuera del menú. Follow-up en PR3 al tocar el menú para el logout real.

### Desviaciones del diseño

- La spec pide `shadcn init sin --defaults`; el CLI actual (v3) obliga a elegir
  un preset (Nova/Vega/...) de forma interactiva. Se escribió `components.json`
  a mano siguiendo la instalación manual de la documentación oficial.
- El CLI resolvió mal el alias `utils` (`@/shared/ui/utils`): instaló un
  paquete npm `cn` en vez de crear el archivo. Se eliminó `cn`, se creó
  `src/shared/ui/utils.ts` y se instalaron `radix-ui`,
  `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- El smoke `tests/e2e/smoke.spec.ts` y `src/app/page.tsx` de PR1 se eliminan:
  la raíz `/` pasa a `(app)/page.tsx` como marca el diseño.

### Impacto en el presupuesto de revisión (400 líneas)

| Métrica | Valor |
|---|---|
| Archivos tocados (sin lockfile) | 25 (22 nuevos/modificados, 3 eliminados) |
| Líneas insertadas / eliminadas (sin lockfile) | 822 / 113 |
| De las insertadas: `globals.css` | 200 (tokens mecánicos) |
| De las insertadas: tests (e2e + unit) | 229 |
| De las insertadas: `button.tsx` generado | 66 |

Pronóstico de `sdd-tasks`: ~250–350. Real: 822. El excedente es tokens
(200), tests que Strict TDD no permite recortar (229) y el componente
generado (66). Decisión del maintainer (2026-09-16): **una sola PR con
`size:exception`**, tras rechazar la alternativa de dos PRs apiladas
(2a tokens ~335 / 2b shell ~490). El ledger nativo se reseteó con esa razón.

## Batch PR3 — Auth y Drizzle (Phase 3, tasks 3.1–3.11)

Rama `feat/phase-0-pr3-auth-drizzle` desde `main` (2e59810, merge de PR2).
Implementado en sesiones del 2026-09-16/17; gate cerrado el 2026-09-18 al
existir por fin los proyectos Supabase `cogni-dev` y `cogni-prod`.

### Tareas completadas

- 3.1 `domain/profile.ts` + puerto `profile-repository.ts` (RED→GREEN en `profile.test.ts`).
- 3.2 `drizzle/0000_profiles.sql`, `drizzle.config.ts`, `src/shared/db/{schema,client}.ts` con `prepare:false, max:1`. Migración aplicada en `cogni-dev` con `pnpm db:migrate` (2026-09-18).
- 3.3 `EnsureProfile` idempotente (`onConflictDoNothing`), invocado desde `src/app/(app)/layout.tsx`.
- 3.4 `DrizzleProfileRepository` y clientes Supabase `server`/`browser`/`proxy` sobre `@supabase/ssr`.
- 3.5 `signUp`/`signIn` + `SupabaseAuthGateway`: `email_not_confirmed` → `EMAIL_NOT_VERIFIED`.
- 3.6 `signOutAction`, `requestPasswordReset`, `updatePassword`.
- 3.7 Google OAuth con `skipBrowserRedirect: true` + `src/app/auth/callback/route.ts`.
- 3.8 `safeNext` rechaza URLs externas y protocol-relative; usado en el callback.
- 3.9 Sesión y protección de `(app)` en `src/proxy.ts` (ver desviaciones).
- 3.10 Formularios `(public)` (`login`, `register`, `forgot-password`, `reset-password`) sobre Server Actions; `SUPABASE_SERVICE_ROLE_KEY` ausente de `src/`; `getProfile` rechaza `ownerId` ajeno.
- 3.11 Gate: ver tabla.

### Tabla de verificación (gate PR3 / tarea 3.11, 2026-09-18)

| Check | Comando | Resultado |
|---|---|---|
| Lint | `pnpm lint` | 97 archivos, 0 errores |
| Tipos | `pnpm typecheck` | limpio |
| Unit | `pnpm test` | 17 archivos, 58/58 |
| Migración | `pnpm db:migrate` (cogni-dev) | aplicada |
| E2E | `pnpm test:e2e` (cogni-dev) | 14/15; falla "registers, asks for verification" |

El único e2e rojo hace un sign-up real y `cogni-dev` responde
`429 over_email_send_rate_limit`: el SMTP integrado de Supabase permite
muy pocos correos por hora. No es defecto del código. Decisión del
maintainer (2026-09-18): diferir el SMTP propio a PR4 como tarea 4.11.
`cogni-prod` existe pero no se verificó contra la app (llega con Vercel en 4.6).

### Evidencia TDD (Strict TDD)

Ocho suites unitarias de identity (`profile`, `ensure-profile`,
`get-profile`, `sign-in`, `sign-up`, `request-password-reset`, `safe-next`,
`supabase-auth-gateway`) más `login/page.test.tsx` y `user-menu.test.tsx`
actualizados. Los e2e (`tests/e2e/auth.spec.ts`) crean usuarios verificados
por la API admin, como el "verification stub" del design.

### Decisiones tomadas

1. **`src/proxy.ts` en vez de `src/middleware.ts`**: Next 16 renombró la
   convención `middleware` a `proxy` (deprecation notice en
   `node_modules/next/dist/docs/.../proxy.md`). La tarea 3.9 conserva el
   nombre viejo; el comportamiento es el especificado.
2. **Zod para validar credenciales** (`credentials-schema.ts`) y
   `server-only` en el cliente de servidor, ambos añadidos a `package.json`.
3. **Playwright carga `.env.local` con `@next/env`** para que los fixtures
   alcancen la API admin; el readiness del webServer apunta a
   `/favicon.ico` porque el proxy redirige `/` sin sesión.
4. **`formAlert(page)` en los fixtures e2e**: Next renderiza su route
   announcer con `role="alert"`, y `getByRole("alert")` a secas viola el
   strict mode de Playwright.
5. **dependency-cruiser**: los tests de dominio pueden importar `vitest`
   (`pathNot: \.test\.ts$`); el código de producción del dominio sigue
   sin dependencias externas. `drizzle/meta` excluido de Biome.

### Desviaciones del diseño

- Ninguna funcional. Nombre de archivo `proxy.ts` (decisión 1).
- El gate 3.11 pedía "e2e registro→login verdes": registro queda
  condicionado al SMTP (4.11); login, logout, reset, Google start y
  `next` inseguro sí están verdes.

### Impacto en el presupuesto de revisión (400 líneas)

| Métrica | Valor |
|---|---|
| Archivos tocados (sin lockfile ni `drizzle/meta`) | 64 |
| Líneas insertadas / eliminadas | 1951 / 99 |
| De las insertadas: tests (unit + e2e + fixtures) | 706 |
| De las insertadas: migración SQL | ~40 |

Pronóstico de `sdd-tasks`: ~350–450. Real: 1951. Un tercio son tests que
Strict TDD no permite recortar; el resto es el módulo identity completo
(dominio, aplicación, infraestructura, UI y rutas), que el design define
como un solo work unit de PR3. Los commits se separan por unidad de
trabajo (dominio+DB, auth gateway y actions, OAuth+proxy, formularios y
e2e) para que la PR se lea por capas. Se recomienda **`size:exception`**
para PR3, pendiente de aceptación del maintainer.

### Review nativo (lineage `review-1c970253b392c7ca` → `-r1`)

Candidato: commits `c893fc6..6f71df6` sobre `main` (2e59810), proyección
`committed-only`, riesgo `high`, cuatro lentes (risk, resilience,
readability, reliability). Consentimiento otorgado por el maintainer el
2026-09-18.

**Hallazgo CRITICAL R1-001 (risk)**: `profiles` se creó en `public` sin
Row Level Security. Con la clave publicable, que va al navegador por
diseño, PostgREST exponía lectura y escritura de todos los perfiles; el
filtro por `ownerId` solo cubre el camino Drizzle. Plan de corrección de
130 líneas aceptado (presupuesto 200).

Corrección (commit `ba7d890`, Strict TDD): RED `src/shared/db/schema.test.ts`
(`getTableConfig(profiles).enableRLS === true`) → `pgTable(...).enableRLS()`
en `schema.ts` → migración generada `drizzle/0001_profiles_rls.sql`
(`ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY`) → GREEN. Sin políticas
a propósito: solo la conexión de servidor (que omite RLS) toca la tabla.
Aplicada en `cogni-dev`; sonda `GET /rest/v1/profiles` con la clave
publicable devuelve `[]`. Gate completo verde tras la corrección: lint 98
archivos, typecheck, unit 59/59, e2e 14/15 (mismo caso del rate limit).

Como la proyección es `committed-only`, el commit de corrección cambió la
identidad del candidato; `gentle-ai review recover --disposition
scope_changed` creó la lineage sucesora `review-1c970253b392c7ca-r1`, que
volvió a capturar las cuatro lentes: **approved**, autoridad quemada con
`acknowledge-approved`.

35 hallazgos advisory (16 WARNING, 19 SUGGESTION), todos informativos y
fuera de esta PR. Los WARNING que merecen seguimiento en PR4 o después:

- Enumeración de cuentas en `/register` (`El email ya está registrado`), en
  contraste con el sign-in y el reset, que son neutros. Decisión de producto
  de la tarea 3.5; revisar si conviene un mensaje único.
- `siteUrl()` cae en silencio a `localhost` sin `NEXT_PUBLIC_SITE_URL`; en
  producción rompería los enlaces de correo y el `redirectTo` de Google.
  Se resuelve con el env tipado de la tarea 4.1.
- El callback `/auth/callback` mapea todo fallo a `error=google`, aunque el
  enlace sea de verificación o de reset; falta copy por flujo.
- `signOutAction` ignora el `Result` del gateway: un logout fallido rebota
  al usuario a `/`.
- `ensureProfileForUser` en el layout `(app)` convierte cualquier caída de
  la base en un 500 de toda la app; y `updateSession` en el proxy trata un
  error de `getUser()` como "sin usuario".
- `DrizzleProfileRepository.upsert` es insert-or-ignore; el nombre y el
  doble en memoria prometen upsert real.
- `profiles.id` no tiene FK a `auth.users`, así que borrar un usuario deja
  perfiles huérfanos (los fixtures e2e lo hacen).
- Mínimo de contraseña duplicado en literales en vez de `PASSWORD_MIN_LENGTH`.

## Batch PR4 — Observabilidad y entrega (Phase 4, tasks 4.1–4.11)

Rama `feat/phase-0-pr4-observability-delivery` desde `main` (443d16d, merge
de PR3). Sesión 2026-09-18. Strict TDD: cada pieza testeable arrancó en RED.

### Tareas completadas (código)

- 4.1 `src/shared/config/{env.schema,env.client,env.server}.ts`: schemas
  Zod puros (8 tests), `clientEnv()`/`serverEnv()` lazy, `server-only` en el
  servidor. La URL de Supabase debe ser la raíz del proyecto (rechaza
  `/rest/v1/`, el error real de la sesión anterior); `NEXT_PUBLIC_SITE_URL`
  ya no cae a localhost. `supabase-env.ts`, `db/client.ts` y las actions
  leen del config validado. `.env.example` pasa a estar trackeado
  (`!.env.example` en `.gitignore`; antes era ignorado por `.env*`).
- 4.2 Sentry: `sentry-options.ts` (3 tests; deshabilitado sin DSN,
  `environment` y `release` desde Vercel, tracing 0), `sentry.{server,edge}.config.ts`,
  `src/instrumentation.ts` con `captureRequestError`, `src/instrumentation-client.ts`,
  `src/app/global-error.tsx` (1 test: captura una vez y ofrece reintentar),
  `withSentryConfig` con `tunnelRoute: /monitoring` y source maps solo con
  `SENTRY_AUTH_TOKEN`.
- 4.3 PostHog: `src/shared/observability/analytics.ts` (2 tests), cliente
  `posthog-node` por llamada con `flushAt:1, flushInterval:0` y `shutdown()`;
  unión cerrada `user_signed_up | user_signed_in`; cliente browser con
  `autocapture:false` y sin pageviews. El puerto `signUp` devuelve
  `{ outcome, userId }` para atribuir el evento (tests de `sign-up` y del
  gateway actualizados en RED primero).
- 4.4 `.github/workflows/pr.yml`: install → `biome ci` → `tsc` → `vitest run`
  → `depcruise` → `pnpm audit --audit-level=high`, sin secretos.
- 4.5 `.github/workflows/main.yml`: gate de PR + job `e2e` (`pnpm test:db`
  y Playwright contra `cogni-dev`, secretos `DEV_*`) + job `migrate` con
  `environment: production` y `PROD_DATABASE_URL`. `tests/db/connection.smoke.test.ts`
  con `vitest.db.config.ts` y script `test:db` (verde contra cogni-dev).
- 4.7 `src/shared/config/security-headers.ts` (3 tests) importado por
  `next.config.ts`; e2e comprueba las cabeceras en `/login`.
- 4.8 `src/app/api/keep-alive/route.ts` (4 tests: sin bearer, bearer
  erróneo, prefijo del secreto y válido) con `timingSafeEqual` tras comparar
  longitud; `vercel.json` con cron diario `0 6 * * *`.

### Verificación (2026-09-18, local)

| Check | Resultado |
|---|---|
| `pnpm lint` | 119 archivos, 0 errores |
| `pnpm typecheck` | limpio |
| `pnpm test` | 24 archivos, 80/80 |
| `pnpm depcruise` | 0 violaciones (130 módulos) |
| `pnpm test:db` (cogni-dev) | 1/1 |
| `pnpm audit --audit-level=high` | pasa (1 moderada) |
| `pnpm build` | OK; `/api/keep-alive` y `/auth/callback` dinámicos |
| `pnpm test:e2e` (cogni-dev) | 15/16; registro por rate limit (4.11) |

### Decisiones y desviaciones

1. La spec nombra `NEXT_PUBLIC_SUPABASE_ANON_KEY`; el proyecto usa la clave
   `sb_publishable_` de Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`),
   como en PR3. `SENTRY_AUTH_TOKEN` no entra al schema: solo lo lee el
   plugin de build.
2. CSP estática sin nonces (guía oficial de Next): `'unsafe-inline'` en
   script y style; `connect-src` limitado a Supabase, Sentry y PostHog.
3. Vercel despliega por su integración Git; `main.yml` es el gate previo y
   aplica `drizzle migrate` a `cogni-prod` bajo el environment `production`.
   El deploy en sí no lo dispara Actions.
4. El evento `user_signed_in` se emite en `signInAction`; el sign-in vía
   Google (callback OAuth) todavía no lo emite. Follow-up.
5. `CRON_SECRET` es obligatorio en `env.server`: hay que añadirlo a
   `.env.local` (`openssl rand -hex 32`).

### Pendiente (requiere cuentas del maintainer)

- 4.6 Proyecto Vercel conectado al repo, variables `cogni-dev` en preview y
  `cogni-prod` en producción, dominio de Cloudflare.
- 4.9 Secretos de GitHub (`DEV_SUPABASE_URL`, `DEV_SUPABASE_PUBLISHABLE_KEY`,
  `DEV_SUPABASE_SERVICE_ROLE_KEY`, `DEV_DATABASE_URL`, `DEV_CRON_SECRET`,
  `PROD_DATABASE_URL` en el environment `production`), push, PR y workflows
  verdes; cron respondiendo 200 en producción.
- 4.10 Cierre de `openspec/config.yaml` tras CI verde.
- 4.11 SMTP propio (Resend) en ambos proyectos Supabase.

### Review nativo (lineage `review-8050c980878d6451`)

Candidato: commits `45a1a0a..4f73641` sobre `main` (443d16d), `committed-only`,
riesgo `high`, cuatro lentes. Consentimiento otorgado el 2026-09-18.

**Hallazgo CRITICAL R4-analytics-blocks-auth-path (resilience)**: las
actions esperaban `track()` de PostHog en el camino crítico, sin try/catch
y con el `shutdown()` de 30 s por defecto; un PostHog caído retrasaba el
login y luego lanzaba con la sesión ya creada. Plan de 60 líneas aceptado.
Corrección (commit `1e8e1ea`, RED primero en `analytics.test.ts`): `track()`
traga cualquier fallo y apaga con timeout de 2 s; las actions difieren el
evento con `after()` de `next/server`. El validador dirigido aprobó;
autoridad quemada con `acknowledge-approved`.

25 advisory (10 WARNING). Atendidos o resueltos tras el cierre:

- Optionals vacíos (`SENTRY_DSN=`) rompían el boot: commit `1fce21d`
  normaliza cadena vacía a unset (assess: medium, diferido al slice de PR).
- `global-error` con prop `retry`: verificado contra la doc de Next 16.3.5
  en `node_modules/next/dist/docs` (la convención pasó de `reset` a
  `retry`); se mantiene.

Follow-ups fuera de esta PR:

- **Migración vs. deploy**: Vercel despliega `main` al push, y `main.yml`
  migra después de e2e; hay ventana de drift. Al cablear Vercel (4.6) mover
  la migración al build command (`pnpm db:migrate && pnpm build`) o pausar el
  auto-deploy y dispararlo desde el workflow.
- CSP con `'unsafe-inline'` en `script-src`: pasar a nonces vía `proxy.ts`
  cuando haya presupuesto; hoy sigue la guía estática oficial de Next.
- `signInAction` construye un segundo cliente Supabase para leer el id;
  exponer el id desde el gateway como en sign-up.

### Incidente post-merge de PR4 (2026-09-20) y fix `fix/phase-0-prod-proxy-csp`

PR4 mergeada (#4, `6f10621`). Síntomas: workflow **Main** rojo, "login no
carga bien", tabla `profiles` ausente en `cogni-prod`. Causas raíz, en
cadena:

1. **Secreto `DEV_DATABASE_URL` inválido** (log de `pnpm test:db`:
   `TypeError: Invalid URL`). El job `e2e` falló y `migrate` se saltó, de
   ahí la tabla ausente. Responsable: configuración del maintainer.
   Formatos que rompen al driver `postgres`: contraseña con `#` sin
   codificar, valor entre comillas, comando `psql …` pegado como URI.
2. **Matcher del proxy demasiado amplio** (código): `GET /api/keep-alive`
   y `POST /monitoring` respondían `307 → /login` en producción, así que el
   cron nunca llegaba al handler y el túnel de Sentry perdía los reportes.
   Fix `bc2530c`: el matcher excluye `api/` y `monitoring`;
   `src/proxy.test.ts` fija el comportamiento; e2e exige 401 en keep-alive.
3. **PostHog**: clave `phs_…` (secreta) en vez de la Project API key
   `phc_…` (404 en `config`), y CSP sin `script-src` para
   `*.posthog.com`. La CSP está corregida en el mismo fix; la clave la
   cambia el maintainer en Vercel y `.env.local`.

Verificación del fix en local: unit 88/88, lint, typecheck, depcruise;
e2e: keep-alive 401 verde. Los e2e de auth fallan en local porque la
`SUPABASE_SERVICE_ROLE_KEY` de `.env.local` devuelve 401 (clave rotada o
mal pegada); no es del código.

Review nativo del fix: lineage `review-ad1d5466b82da787`, 4 lentes,
**approved** sin corrección, autoridad quemada. Advisories a seguir:
`monitoring` en el matcher es prefijo sin anclar (`/monitoring-x` también
quedaría fuera) y `api/` excluye todo handler futuro, que deberá
autenticar por su cuenta. Follow-up: anclar `monitoring(?:/|$)`.

### Resolución del incidente (2026-09-20, continuación)

Tras el fix (PR #5, `0dddb76`) el CI volvió a fallar: primero
`ENETUNREACH` a una IPv6 `:5432` (URI directa `db.<ref>.supabase.co`,
IPv6-only según la doc de Supabase; GitHub Actions y Vercel son IPv4) y
después `password authentication failed`. La causa de fondo era un
`.env.local` con las variables de **los dos proyectos** duplicadas; Next
toma la última repetida, así que la URL era de un proyecto y las claves de
otro, y todo lo copiado a GitHub y Vercel heredó la mezcla.

Identidad verificada de los proyectos:

| Proyecto | ref | pooler |
|---|---|---|
| cogni-dev | `ctzjuudglcqxniakhvol` | `aws-0-us-east-1.pooler.supabase.com:6543` |
| cogni-prod | `mtsrpbqxsqhnfwjwskdn` | `aws-0-us-west-2.pooler.supabase.com:6543` |

Acciones: el maintainer limpió `.env.local` (una línea por variable,
todas de dev, más `PROD_DATABASE_URL`); el agente validó cada valor
contra su proyecto, aplicó `pnpm db:migrate` a cogni-prod (`profiles` con
`relrowsecurity = true`), reescribió por API los secretos `DEV_*` y
`production/PROD_DATABASE_URL`, y relanzó el run `35495269739`:
**verify, e2e y migrate verdes**. E2E local contra dev: 17/17, incluido
el registro (SMTP de Resend operativo).

Cierre de fase (4.10): `openspec/config.yaml` con `strict_tdd: true`,
`projects` completo y comandos de apply/verify. 4.11 verificado por el
e2e de registro.

## Estado

37/38 tareas completas. Pendiente 4.9 parcial y 4.6: el maintainer debe
corregir `DATABASE_URL` en Vercel (Production = pooler de prod, Preview =
pooler de dev) y redesplegar; después se confirma el cron 200 y el flujo
de login en producción.
