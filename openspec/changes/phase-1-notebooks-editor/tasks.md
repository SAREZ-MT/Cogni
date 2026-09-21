# Tasks: Fase 1 — Cuadernos y editor

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR0 ~120-180, PR1 ~350-400, PR2 ~350-400, PR3a ~300-380, PR3b ~300-380, PR4 ~250-350, PR5a ~300-380, PR5b ~250-350, PR6 ~350-400, PR7 ~80-150 (se reparte en los PR de cada slice si el presupuesto lo permite), PR8a ~200-280, PR8b ~200-280 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR0 → PR1 → PR2 → PR3a → PR3b → PR4 → PR5a → PR5b → PR6 → PR8a → PR8b (PR7 absorbido donde el presupuesto de cada slice lo permita) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (confirmado por el usuario el 2026-09-20: cada PR apunta a `main` y se fusiona en orden) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 0 | Migrate-in-build + FK de `profiles` | PR0 | `pnpm test -- env` | `pnpm build` local con `DATABASE_URL` de `cogni-dev` | Revertir `package.json#build`, `.github/workflows/main.yml`, `drizzle/0002_profiles_auth_fk.sql` |
| 1 | Schema, migraciones y dominio/aplicación de `notebooks` (CRUD + `SavePage`) sin UI | PR1 | `pnpm test -- notebooks` | N/A — sin UI ni Server Actions conectadas todavía; se prueba con dobles en memoria | Revertir `src/modules/notebooks/{domain,application}`, `drizzle/0003_*` |
| 2 | Repositorios Drizzle, Server Actions, sidebar y rutas de notebook/page; reescritura de `shell-empty-state.spec.ts` | PR2 | `pnpm test -- notebooks/infrastructure` | `pnpm test:e2e -- shell-empty-state` | Revertir `src/modules/notebooks/{infrastructure,ui,actions.ts}`, rutas `(app)/notebooks` |
| 3a | Editor: dominio/aplicación (`SavePagePort`, `use-autosave`, sin Tiptap) + regla `editor-tiptap-only-in-ui` | PR3a | `pnpm test -- editor/application` | N/A — hook probado con `FakeSavePagePort`, sin Tiptap montado | Revertir `src/modules/editor/{domain,application}` |
| 3b | Editor: Tiptap base (encabezados, párrafo, listas, tarea, cita, código, divisor, marcas, enlaces), menú "/", guardado explícito | PR3b | `pnpm test -- editor/ui` | `pnpm test:e2e -- slash-command` | Revertir `src/modules/editor/ui/tiptap/*` |
| 4 | Autosave conectado end-to-end + reconciliación de conflicto + flujo Playwright de aceptación | PR4 | `pnpm test -- use-autosave` | `pnpm test:e2e -- notebooks-acceptance` | Revertir el cableado de `use-autosave` en la vista de página |
| 5a | Bloques restantes: tabla, callouts, paleta de resaltado | PR5a | `pnpm test -- editor/ui/tiptap` | `pnpm test:e2e -- notebooks-acceptance -g "tabla"` | Revertir extensiones nuevas de Tiptap |
| 5b | Tema de resaltado de sintaxis (`lowlight`) + estilos finales del sistema de diseño en el editor | PR5b | `pnpm test -- code-block` | `pnpm dev` inspección visual | Revertir `code-block-lowlight` y estilos asociados |
| 6 | Pipeline de imágenes: bucket, RLS, `RequestImageUpload`/`RegisterPageAsset`/`GetAssetReadUrl`, bloque de imagen, `next.config`/CSP | PR6 | `pnpm test -- page-asset` | `pnpm test:e2e -- image-upload` | Revertir `src/modules/notebooks/**/page-asset*`, `drizzle/0004_*`, bloque de imagen del editor |
| 7 | Diagramas de archify, TSDoc, reconciliación de deltas de specs (repartido en los PR anteriores cuando el presupuesto de cada uno lo permite) | absorbido | `pnpm depcruise` | N/A — documentación | Revertir el archivo de diagrama afectado |
| 8a | Follow-ups de cierre: nonces de CSP, matcher del proxy, redirect de apex | PR8a | `pnpm test -- proxy` | `pnpm test:e2e -- shell-empty-state` (smoke de headers) | Revertir `src/proxy.ts`, `security-headers.ts` |
| 8b | Follow-ups de cierre: `userId` en sign-in, evento `user_signed_in`, `signOutAction`, `EnsureProfile` resiliente, upsert de `profiles` | PR8b | `pnpm test -- identity` | `pnpm test:e2e -- auth` | Revertir `src/modules/identity/{domain,infrastructure,index.ts,actions.ts}`, `src/app/auth/callback/route.ts` |

Los slices 3 y 5 se dividieron en dos PR cada uno (3a/3b, 5a/5b) siguiendo el riesgo señalado en `proposal.md`. El slice 7 no forma su propio PR: cada diagrama/TSDoc se entrega junto con el PR del slice que produce el artefacto correspondiente para no crear un PR de solo documentación fuera de presupuesto.

## Phase 0: Trabajo previo — migrate-in-build y FK de `profiles` (PR0)

Traceability: `specs/observability-and-delivery/spec.md` → "Pipeline en `main` con migraciones antes del deploy"; `specs/identity-auth/spec.md` → "Tabla `profiles` con creación automática" (columna `id` con FK).

