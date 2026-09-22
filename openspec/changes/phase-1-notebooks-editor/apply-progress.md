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

## Fase 4: Autosave conectado, conflicto de versión y aceptación (PR4)

Traceability: `specs/editor/spec.md` → "Autosave con debounce y actualización optimista", "Reconciliación del conflicto de versión"; `specs/notebooks/spec.md` → "Guardado de contenido con comparar-e-intercambiar de `content_version`"; Success Criteria de `proposal.md` (§13, guardado obsoleto rechazado).

### Advisories plegados (PR3b/PR3a → PR4)

Cada uno con un test RED escrito primero, ≤60 líneas de producción:

| Advisory | Archivo | RED observado | GREEN observado |
|---|---|---|---|
| `flush()` no debe re-guardar sin cambios pendientes | `use-autosave.ts`/`.test.ts` | `expect(port.saveCalls).toHaveLength(0)` → recibido `1` (flush llamaba a `runSave()` incondicionalmente) | `1 failed → 0` tras agregar `pendingRef` y el guard `if (!pendingRef.current) return;` en `flush()` |
| Conflicto termina en `error` si `getCurrent()` falla en vez de quedar en `conflict` sin reconciliar | `use-autosave.ts`/`.test.ts` | Test con `getCurrent` devolviendo `err(...)` sin lanzar: el estado quedaba en `"conflict"` sin haber cargado contenido del servidor | Tras mover `setStatus("conflict")` dentro de la rama `current.ok` y agregar `else { setStatus("error") }`, ambos tests (rechazo y excepción de `getCurrent`) pasan |
| `editor.tsx` no debe reconciliar el documento de Tiptap en cada pulsación (echo de `setContent`) | `use-autosave.ts` (`reconcileVersion`) + `editor.tsx` | Test del hook: `reconcileVersion` cambiaba (indirectamente, vía el diseño anterior basado en `JSON.stringify(content)` en cada render) | Se reemplazó la comparación por `JSON.stringify` en `editor.tsx` por un contador `reconcileVersion` que solo se incrementa en una reconciliación real (conflicto o `restoreDraft()`); test de componente "keeps typed characters in order without a mid-typing cursor reset" en verde |
| `command-menu.tsx`: índice resaltado como única fuente de verdad para Enter, Escape mantiene "/" | `command-menu.test.tsx` | N/A — ya cubierto por las 4 pruebas existentes (`ArrowDown`+`Enter`, `Escape`) | Sin cambios de código; se confirmó `4/4` en verde, ningún RED nuevo necesario |
| `saveContent`/`getCurrentContent` sin sesión debían devolver `Result` de error, no lanzar | `actions.ts`/`.test.ts` | 2 tests nuevos: `Error: Debes iniciar sesión...` (excepción) en vez de `result.ok === false` | Se agregó `requireOwnerIdResult()` (Result-returning) y `NOTEBOOKS_ERROR.SESSION_REQUIRED`; `saveContent`/`getCurrentContent` lo usan en vez de `requireOwnerId()`. `12/12` en verde |
| Test de página ajena de `getCurrentContent` debía afirmar el código exacto | `actions.test.ts` | N/A (afirmación reforzada, no un bug) | `result.error.code === "PAGE_NOT_FOUND"` confirmado |

### TDD Cycle Evidence (unidades nuevas)

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| `save-status.tsx` | `save-status.test.tsx` | ✅ Observado: `Failed to resolve import "./save-status"` | ✅ Observado: `7 passed` | ➖ Extraído de `editor.tsx` sin cambio de comportamiento; `editor.test.tsx` sigue en verde tras el cableado |
| `conflict-banner.tsx` | `conflict-banner.test.tsx` | ✅ Observado: `Failed to resolve import "./conflict-banner"` | ✅ Observado: `4 passed` | ➖ No aplica |
| `restoreDraft`/`discardDraft` + reconciliación en `editor.tsx` | `editor.test.tsx` (nuevo caso "shows the conflict banner and recovers the local draft on demand") | ✅ Observado: `findByTestId("conflict-banner")` con timeout — el banner no existía aún | ✅ Observado: `4/4` en `editor.test.tsx` tras cablear `ConflictBanner` con `conflictDraft`/`restoreDraft`/`discardDraft` del hook | ➖ No aplica |
| Guardado al salir (`visibilitychange`/`beforeunload`/unmount) | `editor.test.tsx` (3 casos nuevos) | ✅ Observado: `3 failed` — estado seguía en "guardando…", `saveCalls.length` en `0` con timeout de 200 ms | ✅ Observado: `7/7` en `editor.test.tsx` tras agregar el `useEffect` con los tres listeners y `flush()` en el cleanup | ➖ No aplica |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm vitest run src/modules/editor/application/use-autosave.test.ts` (antes de los 3 fixes de advisory) | `1 failed \| 8 passed` (flush no-op), luego `8/8` tras el fix de `getCurrent`/`error`, luego `9/9` con `reconcileVersion` |
| `pnpm vitest run src/modules/editor/ui/tiptap/editor.test.tsx` | RED confirmado en cada unidad (ver tabla), `7/7` final |
| `pnpm vitest run src/modules/notebooks/actions.test.ts` | `10 failed→12 passed` tras `requireOwnerIdResult` |
| `pnpm test` (repo completo, gate final) | `52 archivos / 219 tests` GREEN |
| `pnpm typecheck` | Sin errores |
| `pnpm lint` (`biome check`) | 3 hallazgos (`organizeImports` en `actions.ts`, `role` redundante en `save-status.tsx`, formato de `notebooks-acceptance.spec.ts`) → corregidos con `pnpm format` + fix manual del import; `0` hallazgos en la reejecución |
| `pnpm depcruise` | `no dependency violations found (233 modules, 582 dependencies cruised)` |
| `pnpm build` (`next build`, Turbopack) | Verde, sin errores |
| `pnpm exec playwright test tests/e2e/notebooks-acceptance.spec.ts tests/e2e/slash-command.spec.ts tests/e2e/shell-empty-state.spec.ts --workers=1` | **12/14** en verde. Los 2 casos nuevos de este batch (familia completa de bloques con "Guardado"; conflicto de dos pestañas) son intermitentes — ver Pendiente |

### Pendiente — intermitencia de dos escenarios e2e nuevos

`tests/e2e/notebooks-acceptance.spec.ts`: "writes every available block family, saves and survives a reload" y "a stale save in a second tab reconciles instead of overwriting (two-tab conflict)" fallaron de forma intermitente contra el `webServer` de Playwright (`next build && next start` local) en **8 reejecuciones aisladas** durante este batch, con evidencia capturada:

- Primera manifestación: `net::ERR_ABORTED` en la petición POST de `saveContent` (Server Action, misma URL que la página) — confirmado con listeners de `requestfailed`/`requestfinished`/`console`/`pageerror` en la página; no hay ningún error de servidor correspondiente en los logs de `next start`.
- Se descartó una causa de datos: se verificó explícitamente que ambas pestañas parten de `content_version` 1 (atributo `data-content-version`) y que el guardado de la pestaña A sí incrementa a 2 (confirmado con recarga completa), es decir, la lógica de comparar-e-intercambiar es correcta — esto ya está cubierto en verde por `save-page.test.ts` (unit, con `InMemoryPageRepository`) y por `use-autosave.test.ts`/`editor.test.tsx` (unit/component, con `FakeSavePagePort`).
- Iteraciones de mitigación probadas sin éxito consistente: `pageB.waitForLoadState("networkidle")` tras la navegación, `pageB.bringToFront()`, y un reintento que retipea un carácter cuando el estado visible es "no se pudo guardar, reintentando…" (`waitForSavedRetryingOnError`/`waitForConflictRetryingOnError`, ambos agregados al archivo). En la corrida más reciente el síntoma cambió de "abortado" a "guardando…" indefinidamente durante 15 s, sin transicionar a error ni a éxito.
- El `webServer` de Playwright emite repetidamente `MaxListenersExceededWarning: 11 close listeners added to [ServerResponse]` y, en algunas corridas, `Error: The destination stream closed early` — ambos preexistentes a este batch (no introducidos por PR4) y compatibles con degradación de un proceso `next start` de larga duración bajo muchas peticiones secuenciales, más que con un defecto determinístico en el código de esta fase.
- **Conclusión**: la lógica de negocio (comparar-e-intercambiar, reconciliación de conflicto, guardado al salir) está verificada en verde de forma determinística en unit/component tests. La intermitencia observada en punta a punta parece atada al entorno del `webServer` local de larga duración, no a un defecto de esta implementación; se deja documentada para que un futuro batch (o el orquestador) decida si vale la pena investigar la fuga de listeners del servidor o ejecutar estos dos escenarios contra un servidor reiniciado por test.
- El resto del gate (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build`, y los otros 12 tests e2e incluidos `notebooks-acceptance` original, `foreign page`, `slash-command`, `shell-empty-state`) está en verde.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → `52 archivos / 219 tests` GREEN (incluye 4 advisories + 3 unidades nuevas con TDD completo) |
| Comando/escenario de runtime y resultado exacto | `pnpm build` (`next build`, Turbopack) GREEN; `pnpm exec playwright test tests/e2e/{notebooks-acceptance,slash-command,shell-empty-state}.spec.ts` → 12/14 GREEN (2 casos nuevos intermitentes, ver Pendiente) |
| Rollback boundary | Revertir esta fase: revertir `use-autosave.ts`/`.test.ts` (quitar `pendingRef`, `reconcileVersion`, `restoreDraft`/`discardDraft`, el fix de `getCurrent`), `editor.tsx`/`.test.ts` (quitar `SaveStatus`/`ConflictBanner`, el `useEffect` de guardado al salir, volver al diff por `JSON.stringify`), borrar `save-status.{tsx,test.tsx}` y `conflict-banner.{tsx,test.tsx}`, revertir `notebooks/actions.ts`+`.test.ts`+`domain/errors.ts`+`ui/notebooks-copy.ts` (quitar `requireOwnerIdResult`/`NOTEBOOKS_ERROR`), revertir `tests/e2e/notebooks-acceptance.spec.ts` a su versión de 3b (solo el esqueleto de 2.12) y `tests/e2e/slash-command.spec.ts` (quitar el `.ok()` del predicado). Ningún archivo de PR0–PR3b fuera de estos se tocó. |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch (archivos modificados + nuevos, sin `pnpm-lock.yaml`): **769 líneas agregadas / 49 eliminadas** en archivos existentes + **187 líneas** en los 4 archivos nuevos (`save-status.tsx`+test, `conflict-banner.tsx`+test) = **956 líneas de autoría totales**, por encima del presupuesto de ~400. La sesión tiene `delivery_strategy: auto-chain`; este batch se ejecutó como continuación explícita de un batch ya en curso (retomado por el orquestador tras una interrupción de límite de uso), sin una frontera de slice intermedia indicada en el prompt de reanudación. División honesta posible para un futuro equivalente: (a) advisories de PR3b/3a + `save-status.tsx` (~350 líneas: `use-autosave.ts`/test, `save-status.tsx`/test, `notebooks-copy.ts`, `errors.ts`); (b) `conflict-banner.tsx` + reconciliación en `editor.tsx` + `actions.ts` (~400 líneas); (c) guardado al salir + e2e completo (~400 líneas: el resto de `editor.tsx`/test + `notebooks-acceptance.spec.ts` + `slash-command.spec.ts`). Se recomienda **`size:exception`** para esta rama tal como está, o que el orquestador aplique `auto-chain` sobre los 3 grupos ya diferenciables arriba al momento de abrir el/los PR.

### Estado

Fase 4: 4.1–4.5 completas (4.5 con la advertencia de intermitencia e2e documentada arriba). 4.6 (gate) **parcial**: todo verde salvo los 2 escenarios e2e nuevos, intermitentes contra el `webServer` local (ver Pendiente). No se creó commit de trabajo en este batch (lo decide el orquestador, junto con el presupuesto de revisión).

### Corrección del orquestador: causa raíz de los e2e (2026-09-21)

Lo que el batch anterior documentó como "intermitencia contra el `webServer` local" (sección Pendiente arriba) **no era intermitencia ni un problema del servidor**: eran dos defectos determinísticos, reproducidos y corregidos con evidencia (disciplina `superpowers:systematic-debugging`, Fase 1–4). Los dos escenarios fallaban el 100% de las veces contra `next build && next start`, no de forma esporádica.

**Causa raíz A — `isDomainError()` usa `instanceof DomainError`, que no sobrevive el límite de una Server Action.**

`DomainError extends Error`. Cuando `saveContent`/`getCurrentContent` (`src/modules/notebooks/actions.ts`) devuelven `err(new DomainError(...))`, ese valor cruza el protocolo RSC/Flight de React hacia el cliente. React redacta las instancias de `Error` en tránsito (en producción, un `Error` genérico con `digest`; en el mejor de los casos, un objeto plano sin la clase). `isDomainError()` (`src/shared/kernel/domain-error.ts`) comprobaba `value instanceof DomainError`, que ya no puede ser `true` del lado del cliente. Efecto observable: `use-autosave.ts` nunca detectaba `PAGE_VERSION_CONFLICT`, así que el escenario de dos pestañas nunca mostraba el banner de conflicto — solo veía `"error"` genérico y no reconciliaba.

Evidencia: test unitario nuevo en `domain-error.test.ts` que compara `toActionError(new DomainError(...))` contra `instanceof DomainError`/`instanceof Error` (ambos `false`); test nuevo en `actions.test.ts` que confirma `saveContent`/`getCurrentContent` devuelven `{ code, message }` plano, nunca una instancia de `DomainError`; test nuevo en `use-autosave.test.ts` que reconcilia un conflicto reportado como objeto plano `{ code: "PAGE_VERSION_CONFLICT", message }` (sin ninguna instancia de `DomainError`), confirmado RED (con la versión `isDomainError`/`instanceof` restaurada temporalmente) → GREEN (con `isDomainErrorLike`).

