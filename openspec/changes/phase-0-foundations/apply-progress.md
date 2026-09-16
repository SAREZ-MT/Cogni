# Apply Progress: Fase 0 — Cimientos de Cogni

## Batch actual: PR1 — Tooling (Phase 1, tasks 1.1–1.9)

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

## Trabajo restante (PR2–PR4)

- PR2 (Phase 2, tasks 2.1–2.7): tokens de diseño vía `@theme`, `shadcn init`, shell `(app)`/`(public)`, accesibilidad, e2e de shell.
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

## Estado

9/9 tareas de la Phase 1 completas. Gate PR1 (tarea 1.9) verde. Listo para
`sdd-verify`.
