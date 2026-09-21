# Apply Progress: Fase 1 — Notebooks Editor

## Batch actual: PR0 — migrate-in-build y FK de `profiles` (Phase 0, tasks 0.1–0.8)

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