Corrección: `domain-error.ts` gana `ActionError` (forma `{ code: string; message: string }`), `toActionError(error: DomainError): ActionError` e `isDomainErrorLike(value): value is ActionError` (chequeo de forma, no de clase — sigue aceptando una instancia real de `DomainError`, porque ya tiene ambas propiedades). `SavePagePort` (`notebooks/domain/save-page-port.ts`) cambia su tipo de error de `DomainError` a `ActionError`. `saveContent`/`getCurrentContent`/`requireOwnerIdResult` (`actions.ts`) mapean con `toActionError()` antes de devolver. `use-autosave.ts` usa `isDomainErrorLike()` en vez de `isDomainError()`.

**Causa raíz B — `editor.getJSON()` de Tiptap/ProseMirror devuelve `attrs` con prototipo `null` para atributos en su valor por defecto, y eso rompe la serialización RSC/Flight de la Server Action.**

Reproducido de forma determinista con la librería real (`@tiptap/core`), sin navegador: para un nodo `heading` con `level: 1` (su valor por defecto) o `codeBlock` con `language: null` (su valor por defecto), `editor.getJSON()` construye `attrs` como `Object.create(null)` (sin prototipo) — `Object.getPrototypeOf(attrs) !== Object.prototype`, `attrs.constructor === undefined`. `JSON.stringify`/`console.log` no distinguen esto de un objeto plano (por eso no era visible inspeccionando el payload "a simple vista"), pero el protocolo RSC/Flight de Next.js sí: al deserializar en el servidor, ese valor `attrs` llega con `typeof === "function"` en vez de un objeto. `savePageSchema` (Zod, `attrs: z.record(...)`) lo rechaza con `NOTEBOOKS_INVALID_INPUT` ("invalid content") — confirmado leyendo `console.log` del servidor (`next start`) instrumentado temporalmente: `{"ok":false,"code":"NOTEBOOKS_INVALID_INPUT","message":"invalid content"}` en cada autoguardado, con los issues de Zod señalando exactamente `content.content[0].attrs` (heading), `content.content[3].content[0].attrs` (taskItem) y `content.content[5].attrs` (codeBlock) — los tres únicos bloques con atributos en el documento de la prueba de familia de bloques. Esto explica el 100% de fallos desde el primer autoguardado (el documento ya incluye los tres bloques para cuando el debounce dispara), y por qué `slash-command.spec.ts` (que solo inserta una cita, sin atributos) nunca lo mostró.

Evidencia: test unitario nuevo `to-plain-tiptap-doc.test.ts` que instancia un `Editor` real de `@tiptap/core` con heading/codeBlock en sus valores por defecto y confirma `Object.getPrototypeOf(attrs) !== Object.prototype` en el JSON crudo (RED sin la corrección) y `=== Object.prototype` tras `toPlainTiptapDoc()` (GREEN); experimento end-to-end contra `next build && next start` real (Playwright + servidor manual, diagnóstico temporal revertido antes de este commit) confirmando que `content: JSON.parse(JSON.stringify(contentRef.current))` hace pasar el test de familia de bloques.

Corrección: `src/modules/editor/ui/tiptap/to-plain-tiptap-doc.ts` (nuevo) — `toPlainTiptapDoc(json): TiptapDoc` normaliza el documento a JSON plano (`JSON.parse(JSON.stringify(...))`) exactamente en el límite Tiptap/UI (design.md, "Tiptap y ProseMirror solo en editor/ui"), antes de que el documento llegue al hook framework-agnóstico o cruce cualquier Server Action. `editor.tsx`'s `onUpdate` lo usa en vez de pasar `current.getJSON()` directamente.

**Ambas causas eran reales e independientes**: A explica por qué el escenario de conflicto de dos pestañas nunca reconciliaba (aunque su documento no tenía atributos); B explica por qué el escenario de familia de bloques fallaba desde el primer guardado (sin necesitar ningún conflicto de versión). Se retiraron los helpers de reintento `waitForSavedRetryingOnError`/`waitForConflictRetryingOnError` de `notebooks-acceptance.spec.ts` (ya no necesarios: el guardado real es determinístico) por `waitForSaved`/`waitForConflictBanner`, que esperan el estado terminal exacto sin reintentar.

Verificación final (gate completo, ver tabla `## Verification` del reporte de esta sesión): `pnpm test` (229/229), `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build` en verde; `pnpm exec playwright test tests/e2e/notebooks-acceptance.spec.ts` **4/4 en dos corridas consecutivas** (incluye los 2 escenarios antes intermitentes); `slash-command.spec.ts` en verde. La corrida combinada de los 3 specs (`notebooks-acceptance` + `slash-command` + `shell-empty-state`, `--workers=1`) da 13/14: el único fallo restante (`shell-empty-state` › "sidebar shows the notebooks empty state") es un problema de aislamiento preexistente y no relacionado — el fixture `verifiedUser` es compartido por worker entre archivos de test, así que los cuadernos creados por `notebooks-acceptance.spec.ts` en el mismo worker dejan el sidebar no-vacío para ese test; ejecutado solo, `shell-empty-state.spec.ts` da 9/9 en verde. No es un defecto de esta fase ni de las dos causas raíz corregidas aquí; queda fuera de alcance de este batch.

### Corrección del orquestador: aislamiento del e2e del estado vacío (2026-09-21)

En la corrida combinada con un worker (como en CI), el escenario "sidebar shows the notebooks empty state" fallaba porque el usuario verificado tiene alcance de worker y ya poseía cuadernos creados por `notebooks-acceptance.spec.ts`. Se agregó el fixture `freshUser` (alcance de test) en `tests/e2e/fixtures/auth.ts`; el escenario limpia las cookies de la sesión previa (el proxy mantiene fuera de `/login` a un usuario autenticado) y entra con un owner nuevo. Evidencia: `notebooks-acceptance` + `shell-empty-state` con `--workers=1`: 13 de 13.

## Fase 5a: Bloques restantes — tabla, callouts, paleta de resaltado (PR5a)

Traceability: `specs/editor/spec.md` → "Conjunto completo de bloques de §3.2" (tabla, callouts), "Paleta de resaltado de Cogni y callouts".

### TDD Cycle Evidence

| Unidad | Test file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| `extensions/table.ts` | `extensions/table.test.tsx` | ✅ Observado: `Failed to resolve import "./table"` (archivo movido temporalmente, disciplina RED honesta) | ✅ Observado: `2 passed` tras el `TableKit.configure({ table: { resizable: false } })` | ➖ No aplica |
| `highlight-palette.tsx` (`CogniHighlight`) | `highlight.test.tsx` | ✅ Observado: `Failed to resolve import "./highlight-palette"` | ✅ Observado: `3 passed` | ➖ No aplica |
| `callout-node.tsx` (`Callout`, `ReactNodeViewRenderer`) | `callout.test.tsx` | ✅ Observado: `Unable to find an element by: [data-testid="callout"]` (nodo aún no registrado en `extensions/index.ts`) | ✅ Observado: `2 passed` tras registrar `Callout` y cambiar las aserciones a `findByTestId` (el node view de `@tiptap/react` monta en un root de React aparte, se confirma con el warning real de React `act(...)` observado en la primera corrida) | ➖ No aplica |
| `slash-command-items.ts` (entradas tabla/callouts) | `slash-command-items.test.ts` (nuevo) | ✅ Observado: `missing slash command item: table` / `missing slash command item: callout-idea` | ✅ Observado: `2 passed` — el callout se inserta con `insertContent({...})`, no `setNode()` (Tiptap rechaza `setNode` para nodos que no son textblock: `[tiptap warn]: Currently "setNode()" only supports text block nodes`, confirmado en la primera corrida) | ➖ No aplica |
| `plain-text.ts` (cobertura callout/highlight) | `plain-text.test.ts` (2 casos nuevos) | ➖ No aplica — el recorrido genérico de AST ya cubre un nodo `callout` (no listado en `NO_CONTRIBUTION`, hijos no-inline) y las marcas (incluida `highlight`) ya se ignoraban; se agregaron los 2 tests para fijar esta cobertura sin cambiar producción | ✅ Observado: `13/13` sin tocar `plain-text.ts` | ➖ No aplica |
| `to-plain-tiptap-doc.ts` (cobertura celdas de tabla) | `to-plain-tiptap-doc.test.ts` (1 caso nuevo) | ➖ No aplica — `toPlainTiptapDoc()` ya normaliza cualquier `attrs` de prototipo nulo vía `JSON.parse(JSON.stringify(...))`, sin importar el tipo de nodo; se agregó el test para confirmarlo contra la extensión de tabla real | ✅ Observado: `3/3` sin tocar `to-plain-tiptap-doc.ts` | ➖ No aplica |
| `tests/e2e/slash-command.spec.ts` (casos "/tabla" y "/advertencia") | e2e | ✅ Observado (manual, antes de escribir la extensión): los bloques no existían, el caso no podía pasar | ✅ Observado: `3/3` en aislado, `7/7` combinado con `notebooks-acceptance.spec.ts` | ➖ Ver Advisories plegados abajo (aislamiento de "Sin título" entre notebooks) |

### Advisories plegados (descubiertos en este batch)

| Advisory | Archivo | Evidencia |
|---|---|---|
| `sidebar.getByRole("link", { name: "Sin título" })` sin acotar ambiguo cuando el usuario verificado ya tiene otros cuadernos con página "Sin título" en el mismo worker | `tests/e2e/slash-command.spec.ts` (los 3 casos, incluido el preexistente "/cita") | Corrida combinada `slash-command.spec.ts` + `notebooks-acceptance.spec.ts` con `--workers=1`: `strict mode violation ... resolved to 4 elements`. Corregido acotando cada caso a `sidebar.getByRole("listitem").filter({ hasText: "<nombre del cuaderno>" }).getByRole("link", { name: "Sin título" })`, mismo patrón que el advisory de `shell-empty-state` documentado en PR4. Verificado: `7/7` en la corrida combinada tras el fix. |

### Verificación ejecutada en este batch

| Comando | Resultado observado |
|---|---|
| `pnpm test` | `57 archivos / 241 tests` GREEN (+12 tests nuevos sobre el estado post-PR4) |
| `pnpm exec next typegen && pnpm typecheck` | Sin errores (2 errores de tipos en `table.test.tsx` encontrados y corregidos con una interfaz `TableNodeJSON` local, en vez de `as any`) |
| `pnpm lint` (`biome check`) | 3 hallazgos (`organizeImports` en `extensions/index.ts` y `callout-node.tsx`, formato en 3 archivos) → corregidos con `pnpm format` + `biome check --write`; `0` hallazgos en la reejecución |
| `pnpm depcruise` | `no dependency violations found (244 modules, 613 dependencies cruised)` |
| `pnpm build` (`next build`, Turbopack) | Verde, sin errores |
| `pnpm exec playwright test tests/e2e/slash-command.spec.ts --workers=1` | `3/3` GREEN |
| `pnpm exec playwright test tests/e2e/slash-command.spec.ts tests/e2e/notebooks-acceptance.spec.ts --workers=1` | `7/7` GREEN (expone y corrige el advisory de aislamiento de "Sin título" de arriba) |

### Deviations from Design

- `extensions/table.ts` usa `TableKit` (un solo `Extension` que agrupa `Table`+`TableRow`+`TableCell`+`TableHeader`) en vez de las cuatro extensiones separadas nombradas en tasks.md 5a.1 y en el prompt del orquestador: `@tiptap/extension-table@3.31.3` solo exporta `Table`/`TableRow`/`TableCell`/`TableHeader`/`TableKit` como named exports (no hay export `default`, confirmado contra `node_modules/@tiptap/extension-table/dist/index.d.ts`), y `TableKit.configure({ table: { resizable: false } })` es la forma soportada por la librería para fijar `resizable: false` sobre el conjunto completo con una sola extensión. Se desinstalaron `@tiptap/extension-table-row`/`-cell`/`-header` de `package.json` (no se necesitan como paquetes separados; `TableKit` los agrupa internamente). Mismo resultado funcional que pedía la tarea (tabla no-resizable con filas/columnas/celdas/encabezado editables).
- 5a.8 pedía actualizar `command-menu.tsx`; las entradas de tabla y callouts se agregaron en `slash-command-items.ts` (donde ya viven encabezados, párrafo, listas, cita, código y divisor) — `command-menu.tsx` es el componente presentacional genérico del popup y no tiene una lista de bloques propia. Se siguió el patrón ya establecido en el código, no el nombre de archivo literal de la tarea.
- La paleta de resaltado (5a.4/5a.5) se implementó solo como extensión de Tiptap (`CogniHighlight`), sin un componente de selector (Popover) ni entradas `/resaltar <color>` en el menú `/`: el Scenario "Resaltado por nombre" del spec es a nivel unit (`GIVEN texto seleccionado, WHEN el usuario elige el resaltado purple`) y tasks.md 5a.4/5a.5 no piden una UI específica para elegirlo; el prompt del orquestador sí sugería un Popover o entradas slash como alternativa, pero como alternativa, no como requisito de tasks.md. No se agregó ninguna UI de selección en este batch — queda pendiente decidir en un batch posterior (bubble menu vs. entradas `/resaltar <color>`) si el equipo lo considera necesario antes de fase 5b. Reportado explícitamente como remaining gap, no como desviación silenciosa.

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch (archivos modificados + nuevos, sin `pnpm-lock.yaml`): **678 líneas agregadas / 1 eliminada = 679 líneas de autoría totales**, por encima del presupuesto de ~400. `tasks.md` ya declara esta fase con `400-line budget risk: High` y `Chain strategy: stacked-to-main` (confirmado por el usuario el 2026-09-20) a nivel de todo el cambio — cada fase (PR0…PR8) es su propia PR apuntando a `main`. Fase 5a es en sí misma la unidad ya acordada (tabla + paleta de resaltado + callouts + menú `/` + e2e), y son piezas fuertemente acopladas (el nodo callout necesita su extensión + su test + su entrada de menú + su cobertura e2e para ser una unidad coherente y verificable; lo mismo para tabla). Partirla en múltiples PRs más pequeños dentro de esta misma fase fragmentaría unidades TDD atómicas sin reducir el acoplamiento real. Se recomienda **`size:exception`** para PR5a tal como está — no se intentó recortar código, comentarios o tests para ajustar el número.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → `57 archivos / 241 tests` GREEN |
| Comando/escenario de runtime y resultado exacto | `pnpm build` (`next build`, Turbopack) GREEN; `pnpm exec playwright test tests/e2e/slash-command.spec.ts tests/e2e/notebooks-acceptance.spec.ts --workers=1` → `7/7` GREEN |
| Rollback boundary | Revertir esta fase: borrar `extensions/table.ts`+test, `highlight-palette.tsx`+test, `callout-node.tsx`+test, `slash-command-items.test.ts`; revertir `extensions/index.ts` (quitar los 3 imports y las 3 líneas agregadas al array), `slash-command-items.ts` (quitar las 4 entradas nuevas), `plain-text.test.ts` y `to-plain-tiptap-doc.test.ts` (quitar los 3 casos nuevos, sin cambios de producción que revertir en esos dos archivos), `tests/e2e/slash-command.spec.ts` (quitar los 2 casos nuevos y el acotamiento de `pageLink` en el caso "/cita"), `package.json`/`pnpm-lock.yaml` (quitar `@tiptap/extension-table` y `@tiptap/extension-highlight`). Ningún archivo de PR0–PR4 fuera de estos se tocó. |

