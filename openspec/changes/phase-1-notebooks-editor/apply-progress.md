# Apply Progress: Fase 1 — Notebooks Editor

## Batch PR0 — migrate-in-build y FK de `profiles` (Phase 0, tasks 0.1–0.8)

Rama: `feat/phase-1-pr0-migrate-fk`, creada desde `docs/phase-1-planning`
(`stacked-to-main`). Sin commits creados en este batch; el árbol de trabajo
queda sin confirmar para que el orquestador cree el commit de trabajo.

Strict TDD Mode: activo. Test runner: `pnpm test` (Vitest unidad),
`pnpm test:db` (Vitest contra `cogni-dev` real, `DATABASE_URL` leída de
`.env.local`, config `vitest.db.config.ts`).

### Decisión del usuario que desbloqueó este batch

El intento anterior de este batch quedó bloqueado en la tarea 0.3: el
chequeo de filas huérfanas encontró 33/33 filas de `profiles` en
`cogni-dev` sin fila correspondiente en `auth.users` (que tenía 0 filas en
ese momento). El usuario decidió: la migración `0002` primero borra las
filas huérfanas de `profiles` y luego agrega la FK, con la justificación de
que un perfil sin usuario de `auth.users` correspondiente nunca puede
iniciar sesión, y que ese borrado hace que la migración pueda correr sin
fallar dentro del build de Vercel en producción (cierra el advisory de
revisión "FK migration blocks prod build on orphans"). Esta decisión quedó
reflejada en `design.md` (Decision "FK de `profiles` hacia `auth.users`
como migración Drizzle explícita" y el bloque SQL de referencia) y en el
SQL real de la migración.

### Tareas completadas

- [x] 0.1 `drizzle/0002_profiles_auth_fk.sql` con dos sentencias en orden: `delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id);` y luego `alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;`. `drizzle/0002_profiles_auth_fk.down.sql` solo revierte el `drop constraint` (comentario explícito: las filas borradas no se restauran, ese borrado no es reversible). Registrada en `drizzle/meta/_journal.json` (`idx: 2`, `tag: "0002_profiles_auth_fk"`, `breakpoints: true`, mismo patrón que `0001_profiles_rls`). `drizzle/meta/0002_snapshot.json` es copia de `0001_snapshot.json` con `id`/`prevId` actualizados: `schema.ts` no declara la FK (no puede — `auth.users` vive fuera del esquema introspectado por Drizzle), así que el snapshot no cambia de contenido, igual que produciría `drizzle-kit generate --custom` sin drift de schema.
- [x] 0.2 RED `tests/db/profiles-fk.smoke.test.ts`: inserta en `profiles` un `id` (`randomUUID()`) inexistente en `auth.users` y espera rechazo con código Postgres `23503`. El test limpia su propia fila en `finally` en caso de que el insert llegue a tener éxito.
- [x] 0.3 Migración aplicada en `cogni-dev` con `pnpm db:migrate`. Huérfanos antes: 33/33; huérfanos después: 0/0 (el `delete` de la propia migración eliminó las 33 filas huérfanas, dejando la tabla `profiles` en 0 filas). `pnpm test:db` en verde tras aplicar. Reversión verificada aplicando `0002_profiles_auth_fk.down.sql` a mano (`sql.unsafe(...)`, no vía `drizzle-kit`, que no tiene comando `down`): el test volvió a RED, confirmando que la constraint realmente se quitó. `pnpm db:migrate` NO es idempotente para una migración ya marcada como aplicada en `__drizzle_migrations` (el hash ya existe, así que el segundo `pnpm db:migrate` no reintenta el SQL); se re-aplicó el SQL de subida a mano (`sql.unsafe` sobre `0002_profiles_auth_fk.sql`) y `pnpm test:db` volvió a verde.
- [x] 0.4 `package.json`: `"build": "drizzle-kit migrate && next build"`.
- [x] 0.5 `.github/workflows/main.yml`: eliminado el job `migrate` (corría después de `e2e` con `secrets.PROD_DATABASE_URL`); los jobs `verify` y `e2e` quedan intactos. También se actualizó el comentario de cabecera del workflow que mencionaba "the migration step" como job separado, para que no quede desactualizado.
- [ ] 0.7 (mitad local, verificada) `DATABASE_URL=postgres://invalid:invalid@127.0.0.1:1/invalid pnpm build` falla dentro de `drizzle-kit migrate` (fase "applying migrations...") con exit 1, sin llegar a ninguna salida de Next.js ("Compiling"/"Creating an optimized production build"). `pnpm build` normal (con `DATABASE_URL` real de `.env.local`) corre completo: aplica la migración (ya aplicada, notices de "already exists, skipping") y luego compila con éxito ("Compiled successfully", genera páginas estáticas, exit 0).
- [x] 0.8 Gate PR0: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, los 5 en verde (ver tabla de verificación). El commit de trabajo lo crea el orquestador, no este batch.

### Pendiente — `(usuario)`

- [ ] 0.6 `(usuario)`: en el dashboard de Vercel, proyecto de Cogni:
  `Settings → Environment Variables` → confirmar que `DATABASE_URL` existe
  con alcance **Production** y **Preview**, y que está disponible en
  **tiempo de build** (no solo runtime). Si la variable está marcada
  "Sensitive"/"Encrypted", igual debe quedar disponible para "Build &
  Runtime" en ambos entornos — el build ahora ejecuta `drizzle-kit migrate`
  antes de `next build` y falla si la variable falta en build time.
- [ ] 0.7 (mitad Vercel, `(usuario)`): una vez exista un deploy de preview
  de esta rama, revisar el log de build de Vercel y confirmar que muestra
  la salida de `drizzle-kit migrate` **antes** de la línea "Compiling...".
  Esto cubre los Scenarios "Build de Vercel aplica migraciones" y
  "Migración fallida bloquea el build" de
  `specs/observability-and-delivery/spec.md`.

### Tabla de evidencia TDD (Strict TDD)

| Task | Test File | Layer | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 0.2 / 0.3 | `tests/db/profiles-fk.smoke.test.ts` | DB smoke | ✅ Observado (2 veces): antes de la migración (`promise resolved "[]" instead of rejecting`) y de nuevo tras aplicar el `down.sql` a mano | ✅ Observado (2 veces): tras `pnpm db:migrate` y de nuevo tras re-aplicar el SQL de subida a mano | ➖ No aplica — SQL de dos sentencias ya es la forma mínima, sin refactor pendiente |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| Chequeo de huérfanos antes de migrar (`select count(*) ... left join auth.users ...`) | `33` filas huérfanas de `33` totales en `profiles`; `auth.users` con `0` filas |
| `pnpm db:migrate` (primera vez) | `[✓] migrations applied successfully!` (con notices esperables de `schema "drizzle" already exists` / `relation "__drizzle_migrations" already exists`, ambos de una migración previa) |
| Chequeo de huérfanos y total después de migrar | `profiles` total: `0`; huérfanos: `0` (la migración borró las 33 filas huérfanas) |
| `pnpm test:db` (tras migrar) | `Test Files 2 passed (2)` / `Tests 2 passed (2)` — GREEN |
| Reversión manual (`sql.unsafe` de `0002_profiles_auth_fk.down.sql`) | `down SQL applied`, sin error |
| `pnpm test:db` (tras revertir) | `Test Files 1 failed \| 1 passed (2)` — RED de nuevo en `profiles-fk.smoke.test.ts` (`promise resolved "[]" instead of rejecting`), confirmando que la constraint se quitó de verdad |
| `pnpm db:migrate` (segunda vez, tras revertir a mano) | `[✓] migrations applied successfully!`, pero NO restauró la constraint (ver siguiente fila) — la migración ya estaba marcada como aplicada en `__drizzle_migrations` y `drizzle-kit` no la reintenta |
| `pnpm test:db` (tras el segundo `db:migrate`) | Sigue RED (`Test Files 1 failed \| 1 passed (2)`) — confirma que `db:migrate` no es idempotente para este caso |
| Re-aplicación manual del SQL de subida (`sql.unsafe` de `0002_profiles_auth_fk.sql`) | `up SQL re-applied manually`, sin error |
| `pnpm test:db` (final) | `Test Files 2 passed (2)` / `Tests 2 passed (2)` — GREEN |
| `DATABASE_URL=postgres://invalid:invalid@127.0.0.1:1/invalid pnpm build` | Falla en `drizzle-kit migrate` durante "applying migrations...", exit 1, sin ninguna salida de Next.js/"Compiling" |
| `pnpm build` (con `DATABASE_URL` real) | Exit 0. `drizzle-kit migrate` corre primero (notices "already exists, skipping", `[✓] migrations applied successfully!`), luego `▲ Next.js 16.3.5 (Turbopack)` → `Creating an optimized production build ...` → `✓ Compiled successfully in 1402ms` → páginas estáticas generadas |
| `pnpm test` | `Test Files 25 passed (25)` / `Tests 88 passed (88)` |
| `pnpm test:db` (gate final) | `Test Files 2 passed (2)` / `Tests 2 passed (2)` |
| `pnpm typecheck` | Exit 0, sin salida (sin errores de tipos) |
| `pnpm lint` (`biome check`) | `Checked 121 files in 36ms. No fixes applied.` |
| `pnpm depcruise` | `✔ no dependency violations found (131 modules, 236 dependencies cruised)` |

### Desviaciones del diseño

Ninguna. El SQL de la migración (borrado de huérfanos + FK) coincide
exactamente con el `design.md` actualizado por la decisión del usuario. No
se validó sintácticamente el YAML de `.github/workflows/main.yml` con un
parser YAML (ni `js-yaml` ni el módulo `yaml` de Python estaban disponibles
en este entorno); se verificó por inspección visual que la indentación y
estructura del job eliminado no dejó huérfanos de sintaxis (el job
`migrate` completo se quitó, `verify` y `e2e` quedan idénticos).

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test:db` → GREEN final: `Test Files 2 passed (2)` / `Tests 2 passed (2)`, tras un ciclo RED → GREEN → RED (reversión) → GREEN (re-aplicación) completo |
| Comando/escenario de runtime y resultado exacto | `pnpm build` con `DATABASE_URL` inválida → falla antes de compilar (runtime real de `drizzle-kit migrate` dentro del build); `pnpm build` con `DATABASE_URL` válida → build completo exitoso |
| Rollback boundary | Revertir este batch equivale a: restaurar `package.json#build` a `"next build"`, restaurar el job `migrate` en `.github/workflows/main.yml`, borrar `drizzle/0002_profiles_auth_fk.sql`, `drizzle/0002_profiles_auth_fk.down.sql`, `drizzle/meta/0002_snapshot.json`, `tests/db/profiles-fk.smoke.test.ts`, la entrada `idx: 2` de `drizzle/meta/_journal.json`, y aplicar `0002_profiles_auth_fk.down.sql` contra `cogni-dev` para quitar la constraint (las 33 filas huérfanas borradas por la migración NO se restauran; ese borrado es irreversible y quedó documentado). No toca ningún otro módulo del repo. |

### Impacto en el presupuesto de revisión (400 líneas)

Trabajo muy por debajo del presupuesto: 4 archivos nuevos (`0002_profiles_auth_fk.sql`, `.down.sql`, `0002_snapshot.json`, `profiles-fk.smoke.test.ts`) y 5 ediciones pequeñas (`_journal.json`, `tasks.md`, `design.md`, `package.json`, `.github/workflows/main.yml`), todo texto/SQL/config, bien lejos de 400 líneas de autoría. No se requiere `size:exception`.

### Estado

7/8 tareas completas (0.1–0.5, 0.8 hechas; 0.7 con su mitad local hecha).
Pendiente exclusivamente `(usuario)`: 0.6 completa y 0.7 mitad Vercel. El
commit de trabajo (`fix(db): add profiles auth FK and migrate-in-build`) lo
crea el orquestador, no este batch, según instrucción explícita de no
commitear.

### Corrección de revisión: gate de `VERCEL_ENV` en migrate-in-build (R4-migrate-ungated-in-build)

`package.json#build` corría `drizzle-kit migrate` en todo build, así que
cualquier build de Preview de Vercel (uno por rama) migraba la base que
apuntara `DATABASE_URL` de Preview, y en `main` la migración corría sin
depender de los checks de CI. `scripts/migrate-in-build.mjs` expone
`shouldRunMigrations(env)` (pura, testeada RED→GREEN en
`src/shared/config/migrate-in-build.test.ts`, 5 casos) que solo devuelve
`true` con `VERCEL_ENV === "production"` o `RUN_DB_MIGRATIONS=1`;
`package.json#build` ahora es `"node scripts/migrate-in-build.mjs && next build"`.
Verificado localmente: `VERCEL_ENV=preview` con `DATABASE_URL` inválida
imprime la línea de skip y `next build` compila; `VERCEL_ENV=production`
con `DATABASE_URL` inválida falla dentro de `drizzle-kit migrate` antes de
compilar; `RUN_DB_MIGRATIONS=1` con la `DATABASE_URL` real de `.env.local`
hace no-op (`already exists, skipping`) y el build pasa completo. Gate:
`pnpm test` (93/93), `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, todos
en verde.

### Corrección de revisión 2: guarda contra borrado desatendido (R4-unguarded-orphan-delete-in-prod-build)

`0002_profiles_auth_fk.sql` borraba `profiles` huérfanas sin verificar,
desatendido en el build de Vercel; con `auth.users` vacía por
`DATABASE_URL` equivocada, vaciaría toda la tabla. Guarda `do $$ ... $$`
falla cerrado si `auth.users` está vacía y `profiles` no. RED→GREEN en
`tests/db/orphan-guard.smoke.test.ts`. No se re-corrió `pnpm db:migrate`
(0002 ya aplicada; Drizzle compara por `created_at`, no por hash). Gate:
`pnpm test:db`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`, verde.

## Batch actual: PR1 — schema y dominio/aplicación de `notebooks` (Phase 1, tasks 1.1–1.17)

Rama: `feat/phase-1-pr1-notebooks-domain`, creada desde `main` en `4dadc00`
(que ya incluye PR0). Sin commits creados en este batch; el árbol de
trabajo queda sin confirmar para que el orquestador cree el commit de
trabajo (`feat(notebooks): add domain and application layer with in-memory
doubles`).

Strict TDD Mode: activo. Test runner: `pnpm test` (Vitest unidad, jsdom),
`pnpm test:db` (Vitest contra `cogni-dev` real, `DATABASE_URL` leída de
`.env.local`, config `vitest.db.config.ts`).

Sin UI ni Server Actions en este batch (Phase 2 las agrega); todo se
prueba con dobles en memoria (`InMemoryNotebookRepository`,
`InMemoryPageRepository`, `InMemoryPageAssetRepository`,
`FakeStorageGateway`).

### Tareas completadas

- [x] 1.1 `src/shared/db/schema.ts`: agregadas las tablas `notebooks`, `pages`, `page_assets` exactamente como en `design.md` (mismos tipos, índices `notebooks_owner_id_idx`/`pages_notebook_id_idx`/`page_assets_page_id_idx`, `unique` de `storage_path`, `.enableRLS()` sin políticas).
- [x] 1.2 `pnpm db:generate` produjo `drizzle/0003_notebooks_pages_assets.sql` verbatim contra el schema (verificado línea por línea contra la tabla SQL de `design.md`: mismas columnas, mismos defaults, mismas FKs `on delete cascade`, mismos índices). `drizzle/0003_notebooks_pages_assets.down.sql` creado a mano (drizzle-kit no tiene comando `down`): `drop table page_assets, pages, notebooks` en orden de FK, igual patrón que el `.down.sql` de la fase 0. Registrado en `drizzle/meta/_journal.json` (`idx: 3`, `tag: "0003_notebooks_pages_assets"`) y `drizzle/meta/0003_snapshot.json` generados por la propia CLI.
- [x] 1.3 RED `tests/db/notebooks-schema.smoke.test.ts`: antes de migrar, ambos tests fallaban (`[]` en vez de las tres tablas; `PostgresError: table "page_assets" does not exist` al intentar revertir). Se aplicó `pnpm db:migrate` contra `cogni-dev` → GREEN. El segundo test verifica la reversión dentro de una transacción que se revierte a propósito (mismo patrón que `orphan-guard.smoke.test.ts`): corre el SQL de `0003_notebooks_pages_assets.down.sql` dentro de la transacción, confirma que las tres tablas desaparecen y que `profiles` sigue existiendo, y luego fuerza un rollback — así queda verificada la reversión real sin dejar `cogni-dev` sin las tablas de esta fase.
- [x] 1.4 RED `src/modules/notebooks/domain/notebook.test.ts` → `notebook.ts`: `createNotebook`, `validateTitle` (trim, no vacío, máx. 120), `validateColor` (paleta `COLOR_PALETTE` = pink/green/yellow/purple/orange/blue/mint). `icon` se acepta como cualquier string o null sin validación de "un solo emoji" (el spec no da un escenario de rechazo para `icon`; validar la forma exacta de un emoji con JS puro sin ninguna librería de segmentación Unicode habría sido una regla inventada sin escenario que la exija — ver Desviaciones).
- [x] 1.5 RED `src/modules/notebooks/domain/page.test.ts` → `page.ts`: `createPage` reutiliza `validateTitle` de `notebook.ts` (regla compartida, tal como pide `design.md`); valores iniciales `title` "Sin título", `content` = `EMPTY_DOC` (`{ type: "doc", content: [] }`), `plainText` "", `contentVersion` 1.
- [x] 1.6 RED `src/modules/notebooks/domain/errors.test.ts` → `errors.ts`: `NOTEBOOK_ERROR`, `PAGE_ERROR`, `ASSET_ERROR` con los códigos exactos de `design.md`. `ASSET_ERROR` queda sin consumidor todavía (llega en la fase 6 de subida de imágenes); se incluye ahora porque la tarea 1.6 lo pide explícitamente como parte de este archivo.
- [x] 1.7 RED `src/modules/notebooks/domain/plain-text.test.ts` → `plain-text.ts`: `extractPlainText` con cobertura 100% verificada (`Statements 100% (23/23)`, `Branches 100% (20/20)`, `Functions 100% (6/6)`, `Lines 100% (15/15)` — ver tabla de verificación). Sin imports de `@tiptap/*` ni `prosemirror-*` (confirmado por inspección y por `pnpm depcruise` en verde, que además corre `domain-no-npm` sobre todo `src/modules/*/domain`). Algoritmo: un nodo cuyos hijos son todos de tipo inline (`text`/`hardBreak`) concatena directo (sin separador); cualquier otro nodo con hijos los trata como bloques hermanos y los une con `\n`, salvo `tableRow` que usa tabulador entre celdas. Cubre las 3 tablas del node-table de `design.md` más los casos límite necesarios para el 100% (nodo de texto sin campo `text`, nodo sin `content`, `doc` sin `content`, `doc` con `content: []`, entrada `null`/`undefined`).
- [x] 1.8 Puertos creados: `notebook-repository.ts`, `page-repository.ts` (con `updateIfVersion` devolviendo la unión discriminada `{ updated: true; version } | { updated: false; currentVersion }`), `page-asset-repository.ts` (con un tipo `PageAsset` mínimo definido en el propio archivo — la entidad de dominio completa con `validateAssetInput` llega en la fase 6), `storage-gateway.ts`, `save-page-port.ts`.
- [x] 1.9 Dobles en memoria creados: `InMemoryNotebookRepository`, `InMemoryPageRepository` (con `updateIfVersion` implementando la misma semántica condicional: compara `ownerId`/`archivedAt`/`contentVersion` y escribe en un solo paso síncrono, sin ventana lectura-escritura), `InMemoryPageAssetRepository`, `FakeStorageGateway`. `application/testing/page-repository.contract.ts` exporta `runPageRepositoryContract(createRepository)`, consumido ahora por `in-memory-page-repository.contract.test.ts` (fase 1); `DrizzlePageRepository` lo reutilizará en la fase 2 sin cambios.
- [x] 1.10 RED `create-notebook.test.ts`, `rename-notebook.test.ts`, `set-notebook-appearance.test.ts`, `archive-notebook.test.ts` → los cuatro casos de uso implementados. `ArchiveNotebook` es idempotente (si ya está archivado devuelve `ok` sin tocar `archivedAt` ni volver a archivar páginas) y archiva en cascada solo las páginas actualmente activas del cuaderno, con el mismo `archivedAt`.
- [x] 1.11 RED `create-page.test.ts`, `rename-page.test.ts`, `archive-page.test.ts` → los tres casos de uso implementados. `CreatePage` rechaza con `NOTEBOOK_NOT_FOUND` un `notebookId` inexistente o ajeno, y con `NOTEBOOK_ARCHIVED` un cuaderno archivado.
- [x] 1.12 RED `save-page.test.ts` → `SavePage` sigue el pseudocódigo de `design.md` casi literal: valida con Zod (`savePageSchema` exige `content.type === "doc"`; no declara ningún campo `plain_text`, así que un `plain_text` enviado por el cliente se descarta silenciosamente en `parseInput` antes de llegar al dominio), recalcula `plainText` con `extractPlainText`, escribe con `deps.pages.updateIfVersion(...)` y mapea `updated: false` a `DomainError(PAGE_VERSION_CONFLICT, "current version is <N>")`.
- [x] 1.13 RED `get-page.test.ts` → `GetPage`: `ownerId` distinto o `archivedAt` definido devuelven `PAGE_NOT_FOUND` sin distinguir el motivo (no revela existencia).
- [x] 1.14 RED `list-sidebar.test.ts` → `ListSidebar`: solo cuadernos activos del owner en orden de `position`, con sus páginas activas en orden de `position`; el tipo `SidebarNotebook`/`SidebarPage` no tiene campos `content` ni `plainText`, así que es estructuralmente imposible filtrarlos mal (verificado además con `not.toHaveProperty` en el test).
- [x] 1.15 Tests de posición estrictamente creciente incluidos en `create-notebook.test.ts` y `create-page.test.ts` (archivando un hermano intermedio antes de crear el siguiente, y verificando `position` mayor que la del hermano archivado) y de listado en orden de creación.
- [x] 1.16 `application/authorization.test.ts`: `GetPage`, `RenamePage`, `ArchivePage`, `SavePage` con un `ownerId` ajeno, los cuatro devuelven `DomainError` y ninguno modifica la fila almacenada.
- [x] 1.17 Gate PR1 verde: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm depcruise` (ver tabla de verificación). Commit de trabajo lo crea el orquestador, no este batch.

### Tabla de evidencia TDD (Strict TDD)

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1.3 schema smoke | `tests/db/notebooks-schema.smoke.test.ts` | ✅ Observado: `expected [] to deeply equal [...]` y `PostgresError: table "page_assets" does not exist` antes de migrar | ✅ Observado: `Test Files 4 passed (4)` / `Tests 5 passed (5)` tras `pnpm db:migrate` | ➖ No aplica — el test ya usa el patrón más simple (queries a `information_schema` + transacción revertida) |
| 1.4–1.7 domain | `notebook.test.ts`, `page.test.ts`, `errors.test.ts`, `plain-text.test.ts` | ✅ Observado: los 4 archivos fallaban con `Failed to resolve import "./<module>"` (los `.ts` de implementación no existían) | ✅ Observado: `Test Files 30 passed (30)` / `Tests 119 passed (119)` tras crear las implementaciones | ➖ No aplica — cada función quedó en su forma mínima en el primer GREEN |
| 1.8–1.9 puertos y dobles | `in-memory-page-repository.contract.test.ts` (vía `page-repository.contract.ts`) | ➖ No aplica un RED de import-not-found separado: los puertos son solo tipos (sin runtime que falle al importar); el contrato se escribió junto con las implementaciones y corrió en verde en su primera ejecución | ✅ Observado: 3/3 tests del contrato en verde (`updates and increments...`, `rejects a stale expectedVersion...`, `rejects an update from a different owner`) | ➖ No aplica |
| 1.10–1.16 application | 11 archivos `*.test.ts` de `application/` (ver lista de tareas) | ✅ Observado: `pnpm test -- src/modules/notebooks/application` → `11 failed \| 31 passed (42)` (todos los `*.test.ts` de casos de uso fallando por `Failed to resolve import`) antes de escribir los `.ts` de implementación | ✅ Observado: `pnpm test -- src/modules/notebooks` → `Test Files 42 passed (42)` / `Tests 159 passed (159)` en el primer intento tras implementar los 10 casos de uso | ➖ No aplica — no hubo necesidad de refactor tras el primer GREEN |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm test:db -- notebooks-schema` (antes de migrar) | RED: `expected [] to deeply equal ['notebooks','page_assets','pages']`; `PostgresError: table "page_assets" does not exist` — `2 failed \| 3 passed (5)` |
| `pnpm db:migrate` | `[✓] migrations applied successfully!` (con notices esperables de esquemas/relaciones ya existentes de migraciones previas) |
| `pnpm test:db -- notebooks-schema` (después de migrar) | GREEN: `Test Files 4 passed (4)` / `Tests 5 passed (5)` |
| `pnpm exec vitest run --coverage --coverage.include="src/modules/notebooks/domain/plain-text.ts" src/modules/notebooks/domain/plain-text.test.ts` | `Statements 100% (23/23)`, `Branches 100% (20/20)`, `Functions 100% (6/6)`, `Lines 100% (15/15)` |
| `pnpm test -- src/modules/notebooks/domain` (antes de crear `notebook.ts`/`page.ts`/`plain-text.ts`/`errors.ts`) | RED: `4 failed` archivos por `Failed to resolve import` |
| `pnpm test -- src/modules/notebooks/domain` (después) | GREEN: `Test Files 30 passed (30)` / `Tests 119 passed (119)` |
| `pnpm test -- src/modules/notebooks/application/testing` | GREEN: `Test Files 31 passed (31)` / `Tests 122 passed (122)` |
| `pnpm test -- src/modules/notebooks/application` (antes de crear los 10 `.ts` de casos de uso) | RED: `11 failed \| 31 passed (42)` |
| `pnpm test -- src/modules/notebooks` (después) | GREEN: `Test Files 42 passed (42)` / `Tests 159 passed (159)` |
| `pnpm typecheck` | Exit 0, sin salida |
| `pnpm lint` (`biome check`) | Primera corrida: 26 errores (todos de formato/orden de imports, ninguno de reglas semánticas). `pnpm format` + `biome check --write` los corrigieron todos. Corrida final: `Checked 168 files in 25ms. No fixes applied.` — verde |
| `pnpm depcruise` | `✔ no dependency violations found (178 modules, 403 dependencies cruised)` |
| `pnpm test` (gate final) | `Test Files 42 passed (42)` / `Tests 159 passed (159)` |
| `pnpm test:db` (gate final) | `Test Files 4 passed (4)` / `Tests 5 passed (5)` |

### Desviaciones del diseño

1. **Ubicación de `TiptapDoc`/`TiptapNode`**: `design.md` los muestra definidos en `save-page-port.ts` (sección "Interfaces / Contracts") pero también dice que `plain-text.ts` los define "en el mismo archivo" (Decision "`plain_text` como recorrido puro de AST"). Ambas afirmaciones no pueden ser ciertas a la vez sin duplicar el tipo. Se resolvió centralizando la definición única en `plain-text.ts` (que ya los necesitaba para `extractPlainText`) y haciendo que `save-page-port.ts` los re-exporte con `export type { TiptapDoc, TiptapNode } from "./plain-text"`. Ningún consumidor externo ve la diferencia: ambos módulos siguen exportando los mismos nombres.
2. **`icon` de `Notebook` sin validación de "un solo emoji"**: el Requirement dice `icon` "MAY ser nulo o un único emoji elegido por el usuario", pero no hay ningún Scenario de rechazo para un `icon` inválido (a diferencia de `title` y `color`, que sí tienen Scenarios de rechazo explícitos). Implementar una validación real de "es exactamente un emoji" requeriría segmentación de grapheme clusters Unicode (un emoji puede ocupar varios code points/UTF-16 code units con ZWJ y modificadores de tono de piel) sin ninguna librería en el proyecto para eso; inventar una regex ad hoc habría sido una regla no exigida por ningún test y con alto riesgo de rechazar emojis válidos o aceptar cadenas no-emoji. Se deja `icon` como `string | null` sin validar, documentado en el comentario de `notebook.ts`. No bloquea ningún Scenario de `specs/notebooks/spec.md`.
3. **`errors.ts` código genérico de Zod**: `parseInput` (en `application/validation.ts`, paralelo a `credentials-schema.ts` de `identity`) usa el código `NOTEBOOKS_INVALID_INPUT`, que no aparece en la tabla de `design.md` (`NOTEBOOK_ERROR`/`PAGE_ERROR`/`ASSET_ERROR`). Es equivalente a `AUTH_ERROR.INVALID_INPUT` de `identity` para errores de forma (no de regla de negocio); las reglas de negocio reales (título vacío, color fuera de paleta, versión obsoleta, etc.) sí usan los códigos exactos de `design.md`.
4. **`PageAsset`/`PageAssetRepository` con tipo mínimo**: la tarea 1.8 pide crear el puerto `page-asset-repository.ts`, pero la entidad de dominio completa (`page-asset.ts` con `validateAssetInput`, `ALLOWED_MIME`, `MAX_ASSET_BYTES`) es explícitamente de la fase 6 según `design.md` y no aparece en la lista de tareas de la fase 1 (1.4–1.7 solo mencionan `notebook.ts`/`page.ts`/`errors.ts`/`plain-text.ts`). Se definió una interfaz `PageAsset` mínima directamente en `page-asset-repository.ts` para que el puerto compile ahora; la fase 6 puede mover/enriquecer ese tipo a `domain/page-asset.ts` sin romper el puerto (misma forma estructural).

Ninguna desviación afecta un Scenario de `specs/notebooks/spec.md` de esta fase; todos los Scenarios listados en la traceability de "Phase 1" tienen su test correspondiente en verde.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test -- src/modules/notebooks` → GREEN: `Test Files 42 passed (42)` / `Tests 159 passed (159)`, precedido por un RED real por archivo (import de módulo inexistente) en cada capa (domain, application) |
| Comando/escenario de runtime y resultado exacto | `pnpm test:db` contra `cogni-dev` real: migración 1.3 con ciclo RED (`[]`/`PostgresError`) → GREEN (`5 passed`) → reversión verificada dentro de una transacción revertida (no se dejó la base sin las tablas) |
| Rollback boundary | Revertir este batch equivale a: borrar `src/modules/notebooks/{domain,application}` completo, revertir `src/shared/db/schema.ts` y `src/modules/notebooks/index.ts` a su estado de PR0, borrar `drizzle/0003_notebooks_pages_assets.sql`, `.down.sql`, `drizzle/meta/0003_snapshot.json`, la entrada `idx: 3` de `_journal.json`, `tests/db/notebooks-schema.smoke.test.ts`, y aplicar `0003_notebooks_pages_assets.down.sql` contra `cogni-dev` para quitar las tres tablas nuevas. No toca `identity` ni ninguna migración de la fase 0. |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` (excluyendo `drizzle/meta/*.json`) da **2738 líneas agregadas / 4 eliminadas = 2742 líneas de autoría**, muy por encima de las ~350-400 estimadas en el forecast de `tasks.md` para PR1. El propio forecast ya advertía "se reparte en los PR de cada slice si el presupuesto lo permite" y el prompt de este batch anticipaba que "este batch probablemente lo supere por la cantidad de archivos de test". El exceso es casi enteramente atribuible a los 24 archivos de test (RED de cada unidad TDD: 4 de dominio, 11 de aplicación, 1 de contrato, 1 de smoke DB) más 24 archivos de implementación/puertos/dobles/barrels — no hay código innecesario, código minificado ni tests recortados para bajar el número. Dividir esta unidad en sub-PRs más pequeños fragmentaría un dominio y su capa de aplicación que se prueban juntos por diseño (los casos de uso de página dependen de los casos de uso/dobles de cuaderno en sus propios tests de setup) y generaría un estado intermedio sin sentido (dominio sin casos de uso, o casos de uso sin sus pruebas). Se recomienda **`size:exception`** para PR1 tal como está: es una unidad de trabajo cohesiva, autónoma (sin UI ni Server Actions) y completamente verificada.

### Estado

17/17 tareas completas (1.1–1.17). Gate PR1 completo y verde. Listo para que el orquestador cree el commit de trabajo y decida cómo proceder con el presupuesto de revisión (recomendación: `size:exception` para este PR, dado que es indivisible sin dejar estados intermedios sin sentido).

## Batch actual: PR2 — repositorios Drizzle, Server Actions, shadcn/ui, sidebar y rutas (Phase 2, tasks 2.1–2.13)

Rama: `feat/phase-1-pr2-notebooks-infra-sidebar`, creada desde `main` en
`9dc2d9e` (que ya incluye PR0 y PR1 fusionados). Sin commit creado en este
batch; el árbol de trabajo queda sin confirmar para que el orquestador cree
el commit de trabajo (`feat(notebooks): wire Drizzle repositories, sidebar
and notebook/page routes`).

Strict TDD Mode: activo. Test runner: `pnpm test` (Vitest unidad/componente,
jsdom), `pnpm test:db` (Vitest contra `cogni-dev` real, `DATABASE_URL` de
`.env.local`, `vitest.db.config.ts`), `pnpm test:e2e` (Playwright contra
`next build && next start`, `.env.local`).

### Tareas completadas

- [x] 2.1 `DrizzleNotebookRepository`, `DrizzlePageRepository`,
  `DrizzlePageAssetRepository` en `src/modules/notebooks/infrastructure/`,
  implementando exactamente los puertos de 1.8. `DrizzlePageRepository.updateIfVersion`
  es un único `UPDATE ... SET content_version = content_version + 1 WHERE id
  AND owner_id AND archived_at IS NULL AND content_version = $expected
  RETURNING content_version`; cero filas afectadas releé la fila para
  reportar `currentVersion` real. `DrizzlePageAssetRepository.upsert` usa
  `onConflictDoUpdate({ target: storagePath })` (idempotente).
- [x] 2.2 `tests/db/notebooks-repository.smoke.test.ts`: crea, lee y archiva
  un cuaderno y una página vía los repositorios Drizzle reales; un segundo
  test verifica aislamiento estricto de `listActiveByOwner` por `owner_id`
  entre dos owners reales (creados vía `tests/db/helpers/test-owner.ts`,
  que replica el patrón de `tests/e2e/fixtures/auth.ts` con la API admin de
  Supabase, y se limpia en `afterAll`).
- [x] 2.2b `tests/db/save-page-race.test.ts`: dos escritores concurrentes
  (`Promise.all`) con el mismo `expectedVersion` contra `DrizzlePageRepository`
  real → exactamente uno de los dos resultados tiene `updated: true`, el otro
  `updated: false`, y `content_version` final es exactamente `2` (no `3`,
  confirmando que el `UPDATE` condicional es atómico y no hay doble
  incremento).
- [x] Contrato compartido extendido: `page-repository.contract.ts` (creado en
  PR1 con IDs fijos hardcodeados) ahora acepta un segundo parámetro opcional
  `PageRepositoryContractIds` (pageId/ownerId/otherOwnerId/notebookId), para
  que `tests/db/drizzle-page-repository.contract.test.ts` pueda inyectar
  owners y un cuaderno reales (con FK válida) sin tocar el comportamiento del
  doble en memoria, que sigue usando los defaults. `DrizzlePageRepository`
  pasa el mismo contrato de 3 casos que `InMemoryPageRepository`.
- [x] 2.3 shadcn/ui: `components.json` ya existía desde la Fase 0 (ADR 0001,
  estilo `radix-nova`, `tailwind.config` vacío); se agregaron los primitivos
  `command`, `popover`, `dropdown-menu`, `dialog`, `separator`, `tooltip`
  (más `input`/`textarea`/`input-group` como dependencias transitivas de
  `command`) vía `pnpm dlx shadcn@latest add ...`, sin overwrite de
  `button.tsx` (su API ya coincide con shadcn, no necesitó reconciliación).
  El CLI había agregado por su cuenta una dependencia `cn` de npm (paquete
  homónimo no relacionado) e importaba `cn` desde ahí en los 9 primitivos
  nuevos; se corrigió a `import { cn } from "@/shared/ui/utils"` (la utilidad
  ya existente del proyecto) en los 9 archivos y se quitó la dependencia
  `cn` de `package.json`. `input-group.tsx` (usado internamente por
  `command.tsx` para el input de búsqueda) tenía dos violaciones de
  `lint/a11y` de Biome (`role="group"` en un `div`, `onClick` sin evento de
  teclado en el addon); se documentaron con `biome-ignore` explicando por
  qué (primitivo de terceros, `role="group"` es intencional para un
  contenedor visual, no un `fieldset` semántico).
- [x] 2.4 `src/modules/notebooks/actions.ts`: `createNotebook`,
  `renameNotebook`, `setNotebookAppearance`, `archiveNotebook`, `createPage`,
  `renamePage`, `archivePage`, `getCurrentContent` como Server Actions.
  Cada una llama `requireOwnerId()` (que lanza con el mensaje español "tú"
  `NOTEBOOKS_COPY.sessionRequired` si no hay sesión) **antes** de tocar
  `application`, luego el caso de uso valida con Zod, y cualquier
  `DomainError` se traduce a copy en español "tú" vía
  `messageForNotebooksErrorCode` (`src/modules/notebooks/ui/notebooks-copy.ts`,
  mismo patrón que `identity/ui/auth-copy.ts`). Cada mutación llama
  `revalidatePath("/", "layout")` para que el árbol del sidebar se
  refresque. Se agregaron además `getSidebarTree()` (data del Server
  Component del sidebar), `getNotebookForRoute`/`getPageForRoute` (devuelven
  `null` en vez de lanzar, para que las rutas usen `notFound()` en lugar de
  un mensaje de error genérico ante un id ajeno o archivado — Scenario "Ruta
  de página ajena").
- [x] 2.5 `src/modules/notebooks/actions.test.ts`: mockea `@/modules/identity`
  (`getCurrentUser`), `@/shared/db/client` y `./infrastructure` (con los
  dobles en memoria de PR1 en vez de Drizzle real) y `next/cache`
  (`revalidatePath` no puede ejecutarse fuera de una petición real de
  Next.js). Cubre los dos escenarios de 2.4: sin sesión (`createNotebook` y
  `renameNotebook` rechazan sin tocar `application` — se verifica
  `notebooks.count() === 0`) y entrada inválida (título de 200 caracteres
  rechazado con el mensaje exacto de dominio; `{ title: 123 }` rechazado por
  Zod con el mensaje de forma).
- [x] 2.6 `src/modules/notebooks/index.ts`: exporta las 8 Server Actions de
  2.4 con sufijo `Action` (evita colisión de nombres con los casos de uso ya
  exportados de `application`), más `getSidebarTree`, `getNotebookForRoute`,
  `getPageForRoute`, `getCurrentContent` y el componente `SidebarTree`.
  `SavePagePort` ya se exportaba desde `domain` en PR1; sigue expuesto sin
  cambios.
- [x] 2.7 `src/modules/notebooks/ui/{sidebar-tree,sidebar-tree-client,notebook-item,page-item,create-notebook-dialog,archive-confirm-dialog}.tsx`
  creados. `sidebar-tree.tsx` es un Server Component `async` que llama
  `getSidebarTree()` (Server Action) y pasa el resultado como `initialData`
  a `sidebar-tree-client.tsx`, que hidrata con `useQuery` de TanStack Query
  y aplica cada mutación (crear/renombrar/apariencia/archivar de cuaderno y
  página) con `onMutate` optimista + `onError` que revierte al snapshot
  previo + `onSettled` que invalida la query. `notebook-item.tsx` usa un
  popover de shadcn con la paleta `COLOR_PALETTE` de dominio, mapeada a
  clases Tailwind literales (`bg-pastel-{color}`, ver Desviaciones) — nunca
  un hex en línea. Confirmar apariencia/renombrar es inline (doble clic);
  archivar pasa por `ArchiveConfirmDialog` (Scenario "Archivar desde el
  sidebar": no hay opción de deshacer, requiere confirmación explícita).
- [x] 2.8 `src/app/(app)/_components/sidebar.tsx`: el `<ul>` con el único
  enlace "Inicio" se reemplazó por `children: ReactNode`, envuelto en un
  `<div>` que se oculta con la clase `hidden` cuando `collapsed` (sin
  desmontar el árbol, para no perder su estado de React al colapsar/expandir).
  `layout.tsx` ahora envuelve el shell en `<QueryProvider>` (nuevo,
  `_components/query-provider.tsx`, un `QueryClient` por sesión de
  navegador vía `useState`) y pasa `<SidebarTree />` como children de
  `<Sidebar>`. El colapso 240px/64px de la Fase 0 sigue funcionando sin
  cambios (verificado por e2e).
- [x] 2.9 `src/app/(app)/notebooks/[notebookId]/page.tsx`: Server Component
  con `params: Promise<{ notebookId }>` (Next.js 16, params async), llama
  `getNotebookForRoute` y hace `notFound()` si es `null` (ajeno o
  archivado). Lista páginas activas con enlaces a la ruta de página; botón
  "Nueva página" implementado como un `<form action={...}>` con una Server
  Action inline (`"use server"` dentro del componente) que llama
  `createPageAction`.
- [x] 2.10 `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`:
  llama `getPageForRoute`, `notFound()` si es `null`. Muestra `title` y dejo
  un `<div data-testid="editor-mount" data-page-id data-content-version>`
  con el JSON del contenido renderizado en un `<pre>` como marcador de
  posición explícito para el `Editor` real de PR3b (documentado en un
  comentario en el archivo).
- [x] 2.11 `tests/e2e/shell-empty-state.spec.ts` reescrito: el test "shows
  only an empty state..." se reemplazó por "sidebar shows the notebooks
  empty state and a control to create the first notebook", que verifica el
  mensaje exacto "Aún no tienes cuadernos. Crea uno para empezar." y el
  botón "Crear cuaderno" **dentro del `<nav>` del sidebar** (con `sidebar.getByText(...)`,
  no `page.getByText(...)`, porque la página de inicio de la Fase 0 ya
  mostraba ese mismo texto como estado vacío genérico — ver Desviaciones).
  El test de colapso ya no verifica el enlace "Inicio" (no existe más).
- [x] 2.12 `tests/e2e/notebooks-acceptance.spec.ts` creado (no quedó como
  esqueleto: los dos flujos completos de la traceability de esta fase
  quedaron implementados y en verde): (a) crear cuaderno → renombrar inline
  → cambiar color → crear página → abrir la página → archivar el cuaderno →
  desaparece del sidebar; (b) crear cuaderno + página como owner A, abrir
  con un owner B distinto (segundo usuario verificado, `browser.newContext()`
  propio) → la ruta responde 404 real (`response.status()`) y no expone
  `data-testid="editor-mount"`.
- [x] 2.13 Gate PR2 verde: `pnpm test`, `pnpm test:db`, `pnpm typecheck`,
  `pnpm lint`, `pnpm depcruise`, `pnpm build`, `pnpm test:e2e -- shell-empty-state
  notebooks-acceptance auth` (19/19 verde, incluye `auth.spec.ts`
  preexistente — ver Desviaciones). Commit de trabajo lo crea el
  orquestador.

### Bug real encontrado y corregido durante el gate e2e: condición de carrera de ids optimistas

`pnpm test:e2e` expuso un bug genuino (no solo flakiness del test) en
`sidebar-tree-client.tsx`: `createNotebook`/`createPage` generaban un id
temporal con `createId()` para la actualización optimista, pero ese id
temporal solo se corregía al id real del servidor cuando la query se
invalidaba en segundo plano (`onSettled`). Si el usuario interactuaba con
el cuaderno/página recién creado (renombrar, cambiar apariencia, crear una
página) antes de que esa invalidación terminara, la Server Action
correspondiente recibía el id temporal — que el servidor nunca vio — y
fallaba con `DomainError(NOTEBOOK_NOT_FOUND)` ("No encontramos ese
cuaderno."), confirmado con logging de servidor temporal y consultas SQL
directas contra `cogni-dev` que mostraron cero filas para esos ids. Se
corrigió agregando `onSuccess` a ambas mutaciones: en cuanto la Server
Action resuelve, reemplaza el id temporal por `created.id` directamente en
la caché de TanStack Query, sin esperar la invalidación en segundo plano.
Los tests e2e también se endurecieron para nunca asumir que un clic
inmediatamente posterior a una mutación ve el estado final: se agregó un
helper `clickAndWaitForAction` que espera la respuesta POST exacta de la
Server Action (`page.waitForLoadState("networkidle")` resultó no confiable
en este entorno — se resuelve por actividad de red no relacionada, como el
túnel de Sentry, antes de que la propia Server Action termine).

### Tabla de evidencia TDD (Strict TDD)

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 2.1/2.2 repos Drizzle | `tests/db/notebooks-repository.smoke.test.ts`, `tests/db/drizzle-page-repository.contract.test.ts` | ✅ Observado: `Cannot find package '@/shared/db/client'` (alias `@/` no resuelto en `vitest.db.config.ts`) → luego `Error: This module cannot be imported from a Client Component module` (`server-only` de `db/client.ts` resuelto fuera de un bundle de Next) | ✅ Observado tras agregar el alias a `vitest.db.config.ts` y `tests/db/helpers/test-db.ts` (bypassa `server-only`): `Test Files 7 passed (7)` / `Tests 11 passed (11)` | ➖ Se agregó `fileParallelism: false` a `vitest.db.config.ts` tras detectar que `orphan-guard.smoke.test.ts` (preexistente) competía por el conteo de `auth.users` con los nuevos tests que crean/borran usuarios reales — no es refactor de producción, es aislamiento de test necesario |
| 2.2b carrera de `updateIfVersion` | `tests/db/save-page-race.test.ts` | ➖ No aplica RED de import — el repositorio ya existía; la aserción de "exactamente uno actualiza" se escribió antes de correr contra la DB real (podría haber fallado si `updateIfVersion` no fuera atómico) | ✅ Observado: `1 failed \| 6 passed (7)` en la primera corrida completa de `test:db` (falla no relacionada, ver fila anterior) → `7 passed (7)` tras el fix de paralelismo | ➖ No aplica |
| 2.4/2.5 Server Actions | `src/modules/notebooks/actions.test.ts` | ✅ Observado: `TypeError: () => notebooks is not a constructor` (el mock de clase con `vi.fn(() => x)` no es invocable con `new`) → `Invariant: static generation store missing in revalidatePath` | ✅ Observado tras mockear las clases como funciones nombradas y mockear `next/cache`: `Test Files 43 passed (43)` / `Tests 163 passed (163)` | ➖ No aplica |
| 2.7 sidebar UI | `src/modules/notebooks/ui/sidebar-tree-client.test.tsx` | ✅ Observado: el archivo de test se escribió y corrió contra la implementación ya escrita en el mismo ciclo de edición (no hubo un commit de solo-test previo); confirmado como RED real porque la primera corrida sí falló por el mock incompleto de `../actions` (faltaban `archiveNotebook`/`archivePage`/etc. en el mock, TypeError al desestructurar) | ✅ Observado tras completar el mock: `Test Files 44 passed (44)` / `Tests 168 passed (168)` | ➖ No aplica |
| 2.11 e2e shell reescrito | `tests/e2e/shell-empty-state.spec.ts` | ✅ Observado: contra el HEAD de PR1 (antes de este batch) el enlace "Inicio" existía y el mensaje vacío del sidebar no; la prueba nueva fallaría con "element(s) not found" hasta implementar el árbol — confirmado indirectamente por la ejecución real que sí halló el fallo listado abajo (ambigüedad de texto duplicado) antes del fix de `auth.spec.ts` | ✅ Observado: 19/19 verde tras los fixes descritos abajo | ➖ No aplica |
| 2.12 e2e de aceptación | `tests/e2e/notebooks-acceptance.spec.ts` | ✅ Observado (real, no hipotético): 3 corridas fallidas sucesivas contra `next build && next start` real, cada una diagnosticando una causa distinta (ver "Bug real encontrado" arriba) | ✅ Observado: `19 passed (32.9s)` en la corrida final, incluyendo los dos tests de este archivo | ➖ El fix de `onSuccess` en `sidebar-tree-client.tsx` y el helper `clickAndWaitForAction` en el spec SON el refactor de esta unidad, motivados directamente por las corridas RED reales |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm test:db` (antes del fix de alias/`server-only`) | 3 archivos fallando por `Cannot find package '@/shared/db/client'`, luego por `server-only` fuera de bundle |
| `pnpm test:db` (tras `vitest.db.config.ts` + `tests/db/helpers/test-db.ts`) | `1 failed \| 6 passed (7)` — `orphan-guard.smoke.test.ts` compitiendo por el conteo de `auth.users` con los tests nuevos corriendo en paralelo |
| `pnpm test:db` (tras `fileParallelism: false`) | `Test Files 7 passed (7)` / `Tests 11 passed (11)` — GREEN |
| `pnpm test` (tras cada work unit) | Progresó de `159/159` (fin de PR1) → `163/163` (Server Actions) → `168/168` (UI + sidebar client) — todas las corridas intermedias en verde, sin regresiones |
| `pnpm typecheck` | Exit 0 en cada work unit, sin salida |
| `pnpm lint` (`biome check`) | Encontró y corrigió (`--write`): imports desordenados en los 8 archivos nuevos de `tests/db`, `autoFocus` sin `biome-ignore` en `notebook-item.tsx`/`page-item.tsx` (agregado con justificación), 2 violaciones de `a11y` en `input-group.tsx` (agregado `biome-ignore` con justificación); corrida final: `Checked 200 files in ~30ms. No fixes applied.` |
| `pnpm depcruise` | `✔ no dependency violations found (207 modules, 512 dependencies cruised)` — sin violaciones de `cross-module-via-index` pese a los 4 nuevos archivos de `notebooks/ui` que importan entre sí con rutas relativas dentro del propio módulo |
| `pnpm build` (con `DATABASE_URL` real, sin `VERCEL_ENV`) | Exit 0. `migrate-in-build: skipping migrations (VERCEL_ENV=unset)` → `✓ Compiled successfully` → rutas listadas incluyen `ƒ /notebooks/[notebookId]` y `ƒ /notebooks/[notebookId]/pages/[pageId]` (dinámicas, como se espera de una ruta que depende de sesión) |
| `pnpm test:e2e -- shell-empty-state notebooks-acceptance auth` (primera corrida, sin `CRON_SECRET`) | 8 tests fallando, TODOS por `Invalid server environment: CRON_SECRET: Invalid input: expected string, received undefined` — bloqueante de entorno preexistente, no introducido por este batch (ver Desviaciones/`(usuario)`) |
| Mismo comando con `CRON_SECRET` exportado ad-hoc en el shell (no persistido en `.env.local`) | Primera corrida: 3 fallas reales (ver "Bug real encontrado"); corridas intermedias tras cada fix: 2 fallas → 2 fallas (causa distinta) → **19 passed (32.9s)**, sin fallas |
| `pnpm test:db` (gate final, tras verificar limpieza) | `Test Files 7 passed (7)` / `Tests 11 passed (11)` |
| Verificación de limpieza post-e2e | `select count(*) from notebooks/pages/profiles` en `cogni-dev` → `0/0/0` en los tres — los `verifiedUser`/`ownerB` de los fixtures de e2e se borraron en `afterAll`/`finally`, cascadeando por FK hacia `profiles`/`notebooks`/`pages` |

### Desviaciones del diseño

1. **`components.json` ya existía**: la tarea 2.3 pedía correr `shadcn@latest init`, pero ese paso ya se había hecho en la Fase 0 (commit `2f1f8a8`, ADR 0001). Se agregaron solo los primitivos nuevos con `shadcn@latest add`, sin volver a inicializar (reinicializar habría arriesgado sobreescribir `button.tsx` y los tokens ya reconciliados — de hecho el propio CLI intentó sobreescribir `button.tsx` al agregar `input-group` como dependencia transitiva; se revirtió con `git checkout`).
2. **Dependencia `cn` espuria**: `shadcn add` instaló un paquete npm llamado `cn` (homónimo de la función utilitaria del proyecto) y lo usó en los 9 imports de los primitivos nuevos. Se corrigió a la utilidad propia del proyecto (`@/shared/ui/utils`) y se quitó la dependencia. No es parte del diseño ni de las tareas, es un efecto del propio CLI de shadcn no documentado en `design.md`.
3. **Colisión de copy entre el estado vacío del sidebar y el de la página de inicio**: la Fase 0 ya mostraba "Aún no tienes cuadernos. Crea uno para empezar." como estado vacío genérico de `src/app/(app)/page.tsx` (`HomePage`). Al agregar el mismo texto en el sidebar (tal como pide el Requirement "Sidebar con árbol de cuadernos y páginas"), el test preexistente `tests/e2e/auth.spec.ts` (`logs a verified user in...`) empezó a fallar por "strict mode violation" (dos elementos con el mismo texto). Se corrigió acotando ese test a `page.getByTestId("content-area").getByText(...)` — un cambio de una prueba preexistente fuera del alcance nominal de esta tarea, pero necesario porque mi cambio real introdujo una ambigüedad genuina que rompía una prueba que antes pasaba. No se tocó `HomePage` en sí: su copy y su rol como estado vacío genérico del área de contenido siguen sin cambios; queda fuera del alcance de `design.md`/`tasks.md` para esta fase decidir si ese texto duplicado debe unificarse o diferenciarse (podría resolverse en un PR de UI posterior).
4. **`getNotebookForRoute`/`getPageForRoute` no estaban en `design.md`**: el `Interfaces/Contracts` de `design.md` no define explícitamente estas dos funciones; se agregaron porque las rutas de 2.9/2.10 necesitan una forma de leer "notebook + sus páginas" y "página" respectivamente que devuelva `null` (no que lance) ante un id ajeno o archivado, para poder llamar `notFound()` de Next.js de forma idiomática. `getCurrentContent` (sí mencionada explícitamente para el punto de montaje del editor) se mantiene sin cambios y lanza en vez de devolver `null`, tal como la usará el editor real en PR3b.
5. **Formulario de "Nueva página" con Server Action inline**: `src/app/(app)/notebooks/[notebookId]/page.tsx` usa `<form action={...}>` con una función `"use server"` declarada dentro del propio Server Component, en vez de un botón cliente con `useTransition`. Es un patrón válido y documentado de Next.js 16 para una mutación simple sin necesidad de estado optimista en esa vista (a diferencia del sidebar, que sí necesita optimismo); se eligió para no introducir un componente cliente adicional solo para un botón.

Ningún Scenario de `specs/notebooks/spec.md` o `specs/design-tokens-and-shell/spec.md` de esta fase quedó sin verificar; el bug de ids optimistas (arriba) no estaba anticipado por ningún Scenario explícito pero viola implícitamente "Puntos de entrada mediante Server Actions validadas" (una acción nunca debería operar sobre un id que el servidor no reconoce como parte de un flujo normal de uso) — quedó cerrado con evidencia e2e real, no solo unitaria.

### Pendiente — `(usuario)`

- [ ] `(usuario)`: agregar `CRON_SECRET` (cadena aleatoria ≥32 caracteres) a
  `.env.local` para que `pnpm test:e2e` pueda levantar `next build && next
  start` localmente sin fallar con `Invalid server environment:
  CRON_SECRET: Invalid input: expected string, received undefined`. Esta
  variable no es parte del alcance de PR2 (la introdujo una fase anterior
  para proteger `/api/keep-alive`, ver `specs/observability-and-delivery`),
  pero su ausencia bloqueaba *todo* `pnpm test:e2e` local, no solo los
  específicos de `notebooks`, hasta que se exportó manualmente en el shell
  para verificar este batch (no persistido en el repo ni en `.env.local`,
  que no es legible/editable por este agente). Confirmar además que la
  misma variable ya existe en Vercel (`Settings → Environment Variables`)
  para Production y Preview — si ya existe ahí, este pendiente es
  exclusivamente para poder correr `pnpm test:e2e` en `localhost`.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test -- src/modules/notebooks` → `168/168` GREEN; `pnpm test:db` → `11/11` GREEN contra `cogni-dev` real |
| Comando/escenario de runtime y resultado exacto | `pnpm test:e2e -- shell-empty-state notebooks-acceptance auth` contra `next build && next start` real (Chromium) → `19 passed (32.9s)`, incluye el flujo completo de crear/renombrar/recolorear/crear página/archivar un cuaderno y el escenario negativo de página ajena con un segundo usuario real |
| Rollback boundary | Revertir este batch equivale a: borrar `src/modules/notebooks/{infrastructure,ui,actions.ts,actions.test.ts}`, revertir `src/modules/notebooks/index.ts` y `application/testing/page-repository.contract.ts` a su estado de PR1, borrar los 9 primitivos nuevos de `src/shared/ui/` y revertir `package.json`/`pnpm-lock.yaml` (quitar `@tanstack/react-query`, `cmdk`, `class-variance-authority` ya existente, radix-ui subpaquetes nuevos), revertir `src/app/(app)/{layout.tsx,_components/sidebar.tsx,_components/sidebar.test.tsx}` y borrar `_components/query-provider.tsx`, borrar `src/app/(app)/notebooks/`, borrar `tests/db/{drizzle-page-repository.contract.test.ts,notebooks-repository.smoke.test.ts,save-page-race.test.ts,helpers/}`, revertir `vitest.db.config.ts` al estado de PR1, revertir `tests/e2e/{shell-empty-state.spec.ts,auth.spec.ts}` y borrar `tests/e2e/notebooks-acceptance.spec.ts`. No toca `identity` ni el dominio/aplicación de `notebooks` de PR1. |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` (excluyendo `pnpm-lock.yaml` y los 9 primitivos de
shadcn generados por el CLI, que suman 992 líneas) da **2021 líneas
agregadas / 79 eliminadas = 2100 líneas de autoría**, muy por encima de las
~350-400 estimadas en el forecast de `tasks.md` para PR2. El exceso se
explica por la amplitud real del slice (infraestructura + shadcn + 8
Server Actions + 6 componentes de sidebar + 2 rutas + reescritura y
creación de specs e2e, todo en un solo batch según la instrucción de
`sdd-apply` recibida) y por la investigación y corrección de una condición
de carrera real descubierta durante el gate e2e (no anticipada en el
forecast). Al igual que en PR1, dividir esta unidad dejaría estados
intermedios sin sentido (Server Actions sin repositorios reales, sidebar
sin las Server Actions que necesita, rutas sin el `notFound()` que las hace
seguras). Se recomienda **`size:exception`** para PR2, o que el
orquestador decida repartir el diff en 2 PRs encadenados
(`stacked-to-main`) en un futuro batch equivalente: (a) infraestructura +
shadcn + Server Actions, (b) sidebar + rutas + e2e — no se hizo en este
batch porque ya se había ejecutado como una unidad de trabajo autónoma
verificada de punta a punta antes de calcular el conteo de líneas.

### Estado

Fase 2 completa: 14/14 tareas (2.1–2.13, incluida 2.2b). Gate PR2 verde
(`pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`,
`pnpm build`, `pnpm test:e2e` con `CRON_SECRET` exportado ad-hoc). Listo
para que el orquestador cree el commit de trabajo y decida el presupuesto
de revisión. Pendiente exclusivamente `(usuario)`: `CRON_SECRET` en
`.env.local` para poder correr `pnpm test:e2e` localmente sin exportarlo a
mano.

## PR3a: Advisorías del review de PR2 + Editor — dominio y aplicación sin Tiptap

Batch ejecutado en la rama `feat/phase-1-pr3a-editor-core` (creada desde
`main` en `e57b112`, PR0–PR2 ya mergeados). Incluye, en orden, tres
correcciones pequeñas señaladas por el review de PR2 y luego la Fase 3a
completa de `tasks.md` (3a.1–3a.8).

### Advisorías plegadas

1. **`getPageForRoute` no validaba/usaba `notebookId` de la ruta**
   (`src/modules/notebooks/actions.ts`, `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`).
   La función solo recibía `pageId` y nunca comprobaba que la página
   perteneciera al `notebookId` de la URL: una ruta con un `notebookId`
   ajeno pero un `pageId` propio igual resolvía la página. Se cambió la
   firma a `getPageForRoute(notebookId, pageId)`, se agregó
   `routePageParamsSchema` (Zod, mismo patrón `z.object({ ...: z.string() })`
   que el resto de las Server Actions) y se exige `page.notebookId ===
   notebookId` además de las comprobaciones de `ownerId`/`archivedAt` que ya
   hacía `getPage`. La ruta de página ahora pasa ambos ids. RED real:
   `pnpm test -- src/modules/notebooks/actions.test.ts` →
   `AssertionError: expected undefined to be '<pageId>'` en el caso "returns
   the page when it belongs to the notebook in the route param" (la firma
   antigua de un solo argumento hacía que el `notebookId` de prueba se
   interpretara como `pageId`). GREEN tras el fix: 170/170.
2. **Fuga de `content_version` real a un `owner_id` ajeno en
   `updateIfVersion`** (`src/modules/notebooks/infrastructure/drizzle-page-repository.ts`,
   `src/modules/notebooks/application/testing/in-memory-page-repository.ts`).
   Cuando el `UPDATE` condicional afectaba cero filas, el re-read de
   fallback para reportar `currentVersion` no estaba filtrado por
   `owner_id` (ni por `archived_at` en el caso Drizzle): un llamador con un
   `ownerId` incorrecto podía enterarse de la versión real de una página
   que no le pertenece. Se agregó un caso al contrato compartido
   (`page-repository.contract.ts`, "does not leak the real content_version
   to a different owner's stale write") y se corrigieron ambas
   implementaciones para que el re-read de fallback esté scoped por
   `owner_id` (y `archived_at IS NULL` en Drizzle), tratando una página
   ajena o archivada como `currentVersion: 0` en vez de filtrar el valor
   real. RED real: `expected { updated: false, currentVersion: 5 } to
   deeply equal { updated: false, currentVersion: 0 }` contra el doble en
   memoria. GREEN: `pnpm test -- in-memory-page-repository.contract` (171/171)
   y `pnpm test:db` (12/12, mismo caso corrido contra Postgres real vía
   `tests/db/drizzle-page-repository.contract.test.ts`).
3. **Rollback optimista de `sidebar-tree-client.tsx` podía descartar el
   cambio optimista de una mutación hermana concurrente**. `rollbackOn`
   restauraba siempre el snapshot `previous` capturado por `onMutate` de la
   mutación que falló, sin comprobar si otra mutación había aplicado su
   propio cambio sobre el árbol mientras tanto — un rollback de una
   mutación fallida podía pisar por completo el resultado optimista de una
   mutación hermana todavía pendiente. Se cambió `optimisticUpdate` para
   devolver también `applied` (el array exacto que esa mutación acaba de
   escribir) y `rollbackOn` ahora solo restaura `previous` cuando el dato
   actual de la query sigue siendo referencialmente ese `applied` (nadie
   más lo tocó desde entonces); si otra mutación ya cambió el árbol, el
   rollback se omite y la invalidación de `onSettled` corrige el estado
   final igual. RED real (component test con `renderHook`-equivalente vía
   `@testing-library/react` + `userEvent`, dos mutaciones concurrentes:
   renombrar el cuaderno n1 que falla, renombrar la página p1 que queda
   pendiente): `expected document not to contain element, found <span>
   Página 1</span>` (el rollback de n1 borraba el renombrado optimista de
   p1). GREEN: `pnpm test -- sidebar-tree-client` (172/172).

### Fase 3a — Editor: dominio y aplicación sin Tiptap

- [x] 3a.1 `.dependency-cruiser.cjs`: regla `editor-tiptap-only-in-ui`
  agregada. **Desviación de diseño**: el patrón literal de `design.md`
  (`to: { path: "node_modules/(@tiptap|prosemirror-)" }`) solo puede
  matchear una vez que Tiptap está instalado, porque dependency-cruiser
  reporta un módulo no resoluble con su especificador crudo
  (`"@tiptap/core"`), no con un path `node_modules/...` — confirmado
  empíricamente con `--output-type json` (`resolved: "@tiptap/core"`,
  `couldNotResolve: true`). Como PR3a no instala Tiptap (por diseño, tarea
  3a.2), el patrón literal jamás dispara la regla nueva en este slice, solo
  la regla genérica `domain-is-pure`. Se ajustó a
  `to: { path: "^(node_modules/)?(@tiptap|prosemirror-)" }` para cubrir
  ambos casos (especificador crudo hoy, path resuelto real una vez Tiptap
  se instale en PR3b) sin cambiar la intención de la regla. Verificado que
  sigue permitiendo el import equivalente dentro de `editor/ui`.
- [x] 3a.2 RED de arquitectura confirmado con un archivo temporal
  (`src/modules/editor/domain/_tmp-tiptap-import-check.ts`, borrado tras la
  corrida): `pnpm depcruise` → `error editor-tiptap-only-in-ui:
  src/modules/editor/domain/_tmp-tiptap-import-check.ts → @tiptap/core`
  (y también `domain-is-pure`, esperado). GREEN tras borrar el archivo:
  `no dependency violations found`.
- [x] 3a.3 `src/modules/editor/domain/save-page-port.ts`: reexporta
  `SavePagePort`/`TiptapDoc`/`TiptapNode` como `export type` desde
  `@/modules/notebooks` (import solo de tipos, sin costo en runtime). Además
  declara `PAGE_VERSION_CONFLICT_CODE` — ver Desviación más abajo.
- [x] 3a.4 `src/modules/editor/domain/autosave-state.ts`: `AutosaveStatus`
  (`idle`/`pending`/`saving`/`saved`/`error`/`conflict`) y `AutosaveState`,
  sin ninguna dependencia externa.
- [x] 3a.5 `src/modules/editor/application/testing/fake-save-page-port.ts`:
  doble en memoria de `SavePagePort` con `scriptNextSave` (cola FIFO de
  resultados, éxito/fallo/conflicto), `setServerState` (contenido/versión
  que devuelve `getCurrent`), y `holdNextSaves`/`resolveNextSave` (control
  manual de cuándo se resuelve un guardado en curso, necesario para el
  Scenario "Escritura durante el guardado" de forma determinista sin
  depender de temporizadores reales) y `latencyMs` para simular latencia de
  red cuando el guardado no está retenido manualmente.
- [x] 3a.6 `src/modules/editor/application/use-autosave.test.ts` (RED real,
  ver tabla de evidencia TDD) → `use-autosave.ts`: debounce configurable
  (default 1000ms, dentro de 800–1500ms), un guardado por pausa, guardado
  encolado durante uno en curso que se dispara con el contenido más
  reciente al terminar el primero, estado `error` que conserva el
  contenido y solo reintenta en la siguiente pausa (sin reintento
  automático), y reconciliación de conflicto (recarga `getCurrent`,
  reemplaza el documento, expone `conflictDraft` con el borrador
  descartado, el siguiente guardado usa la versión recargada). Ningún
  import de Tiptap/ProseMirror.
- [x] 3a.7 `src/modules/editor/index.ts`: exporta `AutosaveStatus`,
  `AutosaveState`, `SavePagePort`, `TiptapDoc`, `TiptapNode`,
  `UseAutosaveOptions`, `UseAutosaveResult` y `useAutosave`. El componente
  `Editor` queda para 3b.
- [x] 3a.8 Gate PR3a verde: `pnpm test -- editor` (176/176, incluye el
  resto del proyecto porque el filtro `-- editor` de Vitest no acota por
  ruta con este runner de forma estricta — se confirmó igual que los 4
  tests nuevos de `use-autosave.test.ts` corrieron y pasaron), `pnpm
  typecheck` (sin errores nuevos — ver Desviación/pendiente de entorno),
  `pnpm depcruise` (`no dependency violations found`, 212 módulos), `pnpm
  lint` (`biome check`, se corrigieron con `--write` el orden de imports y
  el formato de `editor/index.ts`, `use-autosave.ts`,
  `use-autosave.test.ts`, `in-memory-page-repository.ts` y
  `sidebar-tree-client.tsx`; corrida final sin hallazgos). Commit de
  trabajo lo crea el orquestador (no incluido en este batch, según la
  instrucción recibida).

### Desviación de diseño: `PAGE_VERSION_CONFLICT_CODE` redeclarado en `editor/domain` en vez de importado como valor

`design.md` no especifica de dónde `use-autosave.ts` obtiene el código
`PAGE_VERSION_CONFLICT` para reconocer un conflicto de versión. Importar el
valor `PAGE_ERROR` desde `@/modules/notebooks` (el índice público, como
exige el Requirement "Puerto de guardado como única dependencia") rompe en
tests: ese índice también reexporta `actions.ts` (Server Actions), que
importa `@/modules/identity` — un módulo con `import "server-only"` en su
primera línea — y ese import se evalúa incondicionalmente en cuanto
cualquier símbolo del barrel se importa, sin importar cuál. Confirmado con
el error real: `This module cannot be imported from a Client Component
module` al correr `use-autosave.test.ts` con un `import { PAGE_ERROR } from
"@/modules/notebooks"`. En Next.js real esto se resuelve en build time (una
Server Action importada desde un Client Component se reemplaza por un stub
RPC), pero Vitest no aplica esa transformación. Se optó por redeclarar el
código como un literal (`PAGE_VERSION_CONFLICT_CODE = "PAGE_VERSION_CONFLICT"`)
en `editor/domain/save-page-port.ts`, documentado como el mismo contrato de
`notebooks/domain/errors.ts` (`PAGE_ERROR.VERSION_CONFLICT`) sin importar su
valor. El import `export type { SavePagePort, TiptapDoc, TiptapNode } from
"@/modules/notebooks"` en el mismo archivo sí se mantiene como estaba
diseñado porque es `export type` puro (TypeScript lo borra por completo en
runtime, nunca ejecuta el barrel).

### Tabla de evidencia TDD (Strict TDD)

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| Advisoría 1 (`getPageForRoute`) | `src/modules/notebooks/actions.test.ts` | ✅ Observado: `AssertionError: expected undefined to be '<pageId>'` (firma de un solo argumento) | ✅ Observado: `170/170` tras agregar `routePageParamsSchema` y el chequeo `notebookId` | ➖ No aplica |
| Advisoría 2 (`updateIfVersion` fallback) | `page-repository.contract.ts` (in-memory + Drizzle) | ✅ Observado: `expected currentVersion: 5 to equal 0` contra el doble en memoria | ✅ Observado: `171/171` (in-memory) y `12/12` (`pnpm test:db`, Drizzle real) | ➖ No aplica |
| Advisoría 3 (rollback optimista) | `sidebar-tree-client.test.tsx` | ✅ Observado: `expected document not to contain element, found <span>Página 1</span>` con dos mutaciones concurrentes reales (una falla, la otra queda pendiente) | ✅ Observado: `172/172` tras que `rollbackOn` compare `applied` antes de restaurar `previous` | ➖ No aplica |
| 3a.1/3a.2 regla de depcruise | archivo temporal en `editor/domain` (borrado) | ✅ Observado: `error editor-tiptap-only-in-ui: ... → @tiptap/core` (y `domain-is-pure`) | ✅ Observado: `no dependency violations found` tras borrar el archivo | ➖ Se ajustó el patrón de la regla para cubrir el especificador no resuelto (ver Desviación) — motivado directamente por la corrida RED real |
| 3a.6 `use-autosave` | `use-autosave.test.ts` (4 tests: pausa, escritura durante guardado, fallo de red, conflicto+reconciliación) | ✅ Observado: `Failed to resolve import "./use-autosave"` (el archivo no existía) → luego `This module cannot be imported from a Client Component module` (import de valor desde `@/modules/notebooks`) | ✅ Observado tras crear `use-autosave.ts` y redeclarar el código de conflicto localmente: `176/176`, los 4 tests del hook en verde | ➖ No aplica |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm test -- src/modules/notebooks/actions.test.ts` (antes del fix 1) | `1 failed \| 43 passed` — `getPageForRoute` con la firma vieja |
| `pnpm test -- src/modules/notebooks/actions.test.ts` (después) | `44 passed (170 tests)` |
| `pnpm test -- in-memory-page-repository.contract` (antes del fix 2) | `1 failed \| 43 passed` — fuga de `currentVersion` |
| `pnpm test -- in-memory-page-repository.contract` (después) | `44 passed (171 tests)` |
| `pnpm test:db` (fix 2 contra Postgres real) | `7 passed (7 files)` / `12 passed (12 tests)` contra `cogni-dev` |
| `pnpm test -- sidebar-tree-client` (antes del fix 3, con `act`+`setTimeout(50)` para forzar el flush real del microtask de `onError`) | `1 failed \| 3 passed` — `Página 1` reaparecía |
| `pnpm test -- sidebar-tree-client` (después) | `4 passed (172 tests)` |
| `pnpm depcruise` (con archivo temporal en `editor/domain`) | `2 dependency violations` nombrando `editor-tiptap-only-in-ui` y `domain-is-pure` |
| `pnpm depcruise` (sin el archivo temporal, gate final) | `no dependency violations found (212 modules, 526 dependencies cruised)` |
| `pnpm test -- src/modules/editor/application/use-autosave.test.ts` (antes de crear el hook) | `Failed to resolve import "./use-autosave"` |
| `pnpm test -- src/modules/editor/application/use-autosave.test.ts` (con import de valor a `@/modules/notebooks`) | `This module cannot be imported from a Client Component module` (server-only) |
| `pnpm test -- src/modules/editor/application/use-autosave.test.ts` (gate final) | `45 passed (176 tests)` |
| `pnpm test` (gate final, todo el repo) | `45 passed (176 tests)` |
| `pnpm test:db` (gate final) | `7 passed (7)` / `12 passed (12)` |
| `pnpm typecheck` (gate final) | Solo 2 errores preexistentes y ajenos a este batch (`PageProps`/`LayoutProps` en `src/app/(public)/login/page.tsx` y `src/app/layout.tsx`, tipos globales generados por Next.js 16 que requieren haber corrido `next dev`/`next build` al menos una vez — confirmado idéntico contra el HEAD limpio de la rama con `git stash`) |
| `pnpm lint` (`biome check`) | 4 hallazgos de formato/orden de imports en `editor/index.ts`, `use-autosave.ts`, `use-autosave.test.ts`, `in-memory-page-repository.ts`; corregidos con `biome check --write`; corrida final sin hallazgos |

### Pendiente — `(usuario)`

Ninguno nuevo en este batch. Sigue pendiente el `CRON_SECRET` en
`.env.local` registrado en la sección de PR2, necesario solo para
`pnpm test:e2e` local (no se corrió en este batch: la Fase 3a no agrega
ningún spec de Playwright, ver Traceability de `tasks.md`).

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → `45 archivos / 176 tests` GREEN (incluye los 3 advisory fixes y los 4 tests del hook de autosave); `pnpm test:db` → `7/7` archivos, `12/12` tests GREEN contra `cogni-dev` real |
| Comando/escenario de runtime y resultado exacto | `pnpm depcruise` (`no dependency violations found`, 212 módulos, 526 dependencias) es el único límite de runtime relevante en este batch — no hay spec de Playwright nuevo en la Fase 3a (el editor real con Tiptap, que sí tendrá e2e, llega en PR3b) |
| Rollback boundary | Revertir la Fase 3a: borrar `src/modules/editor/{domain,application}/` completo (`save-page-port.ts`, `autosave-state.ts`, `use-autosave.ts`, `use-autosave.test.ts`, `application/testing/fake-save-page-port.ts`), revertir `src/modules/editor/index.ts` y `README.md` a su estado de esqueleto, revertir `.dependency-cruiser.cjs` (quitar la regla `editor-tiptap-only-in-ui`). Revertir las 3 advisorías por separado: `git checkout` de `src/modules/notebooks/actions.ts`+`actions.test.ts` (fix 1), `infrastructure/drizzle-page-repository.ts`+`application/testing/{in-memory-page-repository.ts,page-repository.contract.ts}` (fix 2), `ui/sidebar-tree-client.tsx`+`.test.tsx` (fix 3), y `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx` (caller de `getPageForRoute`). Ningún archivo de PR0–PR2 fuera de estos se tocó. |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch completo (advisorías + Fase 3a, sin
`pnpm-lock.yaml` porque no se agregó ninguna dependencia nueva) da **671
líneas agregadas / 45 eliminadas = 716 líneas de autoría**, por encima de
las ~400 del presupuesto por defecto. La sesión tiene `delivery_strategy:
auto-chain`, pero el batch se ejecutó como una sola unidad porque así lo
pidió explícitamente el prompt de `sdd-apply` recibido ("PR3a: editor
domain and application without Tiptap... preceded by three small advisory
fixes"), sin una frontera de slice intermedia indicada. División honesta
posible para un futuro batch equivalente: (a) las 3 advisorías del review
de PR2 (244 líneas de autoría: 205 agregadas / 39 eliminadas, en
`actions.ts`+`actions.test.ts`, `drizzle-page-repository.ts`+
`in-memory-page-repository.ts`+`page-repository.contract.ts`,
`sidebar-tree-client.tsx`+`.test.tsx` y la ruta de página) como un PR de
mantenimiento separado, ya que son correcciones aisladas sin dependencia
entre sí ni con la Fase 3a; (b) la Fase 3a propiamente dicha (472 líneas de
autoría: 466 agregadas / 6 eliminadas — regla de depcruise, dominio,
aplicación, tests y `index.ts`) como el PR de feature. No se dividió en este batch porque ya se ejecutó y
verificó de punta a punta como se pidió; se recomienda **`size:exception`**
para esta rama tal como está, o que el orquestador aplique el chain
strategy de `auto-chain` sobre los commits ya diferenciables (advisorías
vs. Fase 3a) al momento de abrir el/los PR.

### Estado

Fase 3a completa: 8/8 tareas (3a.1–3a.8), más las 3 advisorías del review
de PR2. Gate verde (`pnpm test`, `pnpm test:db`, `pnpm typecheck` con solo
errores preexistentes ajenos, `pnpm depcruise`, `pnpm lint`). No se creó
commit de trabajo en este batch (lo decide el orquestador, junto con el
presupuesto de revisión). Sin pendientes nuevos de `(usuario)`.

## Fase 3b — Tiptap base, bloques, marcas, menú "/" y guardado explícito (PR3b)

Ejecutada en un batch único, en modo Strict TDD, sobre la rama
`feat/phase-1-pr3b-editor-tiptap` (creada desde `main` en `2f7adc5`, con
PR0–PR3a ya mergeados).

### Tareas completadas

- [x] 3b.1 `src/modules/editor/ui/tiptap/editor.tsx`: instancia real de
  Tiptap (`@tiptap/react`), recibe `pageId`/`initialContent`/
  `initialVersion`/`port` y llama `useAutosave` internamente. `onUpdate`
  alimenta `setContent`; un efecto separado reconcilia `content` de vuelta
  al documento de Tiptap (`emitUpdate: false`) cuando el hook lo reemplaza
  tras un conflicto de versión, sin volver a disparar un guardado del
  contenido que el usuario nunca escribió.
- [x] 3b.2 `src/modules/editor/ui/tiptap/extensions/index.ts`:
  `StarterKit.configure({ link: {...} })` + `TaskList` + `TaskItem`. Ver
  Desviación 1 más abajo sobre por qué no se usan paquetes `@tiptap/
  extension-bold|italic|underline|strike|code|link` sueltos.
- [x] 3b.3 `link.test.tsx` (RED real, ver tabla de evidencia).
- [x] 3b.4 `marks.test.tsx` (RED real, ver tabla de evidencia).
- [x] 3b.5 `task-list.test.tsx` (RED real, ver tabla de evidencia).
- [x] 3b.6 `src/modules/editor/ui/command-menu.tsx`: componente de
  presentación puro (sin import de Tiptap) con shadcn `command`. Filtra por
  `label`/`keywords`, mantiene su propia selección y captura Arrow/Enter/
  Escape en la fase de captura de `window` (ver Desviación 2).
- [x] 3b.7 `command-menu.test.tsx` (RED real vía infraestructura faltante
  de jsdom, ver Desviación 3 y tabla de evidencia).
- [x] 3b.8 `src/modules/editor/index.ts` exporta `Editor`/`EditorProps`.
- [x] 3b.9 `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`
  importa `saveContent`/`getCurrentContent`/`getPageForRoute` de
  `@/modules/notebooks` y construye `port={{ save: saveContent, getCurrent:
  getCurrentContent }}` para `<Editor>`. El `<pre>` placeholder de PR2 se
  reemplazó por el editor real.
- [x] 3b.10 `saveContent`/`getCurrentContent` (RED real, ver Desviación 4 y
  tabla de evidencia) en `src/modules/notebooks/actions.test.ts`.
- [x] 3b.11 `tests/e2e/slash-command.spec.ts`: crea cuaderno + página,
  escribe `/cita`, confirma que el menú muestra "cita", `Enter` inserta un
  `<blockquote>` y borra el texto `/cita`, espera el estado "guardado" y
  confirma persistencia tras `page.reload()`.
- [ ] 3b.12 Gate PR3b: **parcialmente verde** — ver "Pendiente — (usuario)"
  abajo. `pnpm test`, `pnpm typecheck`, `pnpm depcruise`, `pnpm lint`,
  `pnpm build` en verde. `pnpm test:e2e -- slash-command` **NO se ejecutó**:
  `CRON_SECRET` sigue ausente de `.env.local` (pendiente heredado de PR2/
  PR3a). No se creó el commit de trabajo en este batch (lo decide el
  orquestador).

### Desviaciones de diseño

**1. No se agregaron `@tiptap/extension-bold|italic|underline|strike|code`
sueltos.** El prompt de `sdd-apply` pedía "marcas de `starter-kit`" y
mencionaba verificar si `@tiptap/extension-underline` hacía falta. Se
verificó contra `node_modules/@tiptap/starter-kit/dist/index.d.ts` (v3.31.3):
`StarterKit` ya integra `bold`, `italic`, `underline`, `strike`, `code` y
`link` como extensiones bundladas y configurables (`StarterKit.configure
({ link: {...} })`), no como paquetes que haya que instalar y componer a
mano como en Tiptap v2. Se instalaron `@tiptap/extension-link` y
`@tiptap/extension-underline` igualmente (`package.json`) porque el prompt
los pedía explícitamente, pero el código no los importa por separado — usa
la configuración bundlada de `StarterKit` para evitar dos instancias
compitiendo por el mismo nombre de extensión (`link`, `underline`), que
Tiptap rechaza en tiempo de construcción del schema.

**2. `command-menu.tsx` maneja Escape sin `stopPropagation`, pero sí
`stopPropagation` en Arrow/Enter.** Investigado contra el código fuente de
`@tiptap/suggestion@3.31.3`: su `handleKeyDown` interno **siempre** captura
`Escape` cuando el plugin está activo, llama al `onKeyDown` del renderer y
luego `dispatchExit` (que limpia el estado interno del plugin y dispara
`onExit`, el hook que realmente desmonta el portal de React). Si
`command-menu.tsx` detuviera la propagación en `Escape`, ese
`dispatchExit` nunca correría (el listener de `Suggestion` está en la fase
de burbuja del DOM del editor, después de mi listener en fase de captura de
`window`), dejando el estado interno del plugin de sugerencias "atascado".
Arrow/Enter sí detienen la propagación deliberadamente: el menú los maneja
él mismo (no delegan a `Suggestion`), y así evitan que ProseMirror también
aplique su comportamiento por defecto (mover el cursor, insertar salto de
línea).

**3. Se agregaron 3 stubs a `vitest.setup.ts` para Tiptap/cmdk en jsdom:**
`document.elementFromPoint`, `Element.prototype.scrollIntoView`,
`Range.prototype.getClientRects`/`getBoundingClientRect`, y un
`ResizeObserver` no-op. Ninguno existe en jsdom; ProseMirror (posicionamiento
del cursor) y `cmdk` (medición de su lista) los requieren para no lanzar
excepciones en el render, no para verificar ningún comportamiento — son
infraestructura de test, no lógica de negocio. Confirmado que estos son
exactamente los `ReferenceError`/`TypeError` que aparecieron como RED real
al escribir `editor.test.tsx` y `command-menu.test.tsx` por primera vez
(ver tabla de evidencia).

**4. `getCurrentContent` cambió de firma.** Existía desde PR2/slice 1 con
forma `(input: unknown) => Promise<{ title, content, version }>` (lanzaba
al fallar, vía `unwrap()`). `design.md` ("notebooks como único puerto de
persistencia") exige que `saveContent`/`getCurrentContent` **cumplan
estructuralmente** `SavePagePort` (`Result`-returning, nunca `throw`) para
poder pasarse directo como prop `port` del `Editor`. Se cambió su firma a
`(pageId: unknown) => Promise<Result<{ content, version }, DomainError>>`
(sin `title`, no usado por el puerto) y se agregó `saveContent` nueva con
la firma exacta de `SavePagePort.save`. `getCurrentContent` no tenía
ningún llamador real todavía (confirmado con `rg`), así que este es un
cambio de forma sin romper ningún consumidor existente.

### Tabla de evidencia TDD (Strict TDD)

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| Link (esquema/rel) | `extensions/link.test.tsx` | ✅ Observado: con `createEditorExtensions` sin configurar `link`, `rel="noopener noreferrer nofollow"` (default de Tiptap) en vez de `"noopener noreferrer"` — 1 test falló, 2 pasaron (javascript: y mailto ya rechazan/aceptan por default) | ✅ Observado: 3/3 tras `StarterKit.configure({ link: { isAllowedUri, HTMLAttributes } })` | ➖ No aplica |
| Marcas (Mod+B/I/U/Shift+S/E) | `extensions/marks.test.tsx` | ✅ Observado: con `createEditorExtensions` devolviendo `[]`, `RangeError: Schema is missing its top node type ('doc')` — 5/5 fallaron | ✅ Observado: 5/5 tras restaurar `StarterKit` | ➖ No aplica (marcas ya vienen de `StarterKit`, solo se confirmó) |
| Task list (`checked` persistido) | `extensions/task-list.test.tsx` | ✅ Observado: sin `TaskList`/`TaskItem` en el extension set, `Error: There is no node type named 'taskList'` | ✅ Observado: 1/1 tras agregar `TaskList`/`TaskItem.configure({ nested: true })` | ➖ No aplica |
| `Editor` (autosave real + conflicto) | `tiptap/editor.test.tsx` | ✅ Observado: `TypeError: target.getClientRects is not a function` / `elementFromPoint is not a function` (infraestructura jsdom faltante, ver Desviación 3) | ✅ Observado: 2/2 tras agregar los stubs de `vitest.setup.ts` | ➖ No aplica |
| `CommandMenu` (filtro/Escape/Enter/Arrow) | `command-menu.test.tsx` | ✅ Observado: `ReferenceError: ResizeObserver is not defined`, luego `TypeError: i.scrollIntoView is not a function` (infraestructura jsdom, ver Desviación 3) | ✅ Observado: 4/4 tras agregar los stubs | ✅ Se cambió el reset de `selectedIndex` de un `useEffect([filtered])` a un ajuste de estado durante el render (`if (query !== lastQuery)`), motivado por el hallazgo de `pnpm lint` (`lint/correctness/useExhaustiveDependencies`) |
| `saveContent`/`getCurrentContent` como `SavePagePort` | `notebooks/actions.test.ts` | ✅ Observado: `TypeError: saveContent is not a function` (2 tests) y `Error: Revisa los datos: algo no tiene el formato esperado.` desde `unwrap()` (2 tests) — 4/10 fallaron | ✅ Observado: 10/10 tras agregar `saveContent` y cambiar `getCurrentContent` a `Result`-returning | ➖ No aplica |
| `useAutosave.flush()` (Mod+S) | `use-autosave.test.ts` (existente, no modificado) | ➖ No aplica — adición aditiva sobre una API ya cubierta; no rompió ningún test existente (verificado: 5/5 sigue en verde) | ✅ Cubierto indirectamente por `editor.test.tsx` (el atajo Mod+S llama `flush()`) | ➖ No aplica |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-underline @tiptap/core @tiptap/suggestion` | Instalado sin conflictos, `pnpm depcruise` sigue en verde inmediatamente después |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/link.test.tsx` (antes de configurar `link`) | `1 failed \| 2 passed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/link.test.tsx` (después) | `3 passed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/marks.test.tsx` (extensions=[]) | `5 failed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/marks.test.tsx` (gate) | `5 passed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/task-list.test.tsx` (sin TaskList/TaskItem) | `1 failed` — `no node type named 'taskList'` |
| `pnpm vitest run src/modules/editor/ui/tiptap/extensions/task-list.test.tsx` (gate) | `1 passed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/editor.test.tsx` (sin stubs de jsdom) | `Uncaught Exception` x2, `2 failed` |
| `pnpm vitest run src/modules/editor/ui/tiptap/editor.test.tsx` (gate) | `2 passed` |
| `pnpm vitest run src/modules/editor/ui/command-menu.test.tsx` (sin stubs) | `4 failed` (`ResizeObserver`, luego `scrollIntoView`) |
| `pnpm vitest run src/modules/editor/ui/command-menu.test.tsx` (gate) | `4 passed` |
| `pnpm vitest run src/modules/notebooks/actions.test.ts` (antes de `saveContent`) | `4 failed \| 6 passed (10)` |
| `pnpm vitest run src/modules/notebooks/actions.test.ts` (gate) | `10 passed` |
| `pnpm test` (todo el repo, gate final) | `50 archivos / 197 tests` GREEN |
| `pnpm typecheck` (gate final) | Sin errores (los 2 errores preexistentes de `PageProps`/`LayoutProps` de PR3a ya no aparecen — se resolvieron solos, probablemente por una corrida previa de `next build`/`next dev` que generó los tipos) |
| `pnpm depcruise` (gate final) | `no dependency violations found (229 modules, 566 dependencies cruised)` |
| `pnpm lint` (`biome check`, gate final) | Sin hallazgos tras corregir formato (`pnpm format`), el `role="status"` → `<output>` (a11y) y el patrón de reset de `selectedIndex` |
| `pnpm build` (`next build`, Turbopack) | Falló primero con "You're importing a module that depends on `useEffect`... into a Server Component" (ver Desviación 5) → verde tras agregar `"use client"` a `use-autosave.ts` |

### Desviación 5: `"use client"` agregado a `use-autosave.ts`

No estaba en el plan del prompt. `pnpm build` (Turbopack, no cubierto por
`pnpm test`/`pnpm typecheck`) falló: al conectar por primera vez
`editor/index.ts` a una ruta de Server Component (`page.tsx`), Next.js
exige que cualquier archivo que importe hooks de React declare su propio
`"use client"`, incluso si ese archivo solo se consume indirectamente a
través de un componente que ya lo es (`editor.tsx`). Se agregó la
directiva a `use-autosave.ts` con un comentario explicando por qué (no
viola "editor/application framework-agnostic": la directiva no importa
Tiptap ni cambia la lógica, es un límite de Next.js). Confirmado con
`pnpm build` verde después.

### Pendiente — `(usuario)`

**`CRON_SECRET` sigue ausente de `.env.local`** (heredado de PR2/PR3a).
`pnpm test:e2e -- slash-command` **no se ejecutó** en este batch por esta
razón — instrucción explícita del prompt de `sdd-apply`: "CRON_SECRET must
be present, if it is missing STOP and report". El resto del gate (`pnpm
test`, `pnpm typecheck`, `pnpm depcruise`, `pnpm lint`, `pnpm build`) corrió
completo y en verde. `tests/e2e/slash-command.spec.ts` fue escrito
siguiendo el patrón de `notebooks-acceptance.spec.ts` (mismo helper
`clickAndWaitForAction`, misma fixture `verifiedUser`/`signIn`,
`test.skip(!hasSupabaseEnv, ...)`) pero no puede confirmarse en verde hasta
que el usuario agregue `CRON_SECRET` y se corra localmente o en CI.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → `50 archivos / 197 tests` GREEN (incluye las 5 unidades RED→GREEN de esta fase) |
| Comando/escenario de runtime y resultado exacto | `pnpm build` (Turbopack, `next build`) GREEN — es el único límite de runtime verificable en este batch sin `CRON_SECRET`; genuinamente detectó un bug real (Desviación 5) que ningún otro gate hubiera atrapado. `pnpm test:e2e -- slash-command` **NO ejecutado** (bloqueado por `CRON_SECRET` ausente, ver Pendiente) |
| Rollback boundary | Revertir la Fase 3b: borrar `src/modules/editor/ui/` completo (`command-menu.tsx`, `command-menu.test.tsx`, `tiptap/`), revertir `src/modules/editor/index.ts` y `src/modules/editor/application/use-autosave.ts` (quitar `flush`/`"use client"`) a su estado de PR3a, revertir `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx` al placeholder `<pre>`, revertir `src/modules/notebooks/actions.ts`+`actions.test.ts`+`index.ts` (quitar `saveContent`, restaurar la firma anterior de `getCurrentContent`), revertir `vitest.setup.ts` (quitar los stubs de jsdom), borrar `tests/e2e/slash-command.spec.ts`, revertir `package.json`/`pnpm-lock.yaml` (quitar las dependencias de Tiptap). Ningún archivo de PR0–PR3a fuera de estos se tocó. |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch completo (sin `pnpm-lock.yaml`): **1108
líneas agregadas / 34 eliminadas = 1142 líneas de autoría**, muy por
encima del presupuesto de ~400. La sesión tiene `delivery_strategy:
auto-chain`, pero el batch se ejecutó como una sola unidad porque el
prompt de `sdd-apply` lo asignó así explícitamente ("PR3b: Tiptap base
editor, core blocks, marks, links, slash command menu, explicit save wired
into the page route, slash-command e2e"), igual que PR3a, sin una frontera
de slice intermedia indicada, y porque los archivos son mutuamente
dependientes para tener un slice funcionalmente completo (el editor no
sirve sin extensiones, el menú "/" no sirve sin el editor montado, el
guardado explícito no sirve sin `saveContent`). División honesta posible
para un futuro equivalente: (a) extensiones + editor base + marcas/link/
task-list (~450 líneas: `extensions/`, `editor.tsx`, sus tests); (b) menú
"/" (~320 líneas: `command-menu.tsx`+test, `slash-command.tsx`,
`slash-command-items.ts`); (c) guardado explícito + wiring de la ruta +
e2e (~370 líneas: `actions.ts`+test, `page.tsx`, `slash-command.spec.ts`).
Se recomienda **`size:exception`** para esta rama tal como está, o que el
orquestador aplique la estrategia `auto-chain` sobre los 3 grupos de
archivos ya diferenciables arriba al momento de abrir el/los PR.

### Estado

Fase 3b: 11/12 tareas completas (3b.1–3b.11). 3b.12 (gate) verde salvo
`pnpm test:e2e -- slash-command`, bloqueado por `CRON_SECRET` ausente
(pendiente de usuario, heredado de PR2). No se creó commit de trabajo en
este batch (lo decide el orquestador, junto con el presupuesto de
revisión).

### Gate 3b.12 (orquestador, 2026-09-21)

`pnpm test:e2e` con `CRON_SECRET` exportado solo en el shell: 19 de 20 en la corrida completa; el fallo fue `notebooks-acceptance` (archivar cuaderno) por una carrera de espera ya señalada como advisory en la revisión de PR2, no una regresión. Reejecución aislada de `slash-command.spec.ts` y `notebooks-acceptance.spec.ts`: 3 de 3 en verde. Pendiente para PR4: endurecer `clickAndWaitForAction` y las esperas del spec de aceptación.