- [x] 0.1 Crear `drizzle/0002_profiles_auth_fk.sql` (bloque de guarda `-- guard:start`/`-- guard:end` que falla cerrado si `auth.users` está vacía y `profiles` tiene filas, luego borra las filas huérfanas de `profiles` sin `auth.users` correspondiente, luego agrega la FK) y su reversión `0002_profiles_auth_fk.down.sql` con el SQL exacto de `design.md` (`delete from profiles ... where not exists (...)` + `alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade` / `drop constraint`, sin restaurar las filas borradas).
- [x] 0.2 RED `tests/db/profiles-fk.smoke.test.ts` (vía `pnpm test:db`): insertar en `profiles` un `id` inexistente en `auth.users` y esperar rechazo por violación de FK (Scenario "Fila huérfana rechazada por la clave foránea", `specs/identity-auth/spec.md`).
- [x] 0.2b RED `tests/db/orphan-guard.smoke.test.ts` (vía `pnpm test:db`): extraer el bloque de guarda de `0002_profiles_auth_fk.sql` y ejecutarlo en una transacción con `auth.users` vacía y una fila huérfana en `profiles`, esperar rechazo con código Postgres `P0001` (Scenario "Migración rechaza borrar perfiles cuando auth.users está vacío (db smoke)", `specs/identity-auth/spec.md`).
- [x] 0.3 Aplicar la migración en `cogni-dev` con `pnpm db:migrate` y correr `0.2` en verde; verificar la reversión (`drizzle-kit` down) y volver a aplicar antes de continuar.
- [x] 0.4 Modificar `package.json`: `"build": "node scripts/migrate-in-build.mjs && next build"`, donde `scripts/migrate-in-build.mjs` solo corre `drizzle-kit migrate` cuando `VERCEL_ENV === "production"` (o `RUN_DB_MIGRATIONS=1`), para que un build de Preview de cualquier rama nunca migre.
- [x] 0.5 Modificar `.github/workflows/main.yml`: eliminar el job `migrate` (líneas 58-72 actuales) que corre después de `e2e` con `secrets.PROD_DATABASE_URL`; los jobs `verify` y `e2e` quedan intactos.
- [ ] 0.6 `(usuario)` En el dashboard de Vercel, proyecto de Cogni: Settings → Environment Variables, confirmar que `DATABASE_URL` existe con alcance de **Production** y **Preview** y está disponible en tiempo de build (no solo runtime); la de **Preview** MUST apuntar al pooler de `cogni-dev`, nunca a `cogni-prod` (el guard de `VERCEL_ENV` evita que Preview migre, pero no protege contra apuntar a la base equivocada), y la de **Production** apunta a `cogni-prod`. Si el proyecto usa "Sensitive"/"Encrypted" para `DATABASE_URL`, marcarla igualmente disponible para "Build & Runtime" en ambos entornos. Además, en GitHub → Settings → Branches, crear/confirmar una regla de protección sobre `main` que exija los status checks `PR / verify` (y `PR / e2e` si el pipeline lo agrega) antes de permitir el merge.
- [ ] 0.7 Mitad local verificada: `DATABASE_URL` inválida hace fallar `pnpm build` en `drizzle-kit migrate` antes de "Compiling..." (visto: falla en la fase de `applying migrations`, exit 1, sin llegar a Next.js); `pnpm build` normal contra `cogni-dev` pasa completo (migración ya aplicada, exit 0, "Compiled successfully"). Mitad Vercel `(usuario)` pendiente: verificar en un deploy de preview de esta rama que el log de build muestra la salida de `drizzle-kit migrate` antes de "Compiling...", cumpliendo el Scenario "Build de Vercel aplica migraciones" y "Migración fallida bloquea el build".
- [x] 0.8 Gate PR0: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` en verde (ver `apply-progress.md`). Preview de Vercel y commit de trabajo quedan a cargo del orquestador/usuario.

## Phase 1: Schema y dominio/aplicación de `notebooks` (PR1)

Traceability: `specs/notebooks/spec.md` → "Jerarquía estricta de dos niveles", "Modelo de datos según §6.1", "Ciclo de vida del cuaderno", "Ciclo de vida de la página", "Orden de creación con `position` solo agregando al final", "Autorización por propiedad", "Archivado lógico sin restauración", "Guardado de contenido con comparar-e-intercambiar de `content_version`", "Materialización de `plain_text` en el servidor", "Dobles en memoria para pruebas".

- [x] 1.1 Modificar `src/shared/db/schema.ts`: agregar `notebooks`, `pages`, `page_assets` exactamente como en `design.md` (tipos, índices, `unique` de `storage_path`, `.enableRLS()` sin políticas, igual que `profiles`).
- [x] 1.2 `pnpm db:generate` para producir `drizzle/0003_notebooks_pages_assets.sql` (+ reversión); revisar el SQL generado contra la tabla de `design.md` antes de commitear.
- [x] 1.3 RED `tests/db/notebooks-schema.smoke.test.ts`: aplicar la migración y verificar las tres tablas, columnas y `pages.content_version` default `1` (Scenario "Migración aplicada"); aplicar la reversión y verificar que las tres tablas desaparecen sin tocar el esquema de la fase 0 (Scenario "Migración revertida").
- [x] 1.4 RED `src/modules/notebooks/domain/notebook.test.ts` → implementar `src/modules/notebooks/domain/notebook.ts`: invariantes de `title` (no vacío tras trim, máx. 120 caracteres), `icon` opcional de un emoji, `color` restringido a la paleta pastel (`pink`,`green`,`yellow`,`purple`,`orange`,`blue`,`mint`) (Scenarios "Creación con título válido", "Título vacío rechazado", "Color fuera de la paleta rechazado").
- [x] 1.5 RED `src/modules/notebooks/domain/page.test.ts` → implementar `src/modules/notebooks/domain/page.ts`: invariantes de `title` compartidas con `Notebook`, valores iniciales de página nueva (`title` "Sin título", `content` doc vacío, `plain_text` vacío, `content_version` 1) (Scenario "Página nueva con valores iniciales").
- [x] 1.6 RED `src/modules/notebooks/domain/errors.test.ts` → implementar `src/modules/notebooks/domain/errors.ts` con los códigos `NOTEBOOK_ERROR`, `PAGE_ERROR`, `ASSET_ERROR` de `design.md`.
- [x] 1.7 RED `src/modules/notebooks/domain/plain-text.test.ts` (cobertura 100%, tabla de nodos de `design.md`) → implementar `src/modules/notebooks/domain/plain-text.ts` (`extractPlainText`, tipos locales `TiptapDoc`/`TiptapNode`, sin imports de `@tiptap/*` ni `prosemirror-*`). Cubrir: texto simple, bloques con salto de línea entre hermanos, `hardBreak`, celdas de tabla con tabulador y filas con salto de línea, imágenes/divisores sin aporte, nodo desconocido que desciende sin lanzar, documento vacío → cadena vacía (Scenarios "Documento con varios bloques", "Imágenes y divisores sin aporte", "Nodo desconocido").
- [x] 1.8 Crear puertos en `src/modules/notebooks/domain/{notebook-repository,page-repository,page-asset-repository,storage-gateway,save-page-port}.ts` (interfaces estructurales, sin dependencias externas salvo `shared/kernel`); `PageRepository` agrega `updateIfVersion(input): Promise<{ updated: true; version: number } | { updated: false; currentVersion: number }>` como `UPDATE` condicional atómico, no lectura-comparación-escritura.
- [x] 1.9 Crear `src/modules/notebooks/application/testing/{in-memory-notebook-repository,in-memory-page-repository,in-memory-page-asset-repository,fake-storage-gateway}.ts` (Scenario "Suite unitaria sin conexión"); `in-memory-page-repository.ts` implementa `updateIfVersion` con la misma semántica condicional. Crear `application/testing/page-repository.contract.ts`: test de contrato compartido que se ejecuta contra el doble en memoria (fase 1) y contra `DrizzlePageRepository` (fase 2).
- [x] 1.10 RED `application/create-notebook.test.ts`, `rename-notebook.test.ts`, `set-notebook-appearance.test.ts`, `archive-notebook.test.ts` (con `InMemoryNotebookRepository`) → implementar los cuatro casos de uso con `Result<T, DomainError>` y `createId()` para el `id` (Scenarios de ciclo de vida del cuaderno, incluido "Cuaderno archivado desaparece con sus páginas", "Archivado repetido").
- [x] 1.11 RED `application/create-page.test.ts`, `rename-page.test.ts`, `archive-page.test.ts` → implementar los tres casos de uso, incluida la validación "cuaderno activo" (Scenario "Página en cuaderno archivado rechazada").
- [x] 1.12 RED `application/save-page.test.ts` → implementar `SavePage` según el pseudocódigo de `design.md`: valida con Zod (rechaza `plain_text` del cliente), recalcula `plain_text` con `extractPlainText` y escribe vía `deps.pages.updateIfVersion(...)`; cero filas actualizadas MUST mapear a `DomainError(PAGE_VERSION_CONFLICT)` con la versión releída, nunca lectura-comparación-escritura incondicional (Scenarios "Guardado con versión vigente", "Guardado obsoleto rechazado", "`plain_text` enviado por el cliente ignorado", "Contenido que no es un documento Tiptap").
- [x] 1.13 RED `application/get-page.test.ts` → implementar `GetPage` (ownership check, `archived_at` como no encontrado) (Scenario "Página ajena").
- [x] 1.14 RED `application/list-sidebar.test.ts` → implementar `ListSidebar`: cuadernos activos del owner en orden de `position` con sus páginas activas en orden de `position`, sin `content` ni `plain_text` (Scenario "Árbol del owner").
- [x] 1.15 RED test de `position` estrictamente creciente incluyendo hermanos archivados, para cuadernos y páginas (puede vivir en los tests de `create-notebook`/`create-page` de 1.10/1.11) (Scenarios "Posiciones crecientes", "Listado en orden de creación").
- [x] 1.16 RED test de autorización cruzada para `GetPage`, `RenamePage`, `ArchivePage`, `SavePage` con `ownerId` ajeno (puede consolidarse en un archivo `application/authorization.test.ts` que reutiliza los casos de uso ya implementados) (Scenario "Página ajena").
- [x] 1.17 Gate PR1: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm depcruise` en verde; sin UI ni Server Actions todavía. Commit de trabajo (`feat(notebooks): add domain and application layer with in-memory doubles`).

## Phase 2: Infraestructura, Server Actions, sidebar y rutas (PR2)

Traceability: `specs/notebooks/spec.md` → "Rutas de cuaderno y página", "Puntos de entrada mediante Server Actions validadas"; `specs/design-tokens-and-shell/spec.md` → "Sidebar con árbol de cuadernos y páginas", "shadcn/ui inicializado sobre los tokens de Cogni" (primitivos requeridos por el sidebar); `specs/project-tooling/spec.md` → "`notebooks` y `editor` con código real" (parcial, columna `notebooks`).

- [x] 2.1 Crear `src/modules/notebooks/infrastructure/drizzle-notebook-repository.ts`, `drizzle-page-repository.ts`, `drizzle-page-asset-repository.ts` implementando los puertos de 1.8 contra `src/shared/db/schema.ts`; `drizzle-page-repository.ts` implementa `updateIfVersion` como el `UPDATE` condicional de `design.md` y pasa el test de contrato de 1.9 (`page-repository.contract.ts`).
- [x] 2.2 RED `tests/db/notebooks-repository.smoke.test.ts` (vía `pnpm test:db` contra `cogni-dev`): crear, leer, archivar un cuaderno y una página vía los repositorios Drizzle; verificar aislamiento por `owner_id`.
- [x] 2.2b RED DB smoke `tests/db/save-page-race.test.ts`: dos escritores concurrentes con el mismo `expectedVersion` → exactamente uno actualiza (Scenario "Dos escrituras concurrentes con la misma versión" de `specs/notebooks/spec.md`).
- [x] 2.3 `pnpm dlx shadcn@latest init` (sin `--defaults`) reutilizando las variables CSS existentes; agregar primitivos `command`, `popover`, `dropdown-menu`, `dialog`, `separator`, `tooltip` a `src/shared/ui/`; reconciliar `button.tsx` si su API difiere de shadcn (Scenarios "`components.json` reconciliado", "Primitivo nuevo sin valores literales", "Botón primario casi negro").
- [x] 2.4 Crear `src/modules/notebooks/actions.ts`: Server Actions `createNotebook`, `renameNotebook`, `setNotebookAppearance`, `archiveNotebook`, `createPage`, `renamePage`, `archivePage`, `getCurrentContent` — cada una exige sesión, valida con Zod, llama al caso de uso con el `ownerId` de la sesión, mensajes de error en español "tú" (Scenarios "Server Action sin sesión", "Entrada inválida en Server Action").
- [x] 2.5 RED tests unitarios de `actions.ts` (mockeando la sesión) para los dos escenarios de 2.4.
- [x] 2.6 Modificar `src/modules/notebooks/index.ts`: exportar las Server Actions de 2.4 y (para el slice 3) el puerto `SavePagePort`, más los tipos públicos (`Notebook`, `Page`, `SidebarTree`).
- [x] 2.7 Crear `src/modules/notebooks/ui/{sidebar-tree,sidebar-tree-client,notebook-item,page-item,create-notebook-dialog,archive-confirm-dialog}.tsx`: `sidebar-tree.tsx` como Server Component que llama `ListSidebar` vía `notebooks/index.ts`; `sidebar-tree-client.tsx` hidrata con TanStack Query (`initialData`), mutaciones optimistas con `onError` que revierte para crear/renombrar/ícono-color/archivar.
- [x] 2.8 Modificar `src/app/(app)/_components/sidebar.tsx` y `layout.tsx`: reemplazar el enlace único "Inicio" por `sidebar-tree.tsx`, colapso 240px/64px persistido (ya existente en Fase 0, verificar que sigue funcionando con el árbol).
- [x] 2.9 Crear `src/app/(app)/notebooks/[notebookId]/page.tsx`: vista de cuaderno, lista páginas activas, botón para crear página; identificador ajeno o archivado → `notFound()`.
- [x] 2.10 Crear `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`: carga `title`, `content`, `content_version` vía `GetPage`; identificador ajeno o archivado → `notFound()`; deja un punto de montaje para el `Editor` (se conecta en el slice 3 con la Server Action real como prop).
- [x] 2.11 RED reescritura de `tests/e2e/shell-empty-state.spec.ts`: para un owner sin cuadernos, valida el mensaje "Aún no tienes cuadernos. Crea uno para empezar." y el control para crear el primero, sin asumir el shell vacío de la Fase 0 (Scenario "Reescritura de `shell-empty-state.spec.ts`") → implementar hasta que pase.
- [x] 2.12 Crear `tests/e2e/notebooks-acceptance.spec.ts` (esqueleto inicial): crear cuaderno → crear página → renombrar → cambiar ícono/color → archivar → verificar desaparición del sidebar y ruta como no encontrada (Scenarios "Renombrar y cambiar ícono desde el sidebar", "Crear y abrir una página", "Archivar desde el sidebar", "Ruta de página ajena" con una segunda sesión de prueba).
- [x] 2.13 Gate PR2: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- shell-empty-state notebooks-acceptance` en verde contra preview. Commit de trabajo (`feat(notebooks): wire Drizzle repositories, sidebar and notebook/page routes`).

## Phase 3a: Editor — dominio y aplicación sin Tiptap (PR3a)

Traceability: `specs/editor/spec.md` → "Puerto de guardado como única dependencia hacia `notebooks`"; `specs/project-tooling/spec.md` → "Reglas de dependencia verificadas" (regla 7, Tiptap solo en `editor/ui`).

- [x] 3a.1 Modificar `.dependency-cruiser.cjs`: agregar la regla `editor-tiptap-only-in-ui` exactamente como en `design.md` (`from: path ^src/modules/editor/(?!ui/), pathNot .test.ts$` → `to: node_modules/(@tiptap|prosemirror-)`).
- [x] 3a.2 RED test de arquitectura: un archivo temporal en `editor/domain` que importa `@tiptap/core` hace fallar `pnpm depcruise` nombrando `editor-tiptap-only-in-ui`; retirar el archivo temporal tras confirmar el fallo (Scenario "Import de Tiptap fuera de `ui`", `specs/editor/spec.md`; "Tiptap importado fuera de `editor/ui`", `specs/project-tooling/spec.md`).
- [x] 3a.3 Crear `src/modules/editor/domain/save-page-port.ts`: reexporta o redeclara la forma de `SavePagePort`/`TiptapDoc`/`TiptapNode` de `notebooks/domain/save-page-port.ts` importada únicamente desde `@/modules/notebooks` (el `index.ts` público, no la ruta interna).
- [x] 3a.4 Crear `src/modules/editor/domain/autosave-state.ts`: tipos puros del estado de autosave (`idle`, `pending`, `saving`, `saved`, `error`, `conflict`), sin Tiptap.
- [x] 3a.5 Crear `src/modules/editor/application/testing/fake-save-page-port.ts`: doble en memoria de `SavePagePort` con control de latencia/fallo/conflicto inyectable para tests.
- [x] 3a.6 RED `src/modules/editor/application/use-autosave.test.ts` → implementar `src/modules/editor/application/use-autosave.ts`: debounce 800-1500ms, un guardado por pausa (Scenario "Guardado tras pausa"), reintento tras guardado en curso con contenido más reciente (Scenario "Escritura durante el guardado"), estado de error y reintento en la siguiente pausa ante fallo de red/servidor conservando el contenido (Scenario "Fallo de red"), reconciliación de conflicto: recarga contenido/version del servidor, expone el borrador local, siguiente guardado usa la versión vigente (Scenarios "Conflicto detectado", "Guardado tras reconciliar", requirement "Reconciliación del conflicto de versión").
- [x] 3a.7 Modificar `src/modules/editor/index.ts`: exporta (por ahora) solo los tipos de `autosave-state.ts` y el hook `use-autosave`; el componente `Editor` se agrega en 3b.
- [x] 3a.8 Gate PR3a: `pnpm test -- editor`, `pnpm typecheck`, `pnpm depcruise` en verde (incluida la regla nueva). Commit de trabajo (`feat(editor): add framework-agnostic domain, autosave hook and dependency-cruiser rule`).

## Phase 3b: Editor — Tiptap base, bloques principales y menú "/" (PR3b)

Traceability: `specs/editor/spec.md` → "Conjunto completo de bloques de §3.2" (parcial: encabezados, párrafo, listas, tarea, cita, código, divisor), "Marcas de texto", "Menú de comandos "/"", "Apariencia y copy del editor" (parcial).

- [x] 3b.1 Crear `src/modules/editor/ui/tiptap/editor.tsx`: instancia de Tiptap (`@tiptap/react`, `@tiptap/starter-kit`) que recibe `content` inicial, `contentVersion` y un `SavePagePort` por prop; llama `useAutosave` internamente.
- [x] 3b.2 Crear `src/modules/editor/ui/tiptap/extensions/` con `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-link` (validación de esquema `http`/`https`/`mailto`, `rel="noopener noreferrer"`, apertura en pestaña nueva) y las marcas de `starter-kit` (negrita, cursiva, subrayado, tachado, código en línea) con atajos `Mod+B`/`Mod+I`/`Mod+U`/`Mod+Shift+S`/`Mod+E`.
- [x] 3b.3 RED test de componente `link.test.tsx`: intento de enlace con `javascript:alert(1)` se rechaza y el texto queda sin marca (Scenario "Enlace con esquema no permitido") → implementar el validador de esquema.
- [x] 3b.4 RED test de componente `marks.test.tsx`: `Mod+B` sobre texto seleccionado aplica negrita y así se serializa (Scenario "Marca por atajo") → confirmar configuración de atajos de `starter-kit`.
- [x] 3b.5 RED test de componente `task-list.test.tsx`: un ítem de lista de tareas marcado conserva su estado en el JSON serializado (Scenario "Casilla de tarea persistida") → configurar `TaskItem` con atributo `checked` persistente.
- [x] 3b.6 Crear `src/modules/editor/ui/command-menu.tsx`: menú "/" con shadcn `command`, etiquetas en español, filtrado, navegación por flechas, `Enter` inserta y reemplaza el texto del comando, `Escape` cierra sin cambios; en esta fase incluye solo los bloques ya disponibles (encabezados, párrafo, listas, tarea, cita, código, divisor).
- [x] 3b.7 RED test de componente `command-menu.test.tsx`: filtro sin resultados muestra mensaje y `Enter` no inserta nada (Scenario "Filtro sin resultados"); `Escape` cierra el menú y conserva el carácter "/" (Scenario "Cierre con Escape") → implementar hasta que pasen.
- [x] 3b.8 Modificar `src/modules/editor/index.ts`: exporta el componente público `Editor`.
- [x] 3b.9 Modificar `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`: importa la Server Action real `saveContent`/`getCurrentContent` de `notebooks/index.ts` (agregar `saveContent` como alias de Server Action sobre `SavePage` si no se creó en el slice 2) y la pasa como prop al `Editor`.
- [x] 3b.10 RED test unitario de guardado explícito `save-content.test.ts` en `notebooks/application` o `actions.ts` si `saveContent` no quedó cubierto en el slice 1/2.
- [x] 3b.11 Crear `tests/e2e/slash-command.spec.ts`: escribir "/tabla" (o un bloque ya disponible en este slice, p. ej. "/cita") y `Enter` inserta el bloque y el texto del comando desaparece (Scenario "Inserción por comando"; la variante de tabla se completa en el slice 5 cuando la extensión de tabla exista, se puede empezar con un bloque ya disponible aquí y extender en 5a).
- [x] 3b.12 Gate PR3b: `pnpm test -- editor`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- slash-command` en verde. Commit de trabajo (`feat(editor): add Tiptap core blocks, marks and slash command menu`).

## Phase 4: Autosave conectado, conflicto de versión y aceptación (PR4)

Traceability: `specs/editor/spec.md` → "Autosave con debounce y actualización optimista", "Reconciliación del conflicto de versión"; `specs/notebooks/spec.md` → "Guardado de contenido con comparar-e-intercambiar de `content_version`" (verificación end-to-end); Success Criteria de `proposal.md` (criterio de §13, guardado obsoleto rechazado).

- [ ] 4.1 Verificar/ajustar el cableado de 3b.9: `use-autosave` recibe la Server Action real (`saveContent`) como implementación de `SavePagePort`; confirmar que el estado visual ("Guardando…"/"Guardado"/error) se refleja en la UI vía `src/modules/editor/ui/save-status.tsx` (crear si no existe).
- [ ] 4.2 Crear `src/modules/editor/ui/conflict-banner.tsx`: banner que informa en español que la página cambió en otra pestaña, expone el borrador local descartado con opción de recuperarlo o descartarlo definitivamente.
- [ ] 4.3 RED test de componente `conflict-banner.test.tsx`: al recibir un conflicto desde `use-autosave`, el banner aparece, el documento de Tiptap se reemplaza por el del servidor y el borrador local queda accesible (integra el Scenario "Conflicto detectado" a nivel de componente, no solo de hook).
- [ ] 4.4 Modificar `src/modules/editor/ui/tiptap/editor.tsx`: al salir de la página con cambios pendientes, intentar guardar (usar `beforeunload`/`visibilitychange` según lo que permita Next.js 16 — leer `node_modules/next/dist/docs/` para el patrón recomendado en Server/Client Components) (Requirement "Autosave con debounce...": "Al salir de la página con cambios pendientes el editor MUST intentar guardarlos").
- [ ] 4.5 Crear `tests/e2e/notebooks-acceptance.spec.ts` (completar el esqueleto de 2.12): flujo completo de §13 — crear cuaderno → página → escribir en cada familia de bloques disponible hasta este slice → esperar "Guardado" → recargar → verificar persistencia (Scenario "Persistencia al volver"); agregar un caso de guardado obsoleto simulando dos pestañas (dos `BrowserContext` de Playwright) que confirme el Scenario "Conflicto detectado" en punta a punta.
- [ ] 4.6 Gate PR4: `pnpm test -- editor`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- notebooks-acceptance` en verde contra preview. Commit de trabajo (`feat(editor): wire autosave end-to-end with version-conflict reconciliation`).

## Phase 5a: Bloques restantes — tabla, callouts, paleta de resaltado (PR5a)

Traceability: `specs/editor/spec.md` → "Conjunto completo de bloques de §3.2" (tabla, callouts), "Paleta de resaltado de Cogni y callouts".

- [ ] 5a.1 Crear `src/modules/editor/ui/tiptap/extensions/table.ts` con `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`; agregar al `editor.tsx` y al `command-menu.tsx`.
- [ ] 5a.2 RED test de componente `table.test.tsx`: insertar tabla, agregar fila y columna, escribir en una celda, verificar persistencia de dimensiones y texto tras serializar (Scenario "Tabla editable", validar con Testing Library el estado serializado, no solo el DOM).
- [ ] 5a.3 Actualizar `tests/e2e/slash-command.spec.ts`: agregar el caso "/tabla" completo ahora que la extensión existe.
- [ ] 5a.4 Crear `src/modules/editor/ui/tiptap/highlight-palette.tsx`: extiende `@tiptap/extension-highlight` para almacenar el nombre de color de la paleta (`pink`,`green`,`yellow`,`purple`,`orange`,`blue`,`mint`) en vez de hex; renderiza con los tokens `-fg` del sistema de diseño.
- [ ] 5a.5 RED test de componente `highlight.test.tsx`: elegir resaltado `purple` produce `{ color: "purple" }` en el JSON, sin hex, y el render usa el token `purple`/`purple-fg` (Scenario "Resaltado por nombre").
- [ ] 5a.6 Crear `src/modules/editor/ui/tiptap/callout-node.tsx`: nodo de callout con tipos `idea`/`note`/`warning` mapeados a `yellow`/`blue`/`orange`, ícono de Lucide por tipo, sin códigos hex en línea.
- [ ] 5a.7 RED test de componente `callout.test.tsx`: callout `warning` usa los tokens del color `orange` y su ícono de Lucide (Scenario "Callout de advertencia").
- [ ] 5a.8 Actualizar `command-menu.tsx`: agregar entradas para tabla y los tres callouts.
- [ ] 5a.9 Gate PR5a: `pnpm test -- editor`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- slash-command` en verde. Commit de trabajo (`feat(editor): add table, callouts and Cogni highlight palette`).

## Phase 5b: Resaltado de sintaxis y estilos finales (PR5b)

Traceability: `specs/editor/spec.md` → "Conjunto completo de bloques de §3.2" (bloque de código con resaltado y selector de lenguaje), "Apariencia y copy del editor".

Open Question resuelta: se usa `lowlight` (no `shiki`) porque `design.md` ya fija `@tiptap/extension-code-block-lowlight` como la extensión de bloque de código; `lowlight` es su integración soportada oficialmente y evita cargar un segundo motor de resaltado (`shiki`) solo para el selector de lenguaje que ya cubre `lowlight` + `highlight.js`.

- [ ] 5b.1 Agregar dependencias `@tiptap/extension-code-block-lowlight`, `lowlight` (y el subconjunto de lenguajes de `highlight.js` necesario: al menos JS/TS, Python, HTML, CSS, JSON, bash) a `package.json`.
- [ ] 5b.2 Crear `src/modules/editor/ui/tiptap/extensions/code-block.ts`: configura `CodeBlockLowlight` con el registro de lenguajes de 5b.1 y un selector de lenguaje en la UI del bloque.
- [ ] 5b.3 RED test de componente `code-block.test.tsx`: bloque de código con lenguaje `typescript` renderiza con resaltado y persiste el atributo de lenguaje (Scenario "Bloque de código con lenguaje").
- [ ] 5b.4 Aplicar el tema de resaltado de sintaxis con los tokens de `docs/design-system/colors_and_type.css` (JetBrains Mono ya vigente desde la Fase 0), sin introducir un tema de terceros con colores propios.
- [ ] 5b.5 RED test `no-inline-hex.test.tsx` sobre `src/modules/editor/ui/**`: inspecciona clases/estilos de los componentes del editor y falla si encuentra un código hexadecimal en línea (Scenario "Ausencia de valores literales").
- [ ] 5b.6 Revisión manual de copy: todo texto visible del editor y el menú "/" en español "tú", oración con minúscula inicial, sin emoji, foco visible y respeto de `prefers-reduced-motion` (Scenario "Revisión de textos del editor", e2e manual o Playwright con `prefers-reduced-motion: reduce` emulado).
- [ ] 5b.7 Gate PR5b: `pnpm test -- editor`, `pnpm typecheck`, `pnpm depcruise` en verde. Commit de trabajo (`feat(editor): add syntax-highlighted code blocks and finish design-system pass`).

## Phase 6: Pipeline de imágenes (PR6)

Traceability: `specs/page-assets/spec.md` (todos los Requirements); `specs/editor/spec.md` → "Flujo de inserción de imagen"; `specs/observability-and-delivery/spec.md` → "`img-src` habilitado para Supabase Storage".

- [ ] 6.1 Modificar `src/shared/config/env.schema.ts`: agregar `SUPABASE_STORAGE_BUCKET: z.string().min(1)` en `serverSchema` (nombre de variable confirmado: `SUPABASE_STORAGE_BUCKET`, ya usado de forma consistente en `design.md` y `specs/page-assets/spec.md`).
- [ ] 6.2 `(usuario)` En el dashboard de Supabase del proyecto `cogni-dev`: Storage → New bucket → nombre `page-assets`, **Public bucket = OFF** (privado); en "Additional configuration" activar "Restrict file upload size for bucket" = 10 MB y "Restrict file types" = `image/jpeg, image/png, image/webp, image/gif`. Repetir exactamente igual en el proyecto `cogni-prod`. La fuente de verdad es la migración SQL de 6.3 (`update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'] where id = 'page-assets'`); estos pasos de dashboard son verificación visual, no la única vía.
- [ ] 6.3 Crear `drizzle/0004_page_assets_storage_policies.sql` (+ reversión) con las dos políticas RLS de `design.md` (`page-assets read own`, `page-assets write own`) sobre `storage.objects`, más el `update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array[...]` de 6.2; usar SQL versionado generado a mano (Drizzle no introspecta `storage.objects`, igual que `auth.users`) y aplicarlo con `pnpm db:migrate` igual que las demás migraciones — se elige la migración Drizzle-versionada, no el pegado manual en el dashboard, porque mantiene una sola fuente de verdad versionada y reproducible entre `cogni-dev` y `cogni-prod`, y `drizzle-kit migrate` ya soporta SQL crudo sin necesitar introspección previa del schema `storage`.
- [ ] 6.4 `(usuario)` En `.env.local`, agregar `SUPABASE_STORAGE_BUCKET=page-assets`. En el dashboard de Vercel, agregar la misma variable con el mismo valor para **Production** y **Preview**.
- [ ] 6.5 Crear `src/modules/notebooks/domain/page-asset.ts`: `ALLOWED_MIME`, `MAX_ASSET_BYTES` (10 MB) y `validateAssetInput` exactamente como en `design.md`.
- [ ] 6.6 RED `src/modules/notebooks/domain/page-asset.test.ts` → implementar 6.5 (MIME no permitido, tamaño excedido, entrada válida) (Scenarios "MIME no permitido", "Tamaño excedido" de `specs/page-assets/spec.md`).
- [ ] 6.7 Crear `src/modules/notebooks/infrastructure/supabase-storage-gateway.ts`: implementa `StorageGateway` (puerto de 1.8) con `createSignedUploadUrl`, `createSignedUrl` y `getObjectMetadata(path) → { sizeBytes, mime } | null` de `supabase-js` contra el bucket de `SUPABASE_STORAGE_BUCKET`.
- [ ] 6.8 RED `application/request-image-upload.test.ts` (con `FakeStorageGateway`) → implementar `RequestImageUpload`: valida página activa/propia, `validateAssetInput`, emite permiso con vigencia ≤10 min hacia `{ownerId}/{pageId}/{assetId}.{ext}` (Scenarios "Permiso emitido", "MIME no permitido", "Tamaño excedido", "Página ajena o archivada").
- [ ] 6.9 RED `application/register-page-asset.test.ts` → implementar `RegisterPageAsset`: revalida ownership, valida que `storagePath` empieza con `{ownerId}/{pageId}/`, lee metadatos reales del objeto vía `getObjectMetadata` y rechaza sin persistir si no existe/excede límites/MIME no permitido, persiste `mime`/`size_bytes` del objeto real, upsert idempotente por `storage_path` (Scenarios "Registro exitoso", "Objeto real fuera de política", "Ruta fuera del prefijo del owner", "Registro repetido").
- [ ] 6.10 RED `application/get-asset-read-url.test.ts` → implementar `GetAssetReadUrl`: URL firmada ≤1h solo para assets propios (Scenarios "URL emitida para asset propio", "Asset ajeno").
- [ ] 6.11 RED test de esquema Zod `page-asset-actions.test.ts`: las Server Actions de subida y registro solo aceptan `pageId`/`mime`/`sizeBytes`/`storagePath`, nunca datos binarios (Scenario "Server Actions solo con metadatos") → agregar `requestImageUpload`, `registerPageAsset`, `getAssetReadUrl` a `src/modules/notebooks/actions.ts` y exportarlas desde `index.ts`.
- [ ] 6.12 Modificar `next.config.ts`: `images.remotePatterns` hacia el host de `NEXT_PUBLIC_SUPABASE_URL`, pathname "/storage/v1/object/sign/**".
- [ ] 6.13 Modificar `src/shared/config/security-headers.ts`: agregar el host de Supabase Storage a `img-src` (junto a `'self' blob: data: https://*.googleusercontent.com` ya existentes).
- [ ] 6.14 Crear `src/modules/editor/ui/tiptap/image-node.tsx`: nodo de imagen propio que persiste `{ assetId }` (nunca una URL), valida MIME/tamaño en cliente antes de pedir el permiso (mensaje en español sin enviar bytes si falla), llama `requestImageUpload` → `supabase.storage.from(bucket).uploadToSignedUrl` → `registerPageAsset`; resuelve la URL de lectura con `getAssetReadUrl` al montar el nodo (Scenarios "Archivo demasiado grande", "Nodo sin URL firmada").
- [ ] 6.15 Crear `src/modules/editor/ui/upload-progress.tsx`: marcador de progreso durante la subida.
- [ ] 6.16 RED test de componente `image-node.test.tsx`: archivo de 12 MB muestra mensaje de límite y no solicita permiso de subida (Scenario "Archivo demasiado grande"); el documento serializado nunca contiene una URL con firma o fecha de expiración (Scenario "Nodo sin URL firmada").
- [ ] 6.17 Agregar el bloque de imagen al `command-menu.tsx` y soporte de arrastrar-y-soltar sobre el editor.
- [ ] 6.18 Modificar `application/archive-page.ts` (o agregar test dedicado): archivar una página MUST NOT borrar sus `page_assets` ni objetos de Storage (Scenario "Página archivada conserva assets") — verificar con test unitario que el repositorio de assets no se toca al archivar.
- [ ] 6.19 Crear `tests/e2e/image-upload.spec.ts`: subir una imagen PNG de 2 MB, verificar que se muestra, persiste y se vuelve a mostrar tras recargar (Scenario "Subida y renderizado"); agregar un caso negativo con dos usuarios donde el segundo no puede leer el asset del primero (Scenario "Lectura entre usuarios denegada") y un caso de acceso anónimo denegado (Scenario "Acceso anónimo denegado").
- [ ] 6.19b RED `tests/e2e/image-upload.spec.ts` caso negativo: subida de 11 MB con permiso válido → Storage rechaza (Scenario "Subida que excede el límite del bucket rechazada").
- [ ] 6.20 Gate PR6: `pnpm test -- page-asset image-node`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- image-upload` en verde contra preview con el bucket ya creado en `cogni-dev`. Commit de trabajo (`feat(page-assets): add signed-upload image pipeline with owner-scoped RLS`).

## Phase 7: Documentación — diagramas archify, TSDoc, reconciliación de specs

Estos ítems se agregan al PR del slice correspondiente cuando el presupuesto de líneas de ese PR lo permite; si un PR ya está en el límite, se agrupan en un PR de documentación adicional dentro del mismo rango de ~150 líneas.

- [ ] 7.1 Crear las cuatro fuentes de archify en `docs/diagramas/`: `fase-1-arquitectura-modulos.architecture.json`, `fase-1-guardado-pagina.sequence.json`, `fase-1-subida-imagen.sequence.json`, `fase-1-ciclo-pagina.lifecycle.json`, con el contenido descrito en la tabla "Diagramas" de `design.md`.
- [ ] 7.2 Ejecutar `validate`/`deliver` de archify sobre las cuatro fuentes para generar su `.html` junto a cada JSON.
- [ ] 7.3 Agregar TSDoc a los puertos (`SavePagePort`, `NotebookRepository`, `PageRepository`, `PageAssetRepository`, `StorageGateway`) y a los 13 casos de uso de `notebooks/application`, documentando entrada, salida y el `DomainError` que puede producir cada uno.
- [ ] 7.4 Verificar que `openspec/changes/phase-1-notebooks-editor/specs/*/spec.md` (las siete deltas ya escritas) siguen describiendo exactamente el comportamiento implementado; ajustar redacción si `sdd-apply` descubrió un matiz no capturado por el spec (sin cambiar el comportamiento de producto sin aprobación).

## Phase 8a: Follow-ups de cierre — CSP, proxy, redirect de apex (PR8a)

Traceability: `specs/observability-and-delivery/spec.md` → "Nonces de CSP", "Anclaje del proxy matcher a rutas de aplicación", "Redirect del dominio apex".

- [ ] 8a.1 RED `tests/proxy/nonce.test.ts`: dos peticiones distintas a la misma ruta producen nonces distintos en la CSP (Scenario "Nonce único por petición") → implementar en `src/proxy.ts` la generación `const nonce = Buffer.from(crypto.randomUUID()).toString("base64")` por petición.
- [ ] 8a.2 Modificar `src/shared/config/security-headers.ts`: cambiar de una constante estática a `buildSecurityHeaders(nonce: string)` que sustituye `'unsafe-inline'` en `script-src`/`style-src` por `` `'nonce-${nonce}' 'strict-dynamic'` `` (conservando `'unsafe-eval'` solo en desarrollo); `next.config.ts` conserva su `headers()` estático como red de seguridad para rutas fuera del proxy.
- [ ] 8a.3 Modificar `src/proxy.ts`: escribir el header `Content-Security-Policy` resultante en `requestHeaders` (vía `NextResponse.next({ request: { headers: requestHeaders } })`) y en la respuesta; fijar `requestHeaders.set("x-nonce", nonce)`.
- [ ] 8a.4 RED `tests/e2e/csp-nonce.spec.ts`: un script en línea sin el nonce correcto es bloqueado por el navegador (verificar vía consola/violación de CSP reportada) (Scenario "Script en línea sin nonce rechazado") → ajustar hasta que el escenario se cumpla contra preview.
- [ ] 8a.5 Modificar `src/proxy.ts`: cambiar el `matcher` para excluir `monitoring(?:/|$)` en vez de `monitoring` sin ancla.
- [ ] 8a.6 RED `tests/proxy/matcher.test.ts`: "/monitoring" y "/monitoring/algo" quedan excluidos (Scenario "Ruta de observabilidad excluida"); "/monitoring-extra" NO queda excluida (Scenario "Ruta con prefijo similar no excluida") → implementar hasta verde.
- [ ] 8a.7 Modificar `src/proxy.ts`: calcular `canonicalHost` desde `clientEnv().NEXT_PUBLIC_SITE_URL` y redirigir con `NextResponse.redirect` 308 cuando el host de la petición difiere en su variante apex/`www`, preservando ruta y query string.
- [ ] 8a.8 RED `tests/proxy/apex-redirect.test.ts`: una petición al dominio apex con ruta y query string se redirige de forma permanente al dominio canónico con la misma ruta y query string (Scenario "Apex redirige al dominio canónico") → implementar hasta verde.
- [ ] 8a.9 Gate PR8a: `pnpm test -- proxy`, `pnpm typecheck`, `pnpm test:e2e -- csp-nonce` (smoke sobre preview) en verde. Commit de trabajo (`fix(security): add per-request CSP nonce, anchor proxy matcher, redirect apex domain`).

## Phase 8b: Follow-ups de cierre — identity (PR8b)

Traceability: `specs/identity-auth/spec.md` → "Sesión por cookies con refresco en middleware" (parte del `userId`), "Cierre de sesión", "Autorización por propiedad en la capa de aplicación" (semántica de upsert), "Tabla `profiles` con creación automática" (resiliencia de `EnsureProfile`); `specs/observability-and-delivery/spec.md` → "Evento `user_signed_in` en el callback de OAuth".

- [ ] 8b.1 Modificar `src/modules/identity/domain/auth-gateway.ts`: `signInWithPassword` cambia su firma a `Promise<Result<{ userId: string }, DomainError>>`.
- [ ] 8b.2 RED `src/modules/identity/infrastructure/supabase-auth-gateway.test.ts` (o extender el existente) → modificar `SupabaseAuthGateway.signInWithPassword` para leer `data.user.id` de la respuesta de Supabase y devolverlo (Scenario "Gateway de sign-in expone `userId`").
- [ ] 8b.3 Modificar `src/modules/identity/actions.ts`: `signInAction` toma el `userId` de `result.value.userId` en vez de una segunda llamada a `auth.getUser()`.
- [ ] 8b.4 RED extender el test de `sign-in.test.ts`: confirmar que `signInAction` ya no invoca una segunda consulta a Supabase Auth para obtener el `userId`.
- [ ] 8b.5 Modificar `src/app/auth/callback/route.ts`: tras `exchangeCodeForSession` exitoso, usar `after()` de `next/server` para ejecutar `analytics().track("user_signed_in", userId)` con la misma fábrica `createServerAnalytics` que usa `identity/actions.ts`.
- [ ] 8b.6 RED `tests/identity/oauth-callback.test.ts`: un callback de OAuth que establece sesión exitosamente envía exactamente un evento `user_signed_in` (Scenario "Inicio de sesión con Google emite evento") → implementar hasta verde.
- [ ] 8b.7 Modificar `src/modules/identity/actions.ts`: `signOutAction` inspecciona el `Result` de `auth.signOut()` antes de redirigir; cambia su firma a `Promise<{ status: "error"; message: string } | void>`, reutilizando el patrón `AuthFormState` ya existente; en éxito sigue llamando redirect a "/login", en error no redirige y expone el mensaje.
- [ ] 8b.8 RED `sign-out.test.ts`: una llamada de cierre de sesión que Supabase rechaza con error devuelve el error y la UI no asume que la sesión terminó (Scenario "Error al cerrar sesión no se oculta") → implementar hasta verde; confirmar que el Scenario "Cierre exitoso" sigue pasando.
- [ ] 8b.9 Confirmar que `DrizzleProfileRepository.upsert` conserva `onConflictDoNothing({ target: profiles.id })` (sin cambio de código); agregar/ajustar el test `Upsert no sobrescribe campos existentes` si no está ya cubierto explícitamente en la suite de la Fase 0, dejando la decisión declarada en un comentario TSDoc junto al método.
- [ ] 8b.10 Modificar `src/modules/identity/index.ts`: `ensureProfileForUser` envuelve la llamada a `ensureProfile` en `try/catch`, reintenta una vez tras un backoff corto ante un error transitorio, y si el reintento falla registra el error en Sentry sin relanzar la excepción hacia el layout de `(app)`.
- [ ] 8b.11 RED `ensure-profile-resilience.test.ts` (con un repositorio en memoria que falla la primera invocación y luego funciona) → implementar 8b.10 hasta verde; agregar un caso donde ambos intentos fallan y se confirma que no se relanza la excepción y se registra en Sentry (mock del cliente de Sentry).
- [ ] 8b.12 Gate PR8b: `pnpm test -- identity`, `pnpm typecheck`, `pnpm depcruise`, `pnpm test:e2e -- auth` en verde. Commit de trabajo (`fix(identity): expose userId from sign-in gateway, harden sign-out and EnsureProfile`).

## Phase 9: Cierre de fase

- [ ] 9.1 Confirmar que `tests/e2e/{notebooks-acceptance,image-upload,slash-command}.spec.ts` cubren íntegramente el criterio de aceptación de §13 del documento maestro y los Success Criteria de `proposal.md`.
- [ ] 9.2 Ejecutar `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm depcruise`, `pnpm audit --audit-level=high`, `pnpm test:e2e` completos en local y confirmar CI en verde en `main` tras el último PR de la cadena.
- [ ] 9.3 `sdd-archive`: promover `openspec/changes/phase-1-notebooks-editor/specs/{notebooks,editor,page-assets}/spec.md` a `openspec/specs/` como specs nuevas, y fusionar los deltas `MODIFIED`/`REMOVED`/`ADDED` en `openspec/specs/{design-tokens-and-shell,identity-auth,observability-and-delivery,project-tooling}/spec.md`.