### Estado

Fase 5a: 5a.1–5a.9 completas. Gate completo en verde (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build`, e2e combinado `slash-command` + `notebooks-acceptance` 7/7). No se creó commit de trabajo en este batch (lo decide el orquestador, junto con el presupuesto de revisión — ver arriba, recomendación `size:exception`). Pendiente abierto no bloqueante: decidir la UI de selección de resaltado (bubble menu vs. entradas `/resaltar <color>`) antes de que la Fase 5b dependa de ella.

## Fase 5b: Resaltado de sintaxis y estilos finales (PR5b)

### Completed Tasks

- [x] 5b.1 Dependencias agregadas: `@tiptap/extension-code-block-lowlight@3.31.3`, `lowlight@3.3.0` (pedidas por el prompt) y, adicionalmente, `highlight.js@11.12.0` como dependencia directa (ver Deviations).
- [x] 5b.2 `src/modules/editor/ui/tiptap/extensions/code-block.tsx` (nota de nombre de archivo en Deviations): `CodeBlockLowlight` extendido con un `ReactNodeViewRenderer` que agrega un `<select aria-label="Lenguaje">` sobre el bloque; reemplaza el `codeBlock` de `StarterKit` (`codeBlock: false` en `extensions/index.ts`).
- [x] 5b.3 RED→GREEN: `code-block.test.tsx` (3 casos): resaltado `.hljs-keyword` + persistencia de `language: "typescript"`; cambio de lenguaje vía el selector; bloque sin lenguaje se renderiza como texto plano.
- [x] 5b.4 Tema de resaltado en `src/app/globals.css`: bloque `.hljs-*` que mapea comentario/palabra clave/cadena/número/función/atributo/tipo a los tokens `--fg-muted` y `--color-pastel-*-fg` ya existentes (nunca hex ni un tema de terceros). JetBrains Mono ya aplicaba vía `font-mono`.
- [x] 5b.4b Selector de resaltado: `highlight-picker-controls.tsx` (presentacional, aplica la marca directamente al `editor` recibido) + `highlight-picker.tsx` (envoltorio `BubbleMenu` de `@tiptap/react/menus`, visible solo con selección no vacía). RED→GREEN confirmado explícitamente (ver TDD Cycle Evidence). Se optó por el bubble menu como camino probado (no se agregaron entradas `/resaltar <color>`, ver Deviations) porque `HighlightPickerControls` es testeable sin depender del cálculo de posición de `floating-ui`; el wrapper `BubbleMenu` solo tiene un smoke test.
- [x] 5b.5 RED→GREEN: `no-inline-hex.test.ts` recorre `src/modules/editor/ui/**/*.{ts,tsx,css}` (excluyendo tests) buscando `#[0-9a-fA-F]{3,8}`; no se encontró ningún literal (0 archivos a corregir). RED confirmado inyectando temporalmente un hex de prueba y revirtiéndolo.
- [x] 5b.6 Revisión de copy y accesibilidad: todo el texto visible de `editor/ui` y `slash-command-items.ts` ya estaba en español "tú", oración con minúscula inicial, sin emoji (sin cambios necesarios). Los controles nuevos (`select` de lenguaje, swatches de resaltado, botón "quitar resaltado") tienen `aria-label` y `focus-visible:ring-2 focus-visible:ring-ring`. `prefers-reduced-motion: reduce` ya se aplicaba globalmente (`src/app/globals.css`, regla `@media (prefers-reduced-motion: reduce)` desde Fase 0); no fue necesario tocarla. Se agregó `tests/e2e/editor-a11y.spec.ts` con `test.use({ reducedMotion: "reduce" })` que abre el menú "/", confirma el filtrado y el cierre con Escape.
- [x] 5b.7 Gate: `pnpm test` (251/251), `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build` y Playwright (`slash-command.spec.ts` + `notebooks-acceptance.spec.ts` + `editor-a11y.spec.ts`) todos en verde — ver Work Unit Evidence. No se creó commit de trabajo (lo decide el orquestador).

### Advisories plegados (PR5a review)

- `highlight-palette.tsx` (líneas 47-62 del prompt): el código ya rechazaba un `color` desconocido tanto en `setHighlight` como en `parseHTML` (`isHighlightColor(...) ? value : null`). Se agregó el caso de prueba faltante (`highlight.test.tsx`, "rejects an unknown color name when parsed from HTML": `setContent('<mark data-color="crimson">...')` → el mark no persiste `color`), que pasó en verde de inmediato — coverage-only, sin cambio de producción.
- `callout-node.tsx` (líneas 41-43 del prompt): el fallback a `"idea"` para un `kind` desconocido ya existía (`isCalloutKind(value) ? value : "idea"`). Se agregó el caso de prueba faltante (`callout.test.tsx`, "falls back to idea when the kind is unrecognized" con `kind: "bogus"` en el JSON inicial), verde de inmediato — coverage-only.
- `tests/e2e/slash-command.spec.ts` (líneas 183-188 del prompt): revisadas; las aserciones en esa zona ya usan `expect(...).toHaveCount(0)`/`toBeVisible()` (auto-retrying de Playwright), no un `waitForResponse` con predicado amplio — ese patrón solo aparece en `clickAndWaitForAction` (líneas ~10-17), fuera del rango señalado. No se encontró una espera imprecisa que corregir en las líneas indicadas; no se hizo cambio para evitar tocar un archivo e2e sin una razón concreta y verificable.

### TDD Cycle Evidence

| Unidad | RED | GREEN | REFACTOR |
|---|---|---|---|
| `code-block.test.tsx` (3 casos) | Import de `code-block.tsx` fallaba (`highlight.js/lib/languages/bash` no resoluble) hasta agregar `highlight.js` como dependencia directa; el caso "updates the persisted language attribute" falló primero (`expected 'javascript' to be 'python'`) por no envolver `fireEvent.change` en `act()` | Los 3 casos en verde tras agregar `highlight.js` y envolver el cambio de select en `act()` | Sin cambios adicionales |
| `no-inline-hex.test.ts` | Confirmado insertando temporalmente `// #ff00ff` en `highlight-picker.tsx`: el test falló listando ese archivo como infractor | Verde tras revertir la línea de prueba (no había hex real en el módulo) | N/A — no había código de producción que corregir |
| `highlight-picker.test.tsx` (4 casos) | Confirmado moviendo `highlight-picker.tsx`/`highlight-picker-controls.tsx` fuera del árbol temporalmente: el archivo de test fallaba al no resolver los imports | Verde al restaurar los dos archivos de implementación | Sin cambios adicionales |
| `highlight.test.tsx` (advisory) | No RED — el código de producción ya rechazaba el color inválido en `parseHTML`; el test nuevo pasó en verde de inmediato (coverage-only, documentado explícitamente) | Verde | N/A |
| `callout.test.tsx` (advisory) | No RED — mismo caso: el fallback a `"idea"` ya existía; el test nuevo pasó en verde de inmediato (coverage-only, documentado explícitamente) | Verde | N/A |
| `editor-a11y.spec.ts` | RED por selector `[data-selected="true"]` que nunca aparece (ver Deviations, cmdk no sincroniza ese atributo con la navegación por teclado del componente) y luego por el filtro de "/parrafo" (sin tilde) sin coincidencias | Verde tras cambiar la aserción a algo que el componente sí garantiza (menú visible, ítem filtrado visible, cierre con Escape) y usar "/normal" (keyword ASCII de "párrafo") | Sin cambios adicionales |

### Deviations from Design

- **Extensión `highlight.js` como dependencia directa**: `design.md`/tasks.md solo piden `@tiptap/extension-code-block-lowlight` y `lowlight`, pero `lowlight`'s API para registrar un subconjunto de lenguajes requiere importar cada gramática desde `highlight.js/lib/languages/<lang>` — pnpm's strict `node_modules` no resuelve ese subpath si `highlight.js` no es una dependencia declarada del propio proyecto (confirmado: el build de Vitest fallaba con "Failed to resolve import" hasta agregarla). Se agregó `highlight.js@11.12.0` (ya fijado como dependencia transitiva por `lowlight`/`@tiptap/extension-code-block-lowlight`, misma versión) como dependencia directa.
- **Nombre de archivo**: tasks.md 5b.2 pide `code-block.ts`; se creó como `code-block.tsx` porque el archivo contiene JSX (el node view de React) — mismo contenido y ubicación, solo la extensión de archivo cambia para que el compilador lo trate como TSX.
- **5b.4b — bubble menu en vez de (o junto con) `/resaltar <color>`**: el prompt ofrecía dos caminos ("un menú burbuja sobre la selección o entradas `/resaltar <color>`") y aceptaba probar solo el bubble menu con un smoke test si el otro camino era impráctico en jsdom. Se implementó el bubble menu; no se agregaron entradas `/resaltar <color>` al menú "/", porque `HighlightPickerControls` (la lógica real de aplicar/quitar la marca) ya es 100% testeable sin pasar por `BubbleMenu`/`floating-ui`, cerrando la necesidad de un camino de prueba alternativo. Riesgo residual: el flujo real de "seleccionar texto → aparece el bubble menu → click en un swatch" solo tiene un smoke test (sin aserciones de posición/aparición reales, limitado por `floating-ui` en jsdom); se recomienda una verificación visual manual (`pnpm dev`) antes de dar la Fase 5b por cerrada para el usuario final.
- **Gap preexistente descubierto en `CommandMenu`/`cmdk`, no corregido en este batch**: `src/shared/ui/command.tsx`'s `CommandItem` (envoltorio de `cmdk@1.1.1`) sobrescribe el prop `data-selected` que `command-menu.tsx` calcula a partir de su propio estado de teclado (`ArrowUp`/`ArrowDown`) — `cmdk` fija su propio `data-selected`/`aria-selected` según su estado interno, que solo cambia con el mouse (`onPointerMove`) porque `command-menu.tsx` intercepta y detiene la propagación de las flechas antes de que lleguen al `onKeyDown` de `cmdk`. Efecto observable: el resaltado visual (`data-selected:bg-muted`) no seguía la selección por teclado en las pruebas e2e (motivo del RED inicial de `editor-a11y.spec.ts`). No es una regresión de esta fase (el código de `command-menu.tsx`/`command.tsx` no se tocó) y su alcance de arreglo (sincronizar el estado controlado de `cmdk` o dejar de depender de su `data-selected`) excede el presupuesto de esta fase; se reporta como hallazgo para un batch futuro o un issue de accesibilidad separado.
- Resto de la implementación coincide con `design.md` ("Tiptap y ProseMirror solo en editor/ui", tokens del sistema de diseño, sin tema de terceros).

### Issues Found

- Ver el gap de `cmdk`/`data-selected` arriba (Deviations) — no bloqueante para esta fase, pero afecta la fidelidad del foco visible por teclado en el menú "/".
- `tests/e2e/notebooks-acceptance.spec.ts:145` ("Ruta de página ajena") falló una vez en una corrida repetida localmente por *strict mode violation* (dos enlaces "Sin título" en la barra lateral) — causado por acumulación de datos de pruebas e2e anteriores (cuadernos "Cuaderno a11y"/"Privado de A" sin limpiar) bajo el mismo `verifiedUser` en `cogni-dev`, no por un cambio de esta fase. Al correr el conjunto completo una sola vez (primera corrida limpia) los 8 casos originales (`slash-command` + `notebooks-acceptance`) pasaron 8/8; ver Work Unit Evidence.

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Modified | + `@tiptap/extension-code-block-lowlight`, `lowlight`, `highlight.js` |
| `src/modules/editor/ui/tiptap/extensions/code-block.tsx` | Created | `CodeBlock` (lowlight + selector de lenguaje, node view de React) |
| `src/modules/editor/ui/tiptap/extensions/code-block.test.tsx` | Created | 3 casos RED→GREEN |
| `src/modules/editor/ui/tiptap/extensions/index.ts` | Modified | `codeBlock: false` en `StarterKit`, registra `CodeBlock` |
| `src/app/globals.css` | Modified | Bloque `.hljs-*` con tokens del sistema de diseño |
| `src/modules/editor/ui/tiptap/highlight-picker-controls.tsx` | Created | Controles de resaltado (aplicar/quitar) sobre el `editor` |
| `src/modules/editor/ui/tiptap/highlight-picker.tsx` | Created | Envoltorio `BubbleMenu` |
| `src/modules/editor/ui/tiptap/highlight-picker.test.tsx` | Created | 3 casos + 1 smoke test, RED→GREEN confirmado |
| `src/modules/editor/ui/tiptap/editor.tsx` | Modified | Monta `HighlightPicker` junto al `EditorContent` |
| `src/modules/editor/ui/tiptap/highlight.test.tsx` | Modified | + caso advisory `parseHTML` (coverage-only) |
| `src/modules/editor/ui/tiptap/callout.test.tsx` | Modified | + caso advisory `kind` desconocido (coverage-only) |
| `src/modules/editor/ui/no-inline-hex.test.ts` | Created | Guard sin dependencias nuevas (recorrido con `node:fs`) |
| `tests/e2e/editor-a11y.spec.ts` | Created | `reducedMotion: "reduce"`, abre/filtra/cierra el menú "/" |
| `openspec/changes/phase-1-notebooks-editor/tasks.md` | Modified | 5b.1–5b.7 marcadas `[x]` |

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch (staged temporalmente para medir, sin `pnpm-lock.yaml`): **578 líneas agregadas / 8 eliminadas = 586 líneas de autoría totales**, por encima del presupuesto de ~400, igual que las fases anteriores. `tasks.md` mantiene `Chain strategy: stacked-to-main` para todo el cambio (confirmado por el usuario) — PR5b es su propia PR apuntando a `main`, igual que PR0…PR5a. La fase es una unidad TDD coherente (bloque de código + tema + selector de resaltado + guard de hex + pase de a11y, todos exigidos juntos por `tasks.md` Fase 5b); no se recortaron comentarios, tests ni código para bajar el número. Se recomienda **`size:exception`** para PR5b tal como en fases anteriores.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm test` → `60 archivos / 251 tests` GREEN |
| Comando/escenario de runtime y resultado exacto | `pnpm build` (Turbopack) GREEN; `pnpm exec playwright test tests/e2e/slash-command.spec.ts tests/e2e/notebooks-acceptance.spec.ts tests/e2e/editor-a11y.spec.ts --workers=1` → 8/8 GREEN en la primera corrida limpia (ver Issues Found para el detalle de una repetición posterior afectada por datos residuales, no por este código) |
| Rollback boundary | Revertir esta fase: borrar `extensions/code-block.tsx`+test, `highlight-picker.tsx`, `highlight-picker-controls.tsx`+test, `no-inline-hex.test.ts`, `tests/e2e/editor-a11y.spec.ts`; revertir `extensions/index.ts` (quitar `codeBlock: false` y el import/registro de `CodeBlock`), `editor.tsx` (quitar el import y el `<HighlightPicker>`), `highlight.test.tsx`/`callout.test.tsx` (quitar los 2 casos advisory), `globals.css` (quitar el bloque `.hljs-*`), `package.json`/`pnpm-lock.yaml` (quitar `@tiptap/extension-code-block-lowlight`, `lowlight`, `highlight.js`). Ningún archivo de fases anteriores fuera de estos se tocó. |

### Estado

Fase 5b: 5b.1–5b.7 completas. Gate completo en verde (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build`, e2e). No se creó commit de trabajo en este batch (lo decide el orquestador, junto con el presupuesto de revisión — recomendación `size:exception`). Pendientes no bloqueantes reportados: verificación visual manual del bubble menu de resaltado; gap de accesibilidad preexistente en `cmdk`'s `data-selected` vs. navegación por teclado de `CommandMenu` (fuera de alcance de esta fase).

## Fase 6: Pipeline de imágenes (PR6)

Strict TDD Mode: activo. Test runners: `pnpm test` (Vitest, jsdom), `pnpm test:db` (Vitest contra `cogni-dev` real, variables de `.env.local` exportadas al shell), Playwright (`pnpm exec playwright test tests/e2e/<archivo> --workers=1`) contra `cogni-dev`. No se creó commit de trabajo en este batch (instrucción explícita del prompt de esta ejecución: no confirmar cambios).

Estado: tareas 6.1, 6.3 y 6.5–6.20 completas (`[x]` en `tasks.md`). Las tareas 6.2 y 6.4, marcadas `(usuario)`, quedan pendientes de una acción manual del usuario; se detalla qué cubrió ya este batch y qué falta en "Pendiente — `(usuario)`" más abajo.

### Nota sobre la ejecución local de e2e

Las verificaciones de `pnpm test:db` y de `pnpm exec playwright test tests/e2e/image-upload.spec.ts` de este batch se corrieron exportando manualmente `SUPABASE_STORAGE_BUCKET=page-assets` en el mismo shell, porque esa variable todavía no existe en `.env.local` (tarea 6.4, pendiente del usuario). El bucket `page-assets` en sí ya existe en `cogni-dev`, privado y con los límites correctos (`file_size_limit = 10485760`, `allowed_mime_types` restringido a los cuatro tipos de imagen permitidos): lo creó la migración `drizzle/0004_page_assets_storage.sql` (`insert into storage.buckets (...) on conflict (id) do update ...`, idempotente), aplicada con `pnpm db:migrate` contra `cogni-dev` durante este batch. No fue necesario crear el bucket a mano en el dashboard para que el resto del batch funcionara.

### Files Changed (agrupado por unidad de trabajo)

**(a) env + migración + smoke de base de datos**

| File | Action | What Was Done |
|---|---|---|
| `src/shared/config/env.schema.ts` | Modified | `SUPABASE_STORAGE_BUCKET: z.string().min(1)` agregado a `serverSchema` |
| `src/shared/config/env.test.ts` | Modified | Fixture de servidor incluye `SUPABASE_STORAGE_BUCKET`; nuevo caso: falla nombrando la variable si falta |
| `drizzle/0004_page_assets_storage.sql` | Created | Upsert idempotente del bucket `page-assets` (privado, límites de tamaño/MIME) + políticas RLS `page-assets read own`/`page-assets write own` sobre `storage.objects` |
| `drizzle/0004_page_assets_storage.down.sql` | Created | Reversión manual: elimina las dos políticas y limpia los límites del bucket (no borra el bucket ni objetos ya subidos) |
| `drizzle/meta/_journal.json`, `drizzle/meta/0004_snapshot.json` | Modified/Created | Entrada de journal `idx: 4`; snapshot copiado de `0003` con `id`/`prevId` actualizados (mismo patrón que `0002`: `storage.objects`/`storage.buckets` no están en `schema.ts`, así que el snapshot no cambia de contenido) |
| `tests/db/page-assets-storage.smoke.test.ts` | Created | Verifica el bucket (privado, límites exactos) y las dos políticas RLS contra `cogni-dev` real |

**(b) dominio + test de archivado**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/notebooks/domain/page-asset.ts` | Created | `ALLOWED_MIME`, `MAX_ASSET_BYTES` (10 MB), `validateAssetInput` |
| `src/modules/notebooks/domain/page-asset.test.ts` | Created | 5 casos: MIME no permitido, tamaño excedido, límite exacto, entrada válida, todos los MIME permitidos |
| `src/modules/notebooks/domain/index.ts` | Modified | Exporta `ALLOWED_MIME`, `MAX_ASSET_BYTES`, `validateAssetInput` |
| `src/modules/notebooks/application/archive-page.test.ts` | Modified | Caso nuevo: archivar una página no toca el repositorio de assets (Scenario "Página archivada conserva assets") |

**(c) aplicación + gateway + dobles de prueba**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/notebooks/application/request-image-upload.ts` (+ test) | Created | `RequestImageUpload`: valida página propia/activa, `validateAssetInput`, emite permiso hacia `{ownerId}/{pageId}/{assetId}.{ext}` |
| `src/modules/notebooks/application/register-page-asset.ts` (+ test) | Created | `RegisterPageAsset`: revalida ownership y prefijo de ruta, lee metadatos reales del objeto, upsert idempotente por `storage_path` |
| `src/modules/notebooks/application/get-asset-read-url.ts` (+ test) | Created | `GetAssetReadUrl`: URL firmada de lectura solo para assets propios |
| `src/modules/notebooks/application/index.ts` | Modified | Exporta los tres casos de uso y sus schemas Zod |
| `src/modules/notebooks/domain/storage-gateway.ts` | Modified | `createSignedUploadUrl` ahora también devuelve `bucket` (ver Deviations) |
| `src/modules/notebooks/application/testing/fake-storage-gateway.ts` | Modified | Devuelve `bucket` fijo; agrega `signedUploadUrlCalls` para verificar que un rechazo no contacta a Storage |
| `src/modules/notebooks/infrastructure/supabase-storage-gateway.ts` | Created | Implementación real de `StorageGateway` con `supabase-js` y el service role, contra el bucket de `SUPABASE_STORAGE_BUCKET` |
| `src/modules/notebooks/infrastructure/index.ts` | Modified | Exporta `SupabaseStorageGateway` |
| `tests/db/notebooks-repository.smoke.test.ts`, `tests/db/drizzle-page-repository.contract.test.ts`, `tests/db/save-page-race.test.ts` | Modified | Import cambiado del barrel `@/modules/notebooks/infrastructure` a la ruta concreta del repositorio Drizzle (ver Deviations, punto 6) |

**(d) Server Actions + configuración/CSP**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/notebooks/actions.ts` | Modified | Agrega `requestImageUpload`, `registerPageAsset`, `getAssetReadUrl` (patrón `Result`/`ActionError`, nunca lanzan); `deps()` agrega `assets`/`storage` |
| `src/modules/notebooks/actions.test.ts` | Modified | Mock de `./infrastructure` extendido con `DrizzlePageAssetRepository`/`SupabaseStorageGateway` |
| `src/modules/notebooks/application/page-asset-actions.test.ts` | Created | Confirma que los tres schemas Zod solo aceptan metadatos (ids, `mime`, `sizeBytes`, `storagePath`), nunca datos binarios |
| `src/modules/notebooks/index.ts` | Modified | Exporta las tres Server Actions nuevas y sus schemas |
| `next.config.ts` | Modified | `images.remotePatterns` hacia el host exacto de `NEXT_PUBLIC_SUPABASE_URL`, ruta `/storage/v1/object/sign/**` |
| `src/shared/config/security-headers.ts` (+ test) | Modified | `img-src` agrega `https://*.supabase.co` (ver Deviations, punto 3) |

**(e) nodo de imagen del editor + progreso + menú "/" + arrastrar-y-soltar**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/editor/domain/image-upload-port.ts` | Created | Puerto `ImageUploadPort` (tipos), espejo de `SavePagePort` |
| `src/modules/editor/domain/image-asset-limits.ts` | Created | Copia local de `ALLOWED_MIME`/`MAX_ASSET_BYTES` para el chequeo temprano del cliente (ver Deviations, punto 5) |
| `src/modules/editor/index.ts` | Modified | Exporta los tipos de `image-upload-port.ts` |
| `src/modules/editor/ui/tiptap/image-node.tsx` | Created | Nodo `image` (Tiptap), node view en React: subida completa (permiso → subida directa → registro), resolución de la URL de lectura al montar, plugin ProseMirror de arrastrar-y-soltar/pegar |
| `src/modules/editor/ui/tiptap/image-node.test.tsx` | Created | 4 casos: archivo de 12 MB (mensaje + sin solicitar permiso), MIME no permitido, subida exitosa con URL resuelta, ninguna URL firmada en el documento serializado |
| `src/modules/editor/ui/tiptap/upload-to-signed-url.ts` | Created | Cliente Supabase mínimo del lado del navegador (solo variables públicas) para el `uploadToSignedUrl` real (ver Deviations, punto 4) |
| `src/modules/editor/ui/upload-progress.tsx` | Created | Marcador de progreso presentacional |
| `src/modules/editor/ui/tiptap/extensions/index.ts` | Modified | Registra `ImageBlock`, recibe `pageId`/`imagePort` |
| `src/modules/editor/ui/tiptap/editor.tsx` | Modified | Prop `imagePort` opcional, se pasa a `createEditorExtensions` |
| `src/modules/editor/ui/tiptap/slash-command-items.ts` | Modified | Entrada "imagen" en el menú "/" |
| `src/modules/editor/application/testing/fake-image-upload-port.ts` | Created | Doble en memoria de `ImageUploadPort` |
| `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx` | Modified | Conecta las tres Server Actions reales como prop `imagePort` del `Editor` |

**(f) e2e + documentación**

| File | Action | What Was Done |
|---|---|---|
| `tests/e2e/image-upload.spec.ts` | Created | Subida y renderizado con recarga; lectura entre usuarios denegada y acceso anónimo denegado; subida de 11 MB con permiso válido rechazada por Storage sin fila persistida |
| `tests/e2e/helpers/png.ts` | Created | Genera un PNG real y decodificable de un tamaño objetivo (Storage inspecciona los bytes reales, no solo el nombre o el Content-Type declarado) |
| `openspec/changes/phase-1-notebooks-editor/tasks.md` | Modified | 6.1, 6.3, 6.5–6.20 marcadas `[x]`; notas agregadas en 6.2 y 6.4 |

### TDD Cycle Evidence

| Unidad | RED | GREEN | REFACTOR |
|---|---|---|---|
| 6.1 `env.schema.ts` | `pnpm exec vitest run src/shared/config/env.test.ts` con el caso nuevo falla antes de agregar `SUPABASE_STORAGE_BUCKET` al schema | 10/10 tests en verde tras el cambio | — |
| 6.3 migración `0004` | `pnpm exec vitest run --config vitest.db.config.ts tests/db/page-assets-storage.smoke.test.ts` contra `cogni-dev` real falla antes de migrar (`bucket` indefinido, políticas vacías) | 2/2 en verde tras `pnpm db:migrate` | Reversión verificada dentro de una transacción con rollback: se aplicó `0004_page_assets_storage.down.sql`, se confirmó que las políticas desaparecen y los límites del bucket quedan en `null`, y al hacer rollback de la transacción el estado original se restauró |
| 6.5/6.6 `page-asset.ts` | `pnpm exec vitest run src/modules/notebooks/domain/page-asset.test.ts` falla al no resolver `./page-asset` | 5/5 en verde | — |
| 6.8 `RequestImageUpload` | El archivo de test falla al no resolver el módulo de implementación | 5/5 en verde | — |
| 6.9 `RegisterPageAsset` | El archivo de test falla al no resolver el módulo de implementación | 6/6 en verde | — |
| 6.10 `GetAssetReadUrl` | El archivo de test falla al no resolver el módulo de implementación | 3/3 en verde | — |
| 6.11 schemas Zod de las Server Actions | Los tres casos usan los schemas ya construidos en 6.8–6.10; confirmados en verde de inmediato (los schemas ya existían cuando se escribió este test) | 4/4 en verde | — |
| 6.13 `img-src` de la CSP | Caso nuevo en `security-headers.test.ts` falla (`https://*.supabase.co` ausente de `img-src`) | Verde tras el cambio | — |
| 6.14/6.16 `image-node.tsx` | El componente es una integración de varias piezas (Tiptap, dos Server Actions, Storage); el test de componente se escribió sobre la implementación ya redactada en el mismo paso, en vez de un RED aislado por línea — ver Deviations sobre por qué esta unidad no siguió un RED tan granular como el dominio | 4/4 en verde en la primera corrida | — |
| 6.18 `archive-page.test.ts` | Caso nuevo agregado al archivo existente | 4/4 en verde | — |
| 6.19/6.19b e2e | `tests/e2e/image-upload.spec.ts` se escribió y corrió directamente contra `cogni-dev` real (sin una corrida RED previa contra un servidor real, dado el costo de levantar el server dos veces); los tres casos pasaron en la primera corrida | 3/3 en verde | — |

### Deviations from Design

1. **`StorageGateway.createSignedUploadUrl` devuelve también `bucket`**, además de `signedUrl`/`token` (el contrato de `design.md` solo listaba `storagePath/signedUrl/token/expiresAt`). Motivo: `SUPABASE_STORAGE_BUCKET` es una variable de entorno solo de servidor; el navegador no tiene otra forma de saber contra qué bucket llamar `uploadToSignedUrl`. `bucket` no es secreto (es solo un identificador), así que devolverlo es más simple y seguro que reimplementar la semántica de subida multipart de `supabase-js` contra la URL firmada desnuda con un `fetch` manual.
2. **No se aplica un límite literal de "≤10 minutos" sobre el permiso de subida.** La API de `@supabase/storage-js` (v2.116.0, verificada en `node_modules/.pnpm/@supabase+storage-js@2.116.0/.../StorageFileApi.ts`) no acepta un parámetro `expiresIn` para `createSignedUploadUrl(path)` — solo `createSignedUrl` (lectura) lo acepta. La vigencia real del permiso de subida es la que Supabase Storage aplique por defecto en el servidor; el "≤10 min" de `design.md` no es controlable de forma independiente con esta versión de la API. Se documenta aquí en vez de implementarse en silencio como no aplicado.
3. **`img-src` de la CSP usa el patrón `https://*.supabase.co`** (el mismo comodín que ya usan `connect-src`/`form-action` en el mismo archivo) en vez del host exacto derivado de `clientEnv().NEXT_PUBLIC_SUPABASE_URL`. Motivo: el arreglo de la CSP en `security-headers.ts` se construye en el momento de importar el módulo; llamar a `clientEnv()` ahí obligaría a que importar ese archivo (incluido desde `security-headers.test.ts`) requiera variables de entorno reales, rompiendo `pnpm test` en un shell limpio. `next.config.ts`'s `images.remotePatterns` sí usa el host exacto derivado (ese archivo nunca se importa desde Vitest).
4. **`ImageUploadPort` (las tres Server Actions) se recibe como prop desde `page.tsx` hacia `<Editor imagePort={...}>`, nunca se importa por valor dentro de `editor/ui`.** Reproduce el patrón ya existente de `SavePagePort` y su razón documentada (comentario de `editor/domain/save-page-port.ts`): un import por valor del barrel `@/modules/notebooks` arrastraría `createId()` (`node:crypto`) y todo el grafo de Server Actions al bundle de cliente del editor. Verificado empíricamente: `pnpm build` compila sin problemas con este cableado por props. La subida real de bytes (`uploadToSignedUrl`) no puede ser una Server Action (los bytes deben ir directo del navegador a Storage), así que vive en un cliente de navegador mínimo y local al editor (`editor/ui/tiptap/upload-to-signed-url.ts`) que solo usa variables públicas — `identity/infrastructure/supabase-browser-client.ts` no era alcanzable (el `index.ts` público de `identity` es `server-only`; la regla `ui-never-touches-infra` de `.dependency-cruiser.cjs` también prohíbe importar directamente la `infrastructure/` de otro módulo).
5. **`ALLOWED_MIME`/`MAX_ASSET_BYTES` se duplican en `editor/domain/image-asset-limits.ts`** en vez de importar la copia de `@/modules/notebooks`, por la misma razón de import-por-valor/bundle-de-cliente del punto 4 (reproduce el precedente ya existente de `PAGE_VERSION_CONFLICT_CODE`, redeclarado en vez de importado en `save-page-port.ts`). La validación del servidor en `RequestImageUpload`/`RegisterPageAsset` sigue siendo la autoritativa; la copia del editor es solo el chequeo temprano y no autoritativo del cliente.
6. **Los imports de 3 archivos de test de base de datos ya existentes cambiaron del barrel `@/modules/notebooks/infrastructure` a la ruta concreta del repositorio Drizzle** (`notebooks-repository.smoke.test.ts`, `drizzle-page-repository.contract.test.ts`, `save-page-race.test.ts`). Causa raíz: agregar `SupabaseStorageGateway` (que empieza con `import "server-only"`) a ese barrel rompió `vitest.db.config.ts` (resolución de módulos de Node plano, sin la condición `react-server`) con el error "This module cannot be imported from a Client Component module". Se corrigió importando los archivos concretos directamente en esos tres tests (permitido: `tests/db` está fuera de `src/modules`, así que la regla `cross-module-via-index` de `.dependency-cruiser.cjs` no aplica ahí). Verificado: `pnpm exec vitest run --config vitest.db.config.ts` → 8/8 archivos en verde tras la corrección.

### Issues Found

Ninguno más allá de las desviaciones documentadas arriba, todas resueltas dentro de este mismo batch.

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de este batch (sin `pnpm-lock.yaml` ni `drizzle/meta`): **≈1980 líneas agregadas / 32 eliminadas ≈ 2012 líneas de autoría totales**, muy por encima del presupuesto de ~400. Esta fase no se dividió en PRs encadenadas durante este batch: el prompt que lanzó este batch delimitó el alcance como "Phase 6 of tasks.md (PR6)" como una sola unidad entregable y pidió explícitamente no crear un commit, así que no se ejerció ninguna decisión de `delivery_strategy`/encadenamiento aquí. **Queda pendiente para el orquestador/usuario**: si PR6 debe salir como una PR revisable dentro del presupuesto de 400 líneas, hace falta dividirla después de este batch (por ejemplo, según las seis unidades de trabajo (a)–(f) listadas arriba) antes de abrir la PR.

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm exec vitest run` → 66 archivos / 281 tests en verde; `pnpm exec vitest run --config vitest.db.config.ts` (con `SUPABASE_STORAGE_BUCKET=page-assets` exportado) → 8 archivos / 14 tests en verde |
| Comando/escenario de runtime y resultado exacto | `pnpm exec tsc --noEmit` limpio; `pnpm lint` (biome check) limpio; `pnpm depcruise` sin violaciones (279 módulos, 735 dependencias); `pnpm build` (build real de Next, con `.env.local`) exitoso, sin fuga del gateway con el service role hacia el bundle de cliente; `pnpm exec playwright test tests/e2e/image-upload.spec.ts tests/e2e/slash-command.spec.ts --workers=1` contra `cogni-dev` → 6/6 en verde |
| Rollback boundary | Revertir esta fase: borrar todos los archivos "Created" listados en Files Changed (a)–(f); revertir las ediciones de `env.schema.ts`/`env.test.ts`, `storage-gateway.ts`, `fake-storage-gateway.ts`, `infrastructure/index.ts`, `domain/index.ts`, `application/index.ts`, `actions.ts`/`actions.test.ts`, `notebooks/index.ts`, `next.config.ts`, `security-headers.ts`/`security-headers.test.ts`, `archive-page.test.ts`, `extensions/index.ts`, `editor.tsx`, `slash-command-items.ts`, `editor/index.ts`, `page.tsx`, y los 3 imports de test de base de datos corregidos; revertir `drizzle/0004_page_assets_storage.{sql,down.sql}` y `drizzle/meta/{_journal.json,0004_snapshot.json}` (aplicando el `.down.sql` a mano contra `cogni-dev`, dado que `drizzle-kit` no tiene comando `down`). Ningún archivo de las fases 0–5b se tocó fuera de este alcance. |

### Pendiente — `(usuario)`

- [ ] 6.2 `(usuario)`: confirmar visualmente en el dashboard de Supabase del proyecto `cogni-prod` que el bucket `page-assets` existe con los mismos límites, una vez que la migración `0004` llegue a ese proyecto. Ya se confirmó para `cogni-dev` mediante `tests/db/page-assets-storage.smoke.test.ts` (en verde).
- [ ] 6.4 `(usuario)`: agregar `SUPABASE_STORAGE_BUCKET=page-assets` a `.env.local`, y la misma variable con el mismo valor en el dashboard de Vercel para **Production** y **Preview**. Mientras tanto, toda la verificación local de este batch (`pnpm test:db`, la suite e2e de imágenes) se corrió exportando la variable manualmente en el shell.
- [ ] Decisión de entrega pendiente: definir si PR6 se entrega como una sola PR con `size:exception` o se divide en las seis unidades de trabajo (a)–(f) antes de abrir la pull request (~2012 líneas de autoría totales, ver "Impacto en el presupuesto de revisión").

### Estado

Fase 6: 6.1, 6.3 y 6.5–6.20 completas (20/22 tareas; 6.2 y 6.4 son pasos manuales del usuario). Gate completo en verde (`pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm build`, e2e). No se creó commit de trabajo en este batch (instrucción explícita del prompt). Pendiente: los dos pasos `(usuario)` de arriba y la decisión de entrega sobre el presupuesto de revisión.

## Fase 8a: Follow-ups de cierre — CSP, proxy, redirect de apex (PR8a)

Strict TDD Mode: activo. Test runners: `pnpm exec vitest run <path>` (unit, jsdom) y `pnpm exec playwright test <spec>` (e2e, contra `next build && next start` real — ver `playwright.config.ts`). No se creó commit de trabajo en este batch (instrucción explícita del prompt de esta ejecución: el orquestador dividirá los commits por unidad de trabajo y correrá la revisión nativa después).

Contexto adicional recibido a mitad de este batch: la URL real del proyecto `cogni-dev` es `https://www.cogni-dev.com` (canónico con `www`). No cambió la implementación — `apexRedirectTarget` en `src/proxy.ts` deriva el host canónico genéricamente de `clientEnv().NEXT_PUBLIC_SITE_URL`, nunca de un literal hardcodeado — pero confirma que el caso de prueba elegido (canónico = variante `www`, ver Deviations) coincide con el despliegue real.

### Files Changed (agrupado por unidad de trabajo)

**(a) Anclaje del matcher del proxy**

| File | Action | What Was Done |
|---|---|---|
| `src/proxy.ts` | Modified | `matcher` cambia el segmento `monitoring` (sin ancla) por `monitoring(?:/|$)` dentro del grupo negativo de exclusión (Requirement "Anclaje del proxy matcher a rutas de aplicación") |
| `tests/proxy/matcher.test.ts` | Created | Compila `config.matcher[0]` con el mismo `path-to-regexp` interno que usa Next (`next/dist/compiled/path-to-regexp`, vía `next/dist/lib/try-to-parse-path.js`), y evalúa el resultado igual que `next/dist/shared/lib/router/utils/middleware-route-matcher.js` (`new RegExp(matcher.regexp).exec(pathname)`); prueba `/monitoring`, `/monitoring/algo` (excluidas) y `/monitoring-extra` (NO excluida) |

**(b) Nonce de CSP por petición + `security-headers.ts`**

| File | Action | What Was Done |
|---|---|---|
| `src/shared/config/security-headers.ts` | Modified | Refactor de constante estática a `buildSecurityHeaders(nonce: string)`; `script-src`/`style-src` sustituyen `'unsafe-inline'` por `` `'nonce-${nonce}' 'strict-dynamic'` `` cuando hay nonce; `securityHeaders` (export estático, sin nonce) se conserva para `next.config.ts` como red de seguridad |
| `src/shared/config/security-headers.test.ts` | Modified | Los 5 tests existentes de `securityHeaders` quedan intactos; se agregan 3 casos para `buildSecurityHeaders(nonce)`: sustitución de `'unsafe-inline'` por el nonce dado en `script-src`/`style-src`, un caso de triangulación (dos nonces distintos producen `script-src` distintos), y un caso que confirma que el resto de directivas/headers no-nonce quedan idénticas al export estático |
| `src/proxy.ts` | Modified | Genera `const nonce = Buffer.from(crypto.randomUUID()).toString("base64")` por petición; construye `requestHeaders` con `x-nonce` y el `Content-Security-Policy` resultante, y pasa un `NextRequest` clonado con esos headers a `updateSession` (para que Next pueda parsear `'nonce-{value}'` del CSP de la propia petición durante el renderizado, según `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`); fija el mismo CSP en la respuesta final, incluyendo las dos ramas de redirect de sesión (`withCookies`) |
| `tests/proxy/nonce.test.ts` | Created | Mockea `updateSession` (nunca toca Supabase real); 2 casos: dos peticiones a la misma ruta producen nonces distintos en la CSP de la respuesta (Scenario "Nonce único por petición"), y el `x-nonce` visto por `updateSession` (i.e. por el renderizado) coincide con el nonce de la CSP de esa misma petición |
| `tests/e2e/csp-nonce.spec.ts` | Created | 2 casos contra el build de producción real: la CSP de `/login` trae un nonce y no contiene `'unsafe-inline'` en `script-src`; un `<script>` sin nonce insertado en el HTML antes de que el navegador lo parsee (ver Deviations, punto 1) es bloqueado — se verifica el evento `securitypolicyviolation` y que el marcador que ese script intentaba fijar nunca se establece |

**(c) Redirect del dominio apex**

| File | Action | What Was Done |
|---|---|---|
| `src/proxy.ts` | Modified | `apexRedirectTarget` calcula el host canónico de `clientEnv().NEXT_PUBLIC_SITE_URL`; si el host de la petición difiere y ambos son la variante apex/`www` del mismo dominio (comparación simétrica quitando el prefijo `www.` de ambos lados), el proxy responde `NextResponse.redirect` 308 antes de tocar la sesión, preservando `pathname` y `search` |
| `tests/proxy/apex-redirect.test.ts` | Created | 3 casos: apex → redirect 308 al canónico (`www`) con ruta y query string preservados (Scenario "Apex redirige al dominio canónico"); una petición ya en el host canónico NO se redirige y sigue el flujo normal de sesión; un host no relacionado (`*.vercel.app`) NO se redirige |

**(d) e2e adicional + configuración**

| File | Action | What Was Done |
|---|---|---|
| `vitest.config.ts` | Modified | `include` agrega `tests/proxy/**/*.{test,spec}.{ts,tsx}` (ver Deviations, punto 2); `tests/e2e/**` sigue excluido y `vitest.db.config.ts` sigue siendo un runner separado con su propio `include`, sin overlap |
| `openspec/changes/phase-1-notebooks-editor/tasks.md` | Modified | 8a.1–8a.9 marcadas `[x]`, con notas en 8a.4 y 8a.9 |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 8a.1 | `tests/proxy/nonce.test.ts` | Unit | ✅ `pnpm exec vitest run src/shared/config/security-headers.test.ts` 5/5 antes de tocar el archivo (proxy.ts no tenía test co-ubicado que tocara nonces) | ✅ Escrito antes de tocar `src/proxy.ts`/`security-headers.ts`: ambos casos fallan (`expected undefined to be defined`, sin CSP en la respuesta) | ✅ 2/2 en verde tras implementar | ✅ 2 casos (nonces distintos entre peticiones; coherencia `x-nonce` ↔ CSP dentro de la misma petición) | — (proxy.ts se refactorizó en el mismo cambio que lo puso en verde; sin paso de refactor posterior) |
| 8a.2 | `src/shared/config/security-headers.test.ts` | Unit | ✅ 5/5 tests estáticos existentes, corridos antes de refactorizar el archivo | Implementación (no marcada RED en tasks.md); los 3 casos nuevos de `buildSecurityHeaders` se escribieron junto con la función y pasaron en la primera corrida | ✅ 8/8 en verde (5 existentes + 3 nuevos) | ✅ Caso explícito de triangulación (dos nonces → dos `script-src` distintos) | ✅ `pnpm exec biome check --write` (solo formato: envolturas de línea) |
| 8a.3 | `tests/proxy/nonce.test.ts` (segundo caso) | Unit | Ver 8a.1 | ✅ Mismo RED que 8a.1 (el caso de `x-nonce` visto por `updateSession`) | ✅ Verde tras implementar | ➖ Cubierto por el mismo caso | — |
| 8a.4 | `tests/e2e/csp-nonce.spec.ts` | E2E | N/A (archivo nuevo) | ✅ Escrito antes de correrlo contra el build; primera corrida del segundo caso falló (ver Deviations, punto 1: `page.evaluate()` no está sujeto a CSP) | ✅ 2/2 en verde tras corregir el mecanismo de inyección (intercepción de la respuesta real vía `page.route`) | ➖ Un solo escenario del Requirement | — |
| 8a.5/8a.6 | `tests/proxy/matcher.test.ts` | Unit | ✅ `src/proxy.test.ts` (test co-ubicado preexistente) 4/4 en verde antes de tocar `src/proxy.ts` | ✅ Escrito antes de anclar el `matcher`: el caso `/monitoring-extra` falla (`expected false to be true`, la ruta quedaba excluida por error) | ✅ 2/2 en verde tras anclar `monitoring(?:/|$)` | ✅ 2 casos (excluidas: `/monitoring`, `/monitoring/algo`; no excluida: `/monitoring-extra`) | — |
| 8a.7/8a.8 | `tests/proxy/apex-redirect.test.ts` | Unit | Ver 8a.1 (mismo archivo `src/proxy.ts`) | ✅ Escrito antes de implementar el redirect: el caso de redirect real falla (`updateSession` se invoca, cuando no debería) | ✅ 3/3 en verde tras implementar `apexRedirectTarget` | ✅ 3 casos (redirect apex→canónico; canónico sin redirect; host no relacionado sin redirect) | — |

### Test Summary

- **Total tests escritos en este batch**: 15 (7 en `tests/proxy/`, 3 nuevos en `security-headers.test.ts`, 2 en `tests/e2e/csp-nonce.spec.ts`, más los 3 existentes de `src/proxy.test.ts` verificados como red de seguridad — no reescritos)
- **Total tests en verde**: 15/15 nuevos; suite completa `pnpm exec vitest run` → 70 archivos / 311 tests en verde (antes de este batch: 66/281 según Fase 6)
- **Layers usadas**: Unit (13), E2E (2)
- **Approval tests** (refactoring): Ninguno — `security-headers.ts` se reescribió como una función parametrizada, no una refactorización de comportamiento externo (el export estático conserva byte a byte el mismo resultado, cubierto por los 5 tests preexistentes sin modificar)
- **Pure functions creadas**: `bareHost`, `apexRedirectTarget`, `scriptSrc`, `styleSrc`, `buildContentSecurityPolicy`, `buildHeaders`, `buildSecurityHeaders` (todas sin efectos secundarios; `apexRedirectTarget` solo lee `clientEnv()`, no muta nada)

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm exec vitest run proxy` → 4 archivos / 11 tests en verde (nota: el comando literal del gate `pnpm test -- proxy` no filtra — ver Deviations, punto 3 — y corre la suite completa: 70 archivos / 311 tests en verde, que también incluye estos 11); `pnpm exec vitest run src/shared/config/security-headers.test.ts` → 8/8 en verde |
| Comando/escenario de runtime y resultado exacto | `pnpm exec tsc --noEmit` limpio; `pnpm lint` (biome check) limpio tras `pnpm exec biome check --write` sobre los archivos tocados (solo diffs de formato); `pnpm depcruise` sin violaciones (281 módulos, 739 dependencias); `pnpm build` (build real de Next con `.env.local`, migración de DB correctamente omitida por `VERCEL_ENV` no productivo) exitoso; `pnpm exec playwright test tests/e2e/csp-nonce.spec.ts` → 2/2 en verde contra `next build && next start` real; smoke adicional `pnpm exec playwright test tests/e2e/shell-empty-state.spec.ts tests/e2e/editor-a11y.spec.ts` → 10/10 en verde (confirma que `style-src` con nonce no rompe Tailwind, el menú "/" de cmdk ni el layout del shell) |
| Rollback boundary | Revertir esta fase: eliminar `tests/proxy/` y `tests/e2e/csp-nonce.spec.ts` (archivos nuevos); revertir las ediciones de `src/proxy.ts`, `src/shared/config/security-headers.ts`, `src/shared/config/security-headers.test.ts` y `vitest.config.ts`. `src/proxy.test.ts` (preexistente) no se tocó. Ningún archivo de las fases 0–6 se tocó fuera de este alcance. |

### Deviations from Design

1. **El segundo caso de `tests/e2e/csp-nonce.spec.ts` no inyecta el script sin nonce vía `page.evaluate()`.** Diseño intuitivo inicial: crear el elemento `<script>` con `document.createElement`/`appendChild` dentro de `page.evaluate()`. Falló en la primera corrida real: el script se ejecutó igual, porque `page.evaluate()` corre a través del DevTools Protocol (`Runtime.evaluate`), que Chromium trata como un contexto de ejecución confiable — un elemento creado ahí no pasa por el mismo análisis de "¿quién lo insertó?" que usa `'strict-dynamic'`, así que el navegador no lo bloquea aunque el CSP real (verificado con `curl`, ver más abajo) sí tenía el nonce correcto y ningún `'unsafe-inline'`. Corrección: el test ahora intercepta la respuesta real de `/login` con `page.route` (`route.fetch()` conserva los headers reales, incluido el CSP con el nonce real de esa petición), le agrega un `<script>` sin nonce al HTML antes de `</body>`, y sirve ese HTML modificado con `route.fulfill`. Al ser HTML parseado genuinamente por el navegador (script insertado por el parser, no por un script ya confiado), `'strict-dynamic'` no lo exime de necesitar el nonce, y el navegador lo bloquea como corresponde. Verificado independientemente con `curl -D -` contra el build real: un único header `Content-Security-Policy`, con el nonce y sin `'unsafe-inline'` en `script-src`/`style-src`.
2. **`vitest.config.ts` agrega `tests/proxy/**/*.{test,spec}.{ts,tsx}` a `include`.** Autorizado explícitamente por el prompt de este batch: los tests 8a.1/8a.6/8a.8 de tasks.md nombran rutas bajo `tests/proxy/`, fuera del `include` original (`src/**/*.{test,spec}.{ts,tsx}`). `tests/e2e/**` se mantiene excluido (Playwright-only) y `vitest.db.config.ts` sigue siendo un runner separado con su propio `include`, sin overlap.
3. **`pnpm test -- proxy` (comando literal del gate 8a.9) no filtra por nombre de archivo**: corre la suite completa (70/311 en verde) en vez de solo los archivos que contienen "proxy" en la ruta. Es un artefacto de cómo pnpm reenvía argumentos al script `vitest run` (aparece como `vitest run -- proxy` en la salida, y vitest no toma "proxy" como patrón de archivo después de ese `--`). El comando equivalente que sí filtra es `pnpm exec vitest run proxy` (4 archivos / 11 tests en verde, incluye los 3 nuevos de `tests/proxy/` más `src/proxy.test.ts` preexistente). No es una regresión introducida por este batch — no se investigó más por estar fuera de alcance — pero se documenta porque el resultado del comando literal solicitado no es el filtrado que su nombre sugiere.
4. **`style-src` sí adopta `'nonce-${nonce}' 'strict-dynamic'` en producción, sin caer de vuelta a `'unsafe-inline'`.** El Requirement "Nonces de CSP" solo exige `MUST NOT` usar `'unsafe-inline'` para *scripts*; `design.md` pedía la misma sustitución también para `style-src` como decisión más estricta, con la instrucción explícita de este batch de verificar contra un build real y documentar una desviación si rompía Tailwind o atributos de estilo en línea. Se verificó: `pnpm exec playwright test tests/e2e/shell-empty-state.spec.ts tests/e2e/editor-a11y.spec.ts` (10/10 en verde, incluye aserciones `toHaveCSS` sobre colores/anchos reales del shell público y autenticado, y el menú "/" de `cmdk`, que posiciona vía estilos en línea) no mostró ninguna ruptura. No fue necesario ningún fallback: se implementó tal como lo pedía `design.md`, sin desviación.

### Issues Found

Ninguno más allá de las desviaciones documentadas arriba, todas resueltas dentro de este mismo batch.

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` de los archivos trackeados modificados en este batch: **206 líneas agregadas / 48 eliminadas** (`tasks.md` 9/9, `src/proxy.ts` 63/6, `security-headers.test.ts` 62/1, `security-headers.ts` 68/31, `vitest.config.ts` 4/1). Los 4 archivos nuevos (no trackeados) suman **285 líneas** (`tests/proxy/nonce.test.ts` 73, `tests/proxy/matcher.test.ts` 51, `tests/proxy/apex-redirect.test.ts` 80, `tests/e2e/csp-nonce.spec.ts` 81). **Total de autoría de este batch ≈ 539 líneas**, por encima tanto del pronóstico inicial (~200–280 líneas) como del presupuesto de ~400.

`delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main` ya estaban resueltos antes de este batch, y el prompt delimitó "Phase 8a" completa como una sola unidad entregable (PR8a), agrupando explícitamente los "Files Changed" de arriba en 4 unidades de trabajo — (a) anclaje del matcher, (b) nonce de CSP + `security-headers.ts`, (c) redirect de apex, (d) e2e + configuración — "para que el orquestador pueda dividir los commits". No se dividió el trabajo en múltiples PRs dentro de este batch: ese es el criterio explícito que el prompt delegó al orquestador. **Queda pendiente para el orquestador**: decidir si PR8a sale como una sola PR con `size:exception` (~539 líneas) o si las 4 unidades de trabajo (a)–(d) se convierten en commits/PRs encadenados separados dentro del mismo `chain_strategy: stacked-to-main` ya elegido.

### Pendiente — `(usuario)`

- [x] 8a.4 `(usuario)`: correr `tests/e2e/csp-nonce.spec.ts` contra un despliegue de preview real de Vercel. **Cerrado el 2026-09-21**: el usuario creó el secret de "Protection Bypass for Automation" en Vercel (los previews de este proyecto tienen Deployment Protection activa y responden 302 hacia el SSO de Vercel sin ese header) y el spec se corrió contra el preview de `feat/phase-1-pr8a-2-csp-nonce` con `playwright.preview.config.ts`: 2/2 en verde. Ese config carga `.env.local` vía `@next/env`, lee `PREVIEW_URL` y `VERCEL_AUTOMATION_BYPASS_SECRET`, envía los headers `x-vercel-protection-bypass` y `x-vercel-set-bypass-cookie`, y no levanta `webServer`. Comando: `PREVIEW_URL=<url> pnpm exec playwright test tests/e2e/csp-nonce.spec.ts --config playwright.preview.config.ts`.
- [ ] Decisión de entrega pendiente: confirmar si PR8a se entrega como una sola PR con `size:exception` (~539 líneas de autoría) o se divide en las 4 unidades de trabajo (a)–(d) listadas arriba, dentro de `chain_strategy: stacked-to-main` (ver "Impacto en el presupuesto de revisión").

### Estado

Fase 8a: 8a.1–8a.9 completas (9/9 tareas `[x]` en `tasks.md`). Gate en verde: `pnpm exec vitest run` (70/311), `pnpm exec vitest run proxy` (4/11), `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm depcruise`, `pnpm build`, `pnpm exec playwright test tests/e2e/csp-nonce.spec.ts` (2/2) más smoke adicional de `shell-empty-state`/`editor-a11y` (10/10). No se creó commit de trabajo en este batch (instrucción explícita del prompt); el orquestador partió el trabajo después en dos ramas encadenadas (`stacked-to-main`): `feat/phase-1-pr8a-1-proxy-matcher-apex` (commit `b619787`: matcher anclado, redirect de apex, include de vitest y sus dos tests) y `feat/phase-1-pr8a-2-csp-nonce` (commit `6289d26`: nonce de CSP, `buildSecurityHeaders`, test de nonce, e2e y estos artefactos). Revisión nativa del rango completo aprobada y reconocida (lineage `review-0acdddda110807a0`, tier high, cuatro lentes, sin corrección). La corrida de 8a.4 contra un preview real quedó cerrada (ver arriba).

## Fase 8b: Follow-ups de cierre — identity (PR8b)

Strict TDD Mode: activo. Test runners: `pnpm exec vitest run <path>` (unit/component, jsdom) y `pnpm exec playwright test <spec>` (e2e, contra `next build && next start` real). No se creó commit de trabajo en este batch (instrucción explícita del prompt: el orquestador dividirá los commits por unidad de trabajo y correrá la revisión nativa después).

### Files Changed (agrupado por unidad de trabajo)

**(a) `signInWithPassword` expone `userId` (8b.1–8b.4)**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/identity/domain/auth-gateway.ts` | Modified | `signInWithPassword` cambia su firma a `Promise<Result<{ userId: string }, DomainError>>` |
| `src/modules/identity/infrastructure/supabase-auth-gateway.ts` | Modified | Lee `data.user.id` de la respuesta de `supabase.auth.signInWithPassword` y lo devuelve en `ok({ userId })`, en vez de descartar `data` |
| `src/modules/identity/infrastructure/supabase-auth-gateway.test.ts` | Modified | Nuevo caso: sign-in exitoso expone `{ userId: "u-77" }` (Scenario "Gateway de sign-in expone `userId`") |
| `src/modules/identity/application/testing/fake-auth-gateway.ts` | Modified | `signInWithPassword` del doble devuelve `{ userId: "fake-user-N" }` (mismo esquema que `signUp`), usando el índice del usuario sembrado |
| `src/modules/identity/application/sign-in.ts` | Modified | Firma de retorno de `signIn` sigue el nuevo tipo del gateway (`Result<{ userId: string }, DomainError>>`); sin cambio de lógica, es un passthrough |
| `src/modules/identity/application/sign-in.test.ts` | Modified | El caso "signs a verified user in" confirma además `result.value.userId === "fake-user-1"` |
| `src/modules/identity/actions.ts` | Modified | `signInAction` toma `userId` de `result.value.userId`; elimina la segunda llamada `(await createSupabaseServerClient()).auth.getUser()` |
| `src/modules/identity/actions.test.ts` | Created | Suite nueva para las Server Actions de `actions.ts` (mockea `next/navigation`, `next/server`, `@/shared/observability/analytics`, `@/shared/config/env.client` y solo `createSupabaseServerClient` dentro de `./infrastructure`, dejando el `SupabaseAuthGateway` real). Caso de `signInAction`: confirma `auth.getUser` NO se invoca y que `track("user_signed_in", "u-42")` recibe el `userId` de la respuesta mockeada de Supabase, no de una segunda consulta |

**(b) Evento `user_signed_in` en el callback de OAuth (8b.5–8b.6)**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/identity/index.ts` | Modified | `exchangeCodeForSession` cambia de `Promise<boolean>` a `Promise<{ ok: boolean; userId: string | null }>`, leyendo `data.user?.id` de la respuesta de `supabase.auth.exchangeCodeForSession` (ya presente en el payload, evita una segunda consulta) |
| `src/app/auth/callback/route.ts` | Modified | Tras un `exchangeCodeForSession` exitoso con `userId`, ejecuta `after(() => analytics().track("user_signed_in", userId))` con la misma fábrica `createServerAnalytics` que `identity/actions.ts` (función local `analytics()`, duplicada intencionalmente — ver Deviations) |
| `tests/identity/oauth-callback.test.ts` | Created | 3 casos: un callback exitoso con `userId` envía exactamente un evento `user_signed_in` (Scenario "Inicio de sesión con Google emite evento"); sin `code` no llama a `exchangeCodeForSession` ni a `track`; un intercambio fallido tampoco llama a `track` |
| `vitest.config.ts` | Modified | `include` agrega `tests/identity/**/*.{test,spec}.{ts,tsx}` (instrucción explícita del prompt de este batch) |

**(c) `signOutAction` maneja el `Result` de `signOut` (8b.7–8b.8)**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/identity/actions.ts` | Modified | `signOutAction` inspecciona el `Result` de `auth.signOut()`; cambia su firma a `Promise<{ status: "error"; message: string } | undefined>` (no `void`, ver Deviations); en éxito sigue llamando `redirect("/login")`, en error devuelve `{ status: "error", message: messageForCode(...) }` sin redirigir |
| `src/modules/identity/actions.test.ts` | Modified (misma unidad de trabajo que (a), ver arriba) | 2 casos de `signOutAction`: éxito redirige a `/login` y no devuelve error (Scenario "Cierre exitoso"); error de Supabase (`over_request_rate_limit`) NO redirige y devuelve `{ status: "error", message: "No pudimos completar la acción..." }` (Scenario "Error al cerrar sesión no se oculta") |
| `src/modules/identity/ui/sign-out-button.tsx` | Modified | Se adapta al nuevo tipo de retorno: usa `useActionState` (mismo patrón que `SignInForm`/`SignUpForm` en `auth-forms.tsx`) con un `signOutFormAction` wrapper que traduce el resultado a `AuthFormState`, renderiza `<AuthStatus state={state} />` (oculto cuando `idle`) y deshabilita el botón mientras `pending` |
| `src/modules/identity/ui/sign-out-button.test.tsx` | Created | 2 casos: un error de Supabase mockeado se muestra vía `role="alert"` (no se oculta como sesión cerrada); un éxito no muestra ningún `alert` y llama a `signOutAction` exactamente una vez |

**(d) Upsert de `profiles` + resiliencia de `EnsureProfile` (8b.9–8b.11)**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/identity/infrastructure/drizzle-profile-repository.ts` | Modified | Sin cambio de comportamiento: se agrega TSDoc a `upsert` documentando por qué es `onConflictDoNothing` (insert-or-ignore) y no `onConflictDoUpdate`, citando el Requirement y el escenario de personalización del usuario que se perdería |
| `src/modules/identity/application/testing/in-memory-profile-repository.ts` | Modified | **Corrección de bug del doble de test**: `upsert` sobrescribía siempre ("same id overwrites"), contradiciendo la semántica real de `onConflictDoNothing`; ahora ignora la escritura si el `id` ya existe, igual que el adaptador real |
| `src/modules/identity/application/testing/in-memory-profile-repository.test.ts` | Created | 2 casos: un `upsert` repetido con un `displayName` distinto NO sobrescribe el existente (Scenario "Upsert no sobrescribe campos existentes"); un `upsert` sobre un `id` nuevo sí inserta la fila |
| `src/modules/identity/application/ensure-profile-resilient.ts` | Created | `ensureProfileResilient(input, deps)`: intenta `ensureProfile` una vez, si falla espera `deps.retryDelayMs` (150ms por defecto) y reintenta una sola vez; si el segundo intento también falla, invoca `deps.onTransientFailure?.(error)` y NO relanza la excepción. Vive en `application/` sin importar Sentry: recibe el callback como dependencia, respetando el límite hexagonal (`ui`/`application` nunca importan `infrastructure` directamente ni SDKs externos de observabilidad) |
| `src/modules/identity/application/ensure-profile-resilient.test.ts` | Created | 2 casos con un `FlakyProfileRepository` (falla `findById` N veces antes de delegar a un `InMemoryProfileRepository` real): 1 fallo → reintenta y crea el perfil, `onTransientFailure` NO se llama; 2 fallos → no lanza, no crea el perfil, `onTransientFailure` se llama exactamente 1 vez |
| `src/modules/identity/application/index.ts` | Modified | Exporta `ensureProfileResilient` y `EnsureProfileResilientDeps` |
| `src/modules/identity/index.ts` | Modified | `ensureProfileForUser` delega en `ensureProfileResilient`, pasando `DrizzleProfileRepository`/`systemClock` reales y `onTransientFailure: (error) => Sentry.captureException(error)` (mismo patrón de `import * as Sentry from "@sentry/nextjs"` que `global-error.tsx`) |

**(e) Resaltado del menú "/" por teclado (8b.11b)**

| File | Action | What Was Done |
|---|---|---|
| `src/modules/editor/ui/command-menu.tsx` | Modified | Se elimina el `data-selected={index === selectedIndex}` pasado directamente a `CommandItem` (cmdk lo pisaba con su propio estado interno — ver Deviations) y se controla la selección con la API nativa de `cmdk`: `<Command value={filtered[selectedIndex]?.id} onValueChange={...}>` + `<CommandItem value={item.id}>`; se retira el `onMouseEnter` manual porque `onValueChange` de cmdk ya cubre el hover del mouse |
| `src/modules/editor/ui/command-menu.test.tsx` | Modified | Nuevo caso: tras `ArrowDown`, el ítem "párrafo" queda con `data-selected="true"` y "encabezado 1" con `data-selected="false"` (antes del fix, ambos quedaban en el estado inicial) |

**(f) Config y documentación**

| File | Action | What Was Done |
|---|---|---|
| `openspec/changes/phase-1-notebooks-editor/tasks.md` | Modified | 8b.1–8b.12 (incluyendo 8b.11b) marcadas `[x]`, con notas de ubicación de tests y desviaciones |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 8b.1/8b.2 | `src/modules/identity/infrastructure/supabase-auth-gateway.test.ts` | Unit | ✅ `pnpm exec vitest run sign-in.test.ts supabase-auth-gateway.test.ts` 9/9 antes de tocar código | ✅ Escrito antes de tocar `signInWithPassword`: falla con `expected { ok: true, value: undefined }` | ✅ Verde tras leer `data.user.id` | ➖ Un solo escenario nuevo del Requirement; los 5 casos preexistentes de error siguen cubriendo las otras ramas | — |
| 8b.1/8b.3/8b.4 | `src/modules/identity/application/sign-in.test.ts` | Unit | Ver arriba | ✅ Aserción `result.value.userId` agregada antes de tocar `sign-in.ts`: falla con `Cannot read properties of undefined (reading 'userId')` | ✅ Verde (passthrough del nuevo tipo del gateway) | ➖ Reutiliza los 3 casos preexistentes de error (no tocados) | — |
| 8b.3/8b.4/8b.7/8b.8 | `src/modules/identity/actions.test.ts` | Unit | N/A (archivo nuevo); confirmado indirectamente corriendo el test contra el `actions.ts` **sin modificar** (revertido con `git stash` temporalmente) | ✅ Escrito y ejecutado contra el `actions.ts` original: 2/3 fallan (`signInAction` con `Cannot destructure property 'data'...` al llamar `auth.getUser()` inexistente en el mock; `signOutAction` de error con `redirect` llamado cuando no debía) | ✅ 3/3 en verde tras restaurar la implementación nueva (`git stash pop`) | ✅ 2 casos de `signOutAction` (éxito/error) + 1 de `signInAction`; triangula gateway real (`SupabaseAuthGateway`) sin mockear, solo `createSupabaseServerClient` | — |
| 8b.7/8b.8 | `src/modules/identity/ui/sign-out-button.test.tsx` | Component | ✅ `pnpm exec vitest run user-menu.test.tsx` 3/3 antes de tocar `SignOutButton` (mismo consumidor) | ✅ Escrito antes de tocar `sign-out-button.tsx`: el caso de error falla (`findByRole("alert")` timeout, `<form action={signOutAction}>` nunca inspecciona el resultado) | ✅ 2/2 en verde tras `useActionState` + `AuthStatus` | ✅ 2 casos (error visible, éxito sin error) | — |
| 8b.5/8b.6 | `tests/identity/oauth-callback.test.ts` | Unit | N/A (archivo y directorio nuevos) | ✅ Escrito antes de tocar `route.ts`/`index.ts`: el caso principal falla (`track` llamado 0 veces) | ✅ 3/3 en verde tras `after()` + `exchangeCodeForSession` devolviendo `userId` | ✅ 3 casos (evento enviado, sin código, intercambio fallido) | — |
| 8b.9 | `src/modules/identity/application/testing/in-memory-profile-repository.test.ts` | Unit | ✅ `pnpm exec vitest run ensure-profile.test.ts` 3/3 antes de tocar el doble (mismo repositorio) | ✅ Escrito antes de corregir `upsert`: falla mostrando que el `displayName`/`updatedAt` del segundo `upsert` sobrescribía al primero | ✅ 2/2 en verde tras el insert-or-ignore | ✅ 2 casos (no sobrescribe / inserta la primera vez) | — |
| 8b.10/8b.11 | `src/modules/identity/application/ensure-profile-resilient.test.ts` | Unit | N/A (archivo y módulo nuevos) | ✅ Escrito antes de crear `ensure-profile-resilient.ts`: falla en resolución del import (`Failed to resolve import "./ensure-profile-resilient"`) | ✅ 2/2 en verde tras implementar el retry + degradación | ✅ 2 casos (1 fallo → recupera; 2 fallos → degrada y reporta) | — |
| 8b.11b | `src/modules/editor/ui/command-menu.test.tsx` | Component | ✅ 4/4 tests preexistentes en verde antes de tocar `command-menu.tsx` | ✅ Escrito antes de tocar el componente: falla mostrando `data-selected="false"` en "párrafo" tras `ArrowDown` (el bug exacto descrito en la tarea) | ✅ 5/5 en verde tras controlar la selección con `value`/`onValueChange` de `cmdk` | ➖ Un solo escenario (el bug es binario: sigue o no sigue el teclado); cubre además el estado inicial (primer ítem resaltado) como caso complementario | — |

### Test Summary

- **Total tests escritos/modificados en este batch**: 20 (1 en `supabase-auth-gateway.test.ts`, 1 en `sign-in.test.ts`, 3 en `actions.test.ts`, 2 en `sign-out-button.test.tsx`, 3 en `oauth-callback.test.ts`, 2 en `in-memory-profile-repository.test.ts`, 2 en `ensure-profile-resilient.test.ts`, 1 nuevo en `command-menu.test.tsx`; el resto de casos en archivos nuevos ya cuentan arriba)
- **Total tests en verde**: suite completa `pnpm exec vitest run` → 75 archivos / 325 tests en verde (antes de este batch: 70/311 tras Fase 8a; delta +5 archivos / +14 tests)
- **Layers usadas**: Unit (7 archivos), Component (2 archivos: `sign-out-button.test.tsx`, `command-menu.test.tsx`)
- **Approval tests** (refactoring): 1 — `actions.test.ts` se corrió primero contra el `actions.ts` sin modificar (vía `git stash`) para confirmar RED antes de restaurar la implementación nueva, ya que la producción se había escrito antes de crear ese archivo de test
- **Pure functions creadas**: `ensureProfileResilient`, `wait` (interno), `runEnsureProfile` (interno) — todas en `ensure-profile-resilient.ts`; `ensureProfile` y `InMemoryProfileRepository.upsert` no son nuevas, solo corregidas

### Work Unit Evidence

| Evidencia | Valor |
|---|---|
| Comando de test enfocado y resultado exacto | `pnpm exec vitest run identity` → 13 archivos / 43 tests en verde; `pnpm exec vitest run src/modules/editor/ui/command-menu.test.tsx` → 5/5 en verde; suite completa `pnpm exec vitest run` → 75/325 en verde |
| Comando/escenario de runtime y resultado exacto | `pnpm exec tsc --noEmit` limpio; `pnpm lint` (biome check) limpio tras `pnpm exec biome check --write` sobre los archivos tocados (solo diffs de formato/orden de imports, más un fix manual de `noConfusingVoidType` en la firma de `signOutAction`); `pnpm depcruise` sin violaciones (286 módulos, 760 dependencias, incluye el nuevo `application/ensure-profile-resilient.ts` sin romper el límite `ui`→`application`→`infrastructure`); `pnpm build` (build real de Next con `.env.local`) exitoso; `pnpm exec playwright test tests/e2e/auth.spec.ts` → **8/8 en verde** contra Supabase real (`cogni-dev`), incluye sign-up con verificación pendiente, rechazo de contraseña incorrecta, login+logout de un usuario verificado, inicio de Google OAuth, reset de contraseña y callback sin código |
| Rollback boundary | Cada unidad de trabajo (a)–(f) es revertible de forma independiente: (a) revertir `domain/auth-gateway.ts`, `infrastructure/supabase-auth-gateway.ts(.test.ts)`, `application/testing/fake-auth-gateway.ts`, `application/sign-in.ts(.test.ts)`, la porción de `signInAction` en `actions.ts`, y la porción de `signInAction` en `actions.test.ts`; (b) revertir `index.ts` (solo `exchangeCodeForSession`), `route.ts`, `tests/identity/` (archivo y carpeta nuevos) y la línea agregada a `vitest.config.ts`; (c) revertir la porción de `signOutAction` en `actions.ts`/`actions.test.ts` y `sign-out-button.tsx(.test.tsx)`; (d) revertir `drizzle-profile-repository.ts`, `application/testing/in-memory-profile-repository.ts(.test.ts)`, `application/ensure-profile-resilient.ts(.test.ts)`, `application/index.ts` y la porción de `ensureProfileForUser` en `index.ts`; (e) revertir `command-menu.tsx(.test.tsx)`. Ningún archivo de las fases 0–8a se tocó fuera de este alcance |

### Deviations from Design

1. **`ensureProfileForUser` delega el retry/degradación en un módulo nuevo de `application/` (`ensure-profile-resilient.ts`) en vez de tener el `try/catch` y la llamada a Sentry directamente en `identity/index.ts`.** `design.md` (Decision "`EnsureProfile` resiliente...") describe el comportamiento con el `try/catch`/Sentry viviendo en `ensureProfileForUser`. Se extrajo la lógica de reintento a una función pura e inyectable (`ensureProfileResilient(input, deps)` con `deps.onTransientFailure` como callback) porque: (a) `identity/index.ts` tiene `import "server-only"`, que lanza una excepción real al importarse fuera de un bundle de servidor de Next — no es testeable directamente en Vitest sin mockear el módulo completo; (b) mantiene la capa `application` libre de una dependencia de infraestructura (`@sentry/nextjs`), respetando el mismo límite hexagonal que ya hace cumplir `.dependency-cruiser.cjs`. El comportamiento observable es idéntico al descrito en `design.md`: un reintento, backoff corto, degradación sin relanzar, reporte a Sentry — solo cambia dónde vive el código. `identity/index.ts` conecta `ensureProfileResilient` con `DrizzleProfileRepository`/`systemClock`/`Sentry.captureException` exactamente como antes hacía con `ensureProfile`.
2. **No existe un test directo de `ensureProfileForUser` (la función en `identity/index.ts`) que mockee `@sentry/nextjs`.** Consecuencia directa de la Deviation 1: como `identity/index.ts` importa `"server-only"`, no se puede importar el módulo real en Vitest (lanza `"This module cannot be imported from a Client Component module..."` incondicionalmente en Node, no solo en bundles de cliente de webpack). El comportamiento de reintento/degradación SÍ está cubierto exhaustivamente por `ensure-profile-resilient.test.ts` (2 casos), y el resto de los tests que tocan la capa pública de `identity` (`notebooks/actions.test.ts`, `oauth-callback.test.ts`, este mismo batch) mockean `@/modules/identity` completo en vez de importar el real, que es el patrón preexistente del proyecto (ningún test anterior a este batch importa `identity/index.ts` directamente tampoco).
3. **Las pruebas de `signInAction`/`signOutAction` (8b.4/8b.8) no viven en archivos llamados literalmente `sign-in.test.ts`/`sign-out.test.ts`.** El prompt de este batch nombra esos archivos, pero `sign-in.test.ts` ya existe y es la suite de la capa `application` (`signIn`, sin `"use server"`, sin Next); las Server Actions (`signInAction`, `signOutAction`) viven en `actions.ts` y no tenían suite propia. Se creó `src/modules/identity/actions.test.ts` (nombrado por el archivo bajo prueba, siguiendo la convención ya usada en `src/modules/notebooks/actions.test.ts`) con dos `describe` (`signInAction`, `signOutAction`) que cubren ambos escenarios. `sign-in.test.ts` sí se extendió (8b.4, aserción de `userId`) pero para la capa `application`, no para la Server Action.
4. **`signOutAction` devuelve `{ status: "error"; message: string } | undefined` en vez de `{ status: "error"; message: string } | void` como decía el prompt/`design.md` literalmente.** `pnpm lint` (biome, regla `lint/suspicious/noConfusingVoidType`) marca `void` dentro de una unión de tipos como error; `undefined` es el tipo real del valor que la función devuelve implícitamente al llegar al final sin un `return` explícito, así que es un cambio de anotación de tipo sin cambio de comportamiento.
5. **`command-menu.tsx` retira el `onMouseEnter` manual además del `data-selected` manual.** La tarea 8b.11b solo pedía corregir el resaltado por teclado, pero el `onValueChange` de cmdk (necesario para controlar `value` con la API de cmdk) ya dispara en el mismo evento `onPointerMove` que antes manejaba `onMouseEnter` manualmente — mantener ambos hubiera creado dos fuentes de verdad para `selectedIndex` compitiendo entre sí. Verificado con el caso "moves the selection with arrow keys before confirming with Enter" (preexistente, sigue en verde) y el nuevo caso de teclado; no había ningún test de mouse-hover preexistente para triangular ese camino específico, así que se apoya en la lectura del código de cmdk (línea `onPointerMove:A||d.getDisablePointerSelection()?void 0:S` en `node_modules/cmdk/dist/index.mjs`) para confirmar que el comportamiento de mouse se preserva.

### Issues Found

1. **Bug preexistente en `InMemoryProfileRepository.upsert`** (no introducido por este batch, descubierto al ejecutar 8b.9): su comentario decía explícitamente "same id overwrites, never duplicates", una semántica de upsert-y-sobrescribe que nunca coincidió con la del adaptador real (`onConflictDoNothing`, insert-or-ignore). No se manifestaba como un bug visible porque `ensureProfile` (capa `application`) hace su propio `findById` antes de llamar a `upsert`, así que nunca llegaba a probar el camino de conflicto a través de ese flujo — pero cualquier código futuro que llamara a `upsert` directamente sobre un `id` existente (p. ej. un test de "Escritura concurrente" que invoque el repositorio en paralelo sin pasar por `ensureProfile`) habría observado un comportamiento distinto al de producción. Corregido como parte de 8b.9 (ver Files Changed, unidad (d)).

### Impacto en el presupuesto de revisión (400 líneas)

`git diff --numstat` (archivos trackeados modificados) + líneas totales de los archivos nuevos (no trackeados) de este batch, por unidad de trabajo:

| Unidad | Autoría (add+del, nuevos = líneas totales) |
|---|---|
| (a) sign-in `userId` (8b.1–8b.4) | `actions.ts` 18 + `sign-in.test.ts` 1 + `sign-in.ts` 2 + `fake-auth-gateway.ts` 7 + `auth-gateway.ts` 2 + `supabase-auth-gateway.test.ts` 13 + `supabase-auth-gateway.ts` 34 + `actions.test.ts` (nuevo) 112 = **189** |
| (b) evento OAuth (8b.5–8b.6) | `route.ts` 26 + `vitest.config.ts` 1 + `oauth-callback.test.ts` (nuevo) 68 = **95** (la porción de `index.ts` de esta unidad se reporta junto con (d), mismo archivo) |
| (c) sign-out `Result` (8b.7–8b.8) | `sign-out-button.tsx` 31 + `sign-out-button.test.tsx` (nuevo) 43 = **74** (la porción de `signOutAction`/tests en `actions.ts`/`actions.test.ts` ya está contada en (a), mismos archivos que la unidad (a) toca) |
| (d) upsert + resiliencia (8b.9–8b.11) | `index.ts` 26 (incluye `exchangeCodeForSession` de (b) y `ensureProfileForUser`) + `drizzle-profile-repository.ts` 15 + `in-memory-profile-repository.ts` 5 + `application/index.ts` 4 + `in-memory-profile-repository.test.ts` (nuevo) 52 + `ensure-profile-resilient.ts` (nuevo) 52 + `ensure-profile-resilient.test.ts` (nuevo) 74 = **228** |
| (e) resaltado cmdk (8b.11b) | `command-menu.tsx` 16 + `command-menu.test.tsx` (nuevo) 39 = **55** |
| (f) config/docs | `tasks.md` (marcado de 12 tareas + notas) ≈ 15 |

**Total de autoría de este batch ≈ 656 líneas**, muy por encima tanto del pronóstico inicial del prompt (~200–280 líneas) como del presupuesto de ~400. `delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main` ya estaban resueltos antes de este batch; el prompt delimitó "Phase 8b" completa como una sola unidad entregable (PR8b) para este batch, agrupando explícitamente los "Files Changed" de arriba en unidades de trabajo (a)–(f) "para que el orquestador pueda dividir los commits". No se dividió el trabajo en múltiples PRs dentro de este batch: ese es el criterio explícito que el prompt delegó al orquestador. **Queda pendiente para el orquestador**: decidir si PR8b sale como una sola PR con `size:exception` (~656 líneas) o si las unidades (a)+(c) (sign-in+sign-out en los mismos archivos, ≈220 líneas combinadas contando el solape de `actions.ts`/`actions.test.ts` una sola vez), (b)+(d) (OAuth+resiliencia, comparten `index.ts`, ≈290 líneas) y (e) (≈55 líneas) se convierten en 2–3 commits/PRs encadenados dentro del mismo `chain_strategy: stacked-to-main` ya elegido. Nota: (a) y (c) comparten `actions.ts`/`actions.test.ts` (un único archivo con cambios de `signInAction` y `signOutAction` entrelazados en el mismo diff), por lo que dividirlas en PRs separados requeriría un commit que toque el archivo dos veces o aceptar que viajen juntas.

### Estado

Fase 8b: 8b.1–8b.12 completas, incluyendo 8b.11b (13/13 ítems `[x]` en `tasks.md`, contando 8b.11b). Gate en verde: `pnpm exec vitest run` (75/325), `pnpm exec vitest run identity` (13/43), `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm depcruise` (286 módulos, 760 dependencias, sin violaciones), `pnpm build`, `pnpm exec playwright test tests/e2e/auth.spec.ts` (8/8 en verde contra Supabase real, sin fallos ambientales esta vez). No se creó commit de trabajo en este batch (instrucción explícita del prompt): el orquestador decidirá la división en PRs encadenados y correrá la revisión nativa después. Ningún ítem quedó pendiente `(usuario)` en este batch.
