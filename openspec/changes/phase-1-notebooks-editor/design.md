# Design: Fase 1 — Cuadernos y editor

## Technical Approach

`notebooks` y `editor` replican la forma hexagonal de `identity` (`domain/application/infrastructure/ui/index.ts`). `notebooks` posee el modelo de datos y toda regla de negocio sobre cuadernos, páginas y assets; `editor` es una capa de presentación sobre Tiptap que depende de `notebooks` solo a través de un puerto de guardado expuesto en `notebooks/index.ts`, tal como exige `cross-module-via-index` en `.dependency-cruiser.cjs`. `plain_text` se calcula con una función pura de `notebooks/domain` que recorre el JSON de Tiptap sin importar Tiptap ni ProseMirror, satisfaciendo la regla `domain-no-npm` y el Requirement "Materialización de `plain_text` en el servidor" de `specs/notebooks/spec.md`. La concurrencia usa comparar-e-intercambiar sobre `content_version` (`SavePage`), las imágenes usan un permiso de subida firmado emitido por el servidor y una subida directa del navegador a Supabase Storage (`specs/page-assets/spec.md`), y todas las mutaciones pasan por Server Actions validadas con Zod (`specs/notebooks/spec.md`, `specs/editor/spec.md`).

El trabajo previo del slice 0 (migrate-in-build, FK de `profiles`) modifica `observability-and-delivery` e `identity-auth` antes de que exista cualquier tabla nueva que dependa de esas dos correcciones.

## Architecture Decisions

### Decision: Migrar dentro del build de Vercel, no como job posterior al deploy

**Choice**: `package.json` cambia `"build": "next build"` a `"build": "node scripts/migrate-in-build.mjs && next build"`. `scripts/migrate-in-build.mjs` solo ejecuta `drizzle-kit migrate` cuando `VERCEL_ENV === "production"` (o `RUN_DB_MIGRATIONS=1` como escape hatch local contra `cogni-dev`); en cualquier otro caso — Preview de cualquier rama, o build local sin esas variables — se salta la migración y deja pasar `next build`, porque Vercel crea un build de Preview para cada rama y comparte cualquier `DATABASE_URL` configurada con alcance de Preview. `vercel.json` no necesita `buildCommand` propio porque el `build` script ya lo cubre. `DATABASE_URL` debe existir como variable de entorno de Vercel en Production y Preview con alcance de build (paso de usuario en el dashboard, ya documentado en el `proposal.md` bajo Dependencies), pero **Preview debe apuntar a `cogni-dev`, nunca a producción** — el guard por `VERCEL_ENV` evita que un build de Preview migre, pero no protege contra apuntar esa variable a la base equivocada. El orden que precede a producción es el workflow `pr.yml` (`verify`: lint, typecheck, tests, depcruise, audit; más `e2e` si el pipeline lo agrega) reforzado por una regla de protección de rama en `main` con esos checks como requeridos, de modo que ningún cambio llega a producción sin pasar ese gate. El job `migrate` de `.github/workflows/main.yml` (que corría después de `e2e` con `secrets.PROD_DATABASE_URL`) se elimina; los otros dos jobs (`verify`, `e2e`) quedan intactos.

**Alternatives considered**: mantener el job posterior al deploy (Fase 0); migrar desde un `postbuild` script; usar `vercel-build` explícito en `vercel.json`; migrar en todo build sin distinguir `VERCEL_ENV` (descartado por el advisory de revisión "R4-migrate-ungated-in-build": todo build de Preview de cualquier rama migraría la base que apunte `DATABASE_URL` de Preview).

**Rationale**: el job posterior al deploy corre después de que Vercel ya sirve el código nuevo, así que hay una ventana donde la aplicación desplegada lee tablas que aún no existen (§6.1 lo exige antes de leer `notebooks`/`pages`/`page_assets`). Migrar dentro del build hace que un fallo de migración falle el build completo: Vercel conserva el deployment anterior activo (fail-closed, según el Rollback Plan del `proposal.md`) y el código nuevo nunca se sirve sin su esquema. `postbuild` correría después de `next build`, es decir, después de que Next ya haya generado páginas que podrían fallar en build time si tocan la base de datos; anteponer la migración es más seguro. Un `buildCommand` de Vercel duplicaría lo que ya hace `package.json#build` y divergiría entre entornos locales y de CI. Gatear por `VERCEL_ENV === "production"` evita migrar en cada Preview (que corre en cada push de cada rama, no solo en `main`) sin depender de CI para decidir si migrar.

### Decision: FK de `profiles` hacia `auth.users` como migración Drizzle explícita

**Choice**: nueva migración `drizzle/0002_profiles_auth_fk.sql` que primero elimina cualquier fila huérfana de `profiles` (`delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id)`) y luego agrega `alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade`. Drizzle no puede generar este SQL desde el schema porque `auth.users` vive en el esquema `auth`, fuera de la introspección de `drizzle-kit generate` (ya señalado en el `design.md` de la Fase 0); la migración se escribe a mano y se versiona igual que las generadas.

**Alternatives considered**: trigger SQL en `auth.users` (descartado en Fase 0 por la misma razón de introspección); dejar la FK pendiente indefinidamente; agregar la FK sin limpiar huérfanos primero (descartado porque una fila huérfana preexistente haría fallar la migración).

**Rationale**: sin la FK, un `profiles.id` huérfano es posible si una fila de `auth.users` se borra fuera de flujo; la cascada evita perfiles huérfanos y de paso documenta la relación en el esquema real de Postgres, no solo en el código de aplicación. Un perfil sin usuario de `auth.users` correspondiente nunca puede iniciar sesión, así que borrarlo antes de agregar la restricción es seguro; ese borrado también hace que la migración pueda correr sin fallar dentro del build de Vercel en producción (cierra el advisory de revisión "FK migration blocks prod build on orphans").

### Decision: Modelo de datos de `notebooks`/`pages`/`page_assets` en una sola migración versionada

**Choice**: `drizzle/0003_notebooks_pages_assets.sql` generado por `drizzle-kit generate` desde `src/shared/db/schema.ts`, con su reversión en el mismo PR. IDs UUID v7 generados en `application` con `createId()` de `shared/kernel/id.ts` (igual que `identity`), nunca por `default` de Postgres.

**Alternatives considered**: `gen_random_uuid()` como default de columna; tres migraciones separadas (una por tabla).

**Rationale**: `createId()` ya es la única fuente de UUID v7 del proyecto y mantiene los tests de dominio deterministas con un `Clock` inyectado; usar un default de Postgres introduciría una segunda fuente de identificadores con propiedades de ordenamiento distintas. Una sola migración para las tres tablas mantiene juntas las tres FKs entre sí y es más fácil de revertir de forma atómica (`drop table page_assets, pages, notebooks`, en ese orden por las FKs).

```ts
// src/shared/db/schema.ts — additions
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const notebooks = pgTable(
  "notebooks",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    icon: text("icon"),
    color: text("color"),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notebooks_owner_id_idx").on(table.ownerId)],
).enableRLS();

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    notebookId: uuid("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    plainText: text("plain_text").notNull().default(""),
    contentVersion: integer("content_version").notNull().default(1),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pages_notebook_id_idx").on(table.notebookId)],
).enableRLS();

export const pageAssets = pgTable(
  "page_assets",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("page_assets_page_id_idx").on(table.pageId),
    unique("page_assets_storage_path_key").on(table.storagePath),
  ],
).enableRLS();
```

`enableRLS()` sin políticas sigue el patrón de `profiles`: solo la conexión del servidor (que omite RLS) llega a estas tablas; PostgREST con la clave publicable no ve nada (§6.2).

### Decision: `notebooks` como único puerto de persistencia hacia el editor

**Choice**: `notebooks/domain` define `SavePagePort` (una interfaz estructural: `save` y `getCurrent`); `notebooks/index.ts` exporta Server Actions (`saveContent`, `getCurrentContent`) que ya cumplen esa forma porque llaman a los casos de uso `SavePage`/`GetPage` de `application` con el `ownerId` de la sesión ya resuelto. `editor/domain` importa el tipo `SavePagePort` (nunca la implementación) desde `@/modules/notebooks`; la vista de página en `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx` importa la Server Action real y la pasa como prop al componente de editor, que la inyecta en su hook de autosave.

**Alternatives considered**: hacer que `editor/ui` importe directamente `notebooks/application`; exponer un route handler intermedio.

**Rationale**: la regla `cross-module-via-index` de `.dependency-cruiser.cjs` ya prohíbe importar nada de `notebooks` que no sea su `index.ts`; pasar la Server Action como prop desde la página (el composition root) evita que `editor` necesite conocer la forma interna de `notebooks/application` y mantiene el test del hook de autosave trivial (se inyecta un `SavePagePort` falso). Un route handler agregaría una superficie HTTP nueva sin necesidad: Server Actions ya cubren mutación con validación de sesión y Zod.

### Decision: `plain_text` como recorrido puro de AST en `notebooks/domain`

**Choice**: `src/modules/notebooks/domain/plain-text.ts` exporta `extractPlainText(doc: TiptapDoc): string`, tipado contra una forma local `TiptapDoc`/`TiptapNode` (`{ type: string; content?: TiptapNode[]; text?: string; attrs?: Record<string, unknown> }`) definida en el mismo archivo, sin importar `@tiptap/core` ni `prosemirror-model`. `SavePage` (en `application`) es el único llamador.

**Alternatives considered**: usar `generateText()` de Tiptap del lado del servidor (requiere instanciar el editor y su schema completo, según la exploración); enviar `plain_text` calculado en el cliente.

**Rationale**: `generateText()` necesita el schema completo de extensiones, lo que ligaría `domain` a Tiptap y rompería `domain-no-npm`; además sería más lento en cada guardado. Confiar en el cliente viola §6.2 ("se recalcula en cada guardado") y permitiría que un cliente malicioso envíe un `plain_text` que no corresponde al `content` real, contaminando el consumo futuro de IA (Fase 3).

Reglas de recorrido (cobertura 100 %, ver Testing Strategy):

| Tipo de nodo | Contribución a `plain_text` |
|---|---|
| `text` | su `text`, marcas ignoradas |
| Bloques (`heading`, `paragraph`, `blockquote`, `codeBlock`, `listItem`, celdas de `table`, callouts) | el texto de sus hijos, terminado en salto de línea entre bloques hermanos |
| `hardBreak` | un salto de línea |
| Celdas de `tableRow` | separadas por tabulador; filas separadas por salto de línea |
| `image`, `horizontalRule` | ninguna |
| Nodo desconocido | desciende sobre `content` si existe; no lanza excepción |
| Documento vacío o sin `content` | cadena vacía |

### Decision: Tiptap y ProseMirror solo en `editor/ui`, reforzado por una regla nueva de dependency-cruiser

**Choice**: `src/modules/editor/ui/tiptap/` contiene el `Editor` de Tiptap, todas las extensiones (`@tiptap/starter-kit`, `@tiptap/extension-table*`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-link`, `@tiptap/extension-highlight` extendida con la paleta de Cogni, `@tiptap/extension-code-block-lowlight` con `lowlight` para resaltado de sintaxis, extensión de nodo `image` propia que referencia `storagePath` en vez de una URL, extensión de nodo `callout` propia). `editor/domain` y `editor/application` no importan ningún paquete de Tiptap/ProseMirror; solo definen tipos (`SavePagePort`, estado de autosave) y la lógica del hook de autosave (debounce, reintento, reconciliación) contra ese puerto, testeada con un `FakeSavePagePort`. `.dependency-cruiser.cjs` agrega una regla nueva, `editor-tiptap-only-in-ui`, con esta forma:

```js
{
  name: "editor-tiptap-only-in-ui",
  comment:
    "Tiptap and ProseMirror packages may only be imported from editor/ui; editor/domain and editor/application must stay framework-agnostic.",
  severity: "error",
  from: { path: "^src/modules/editor/(?!ui/)", pathNot: "\\.test\\.ts$" },
  to: { path: "node_modules/(@tiptap|prosemirror-)" },
}
```

**Alternatives considered**: extensiones de Tiptap en `application` para reutilizar lógica; un editor propio sin Tiptap (descartado ya en el ADR 0001, fuera de alcance reabrir); confiar solo en la convención de carpeta sin una regla nueva.

**Rationale**: la regla genérica `domain-no-npm` de `.dependency-cruiser.cjs` solo aplica a `src/modules/*/domain`; nada en la configuración actual impide que `editor/application` importe `@tiptap/*` o `prosemirror-*`. El Requirement 7 de `specs/project-tooling/spec.md` exige explícitamente una regla que falle cuando esos paquetes se importan fuera de `editor/ui`, así que la convención de carpeta por sí sola no basta — `editor-tiptap-only-in-ui` cierra ese hueco y falla en CI (`pnpm depcruise`) ante cualquier import indebido, en vez de depender de que una revisión humana lo note.

### Decision: Autosave con debounce de cliente y reconciliación en la UI

**Choice**: `editor/application/use-autosave.ts` (hook) mantiene el `content` local de Tiptap, un `content_version` conocido y un temporizador de 1000 ms (dentro del rango 800–1500 ms del spec). Al vencer el debounce llama a `port.save({ pageId, content, expectedVersion })`. Si la respuesta es éxito, actualiza `content_version` y el estado a "Guardado". Si es error de red/servidor, mantiene el contenido, muestra "No se pudo guardar, reintentando…" y reintenta en la siguiente pausa. Si es conflicto de versión (`DomainError` con código `PAGE_VERSION_CONFLICT`), llama a `port.getCurrent(pageId)`, sustituye el documento de Tiptap por el del servidor, expone el borrador local descartado en un panel de "Recuperar cambios no guardados" y usa la nueva versión en el siguiente guardado.

**Alternatives considered**: WebSocket o Server-Sent Events para push de cambios; guardar en cada pulsación (sin debounce).

**Rationale**: la app no tiene colaboración en tiempo real en su alcance (`proposal.md` Out of Scope), así que un push de servidor sería trabajo sin consumidor. Guardar en cada pulsación excede fácilmente el payload de notas largas y generaría tráfico innecesario; el debounce ya está exigido por §3.2 y el spec de `editor`.

### Decision: Subida de imagen firmada, `RequestImageUpload` + `RegisterPageAsset` + `GetAssetReadUrl`

**Choice**: tres casos de uso en `notebooks/application`, cada uno como Server Action ligera en `notebooks/index.ts` (`requestImageUpload`, `registerPageAsset`, `getAssetReadUrl`). El navegador llama `requestImageUpload({ pageId, mime, sizeBytes })`, obtiene `{ storagePath, signedUrl, token, expiresAt }` de `supabase.storage.from(bucket).createSignedUploadUrl(path)`, sube el archivo directamente con `supabase-js` (`uploadToSignedUrl`), y solo entonces llama `registerPageAsset({ pageId, storagePath, mime, sizeBytes })`. El bloque de imagen del editor resuelve su URL de lectura llamando `getAssetReadUrl({ assetId })` bajo demanda (al montar el nodo), nunca persiste esa URL.

**Alternatives considered**: proxy multipart vía Server Action (descartado en la exploración por el límite de 1 MB); un route handler de callback tipo webhook (no lo requiere `createSignedUploadUrl`).

**Rationale**: documentado en `01-app/02-guides/server-actions.md` de Next.js: el límite por defecto de `bodySizeLimit` es 1 MB e incluye el overhead de `multipart/form-data`; fotos de apuntes superan eso con frecuencia. La ruta firmada directa evita tocar ese límite global (que también relajaría el límite de `SavePage`) y coincide con "URLs firmadas de corta duración" de §9.

`StorageGateway` agrega `getObjectMetadata(path) → { sizeBytes, mime } | null`. `RegisterPageAsset` lee el tamaño y content type reales del objeto ya subido a Storage y rechaza con `DomainError` sin persistir fila cuando el objeto no existe, excede los límites o difiere del `mime` declarado; el `mime`/`sizeBytes` declarados por el cliente pasan a ser solo orientativos y el `mime`/`size_bytes` persistidos provienen del objeto real.

```ts
// src/modules/notebooks/domain/page-asset.ts — pure validation, no Storage SDK
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB, product decision #3

export function validateAssetInput(input: {
  mime: string;
  sizeBytes: number;
}): Result<void, DomainError> {
  if (!ALLOWED_MIME.includes(input.mime as (typeof ALLOWED_MIME)[number])) {
    return err(new DomainError("ASSET_MIME_NOT_ALLOWED", input.mime));
  }
  if (input.sizeBytes > MAX_ASSET_BYTES) {
    return err(new DomainError("ASSET_TOO_LARGE", String(input.sizeBytes)));
  }
  return ok(undefined);
}
```

### Decision: Bucket privado `page-assets`, ruta canónica y RLS por `owner_id`

**Choice**: variable `SUPABASE_STORAGE_BUCKET=page-assets` (nueva clave en `serverSchema`, solo servidor). Ruta de objeto: `{ownerId}/{pageId}/{assetId}.{ext}`, `assetId` generado con `createId()`. El bucket `page-assets` MUST crearse con `file_size_limit = 10485760` y `allowed_mime_types = ['image/jpeg','image/png','image/webp','image/gif']`: Storage rechaza cualquier subida que exceda esos límites sobre los bytes reales, sin importar lo que el cliente haya declarado al pedir el permiso firmado (Supabase Storage, "Restricting uploads": `allowedMimeTypes`/`fileSizeLimit` en la creación del bucket rechazan uploads que no los cumplan, incluida la subida directa vía `createSignedUploadUrl`; https://supabase.com/docs/guides/storage/buckets/creating-buckets). Políticas RLS del bucket (aplicadas por el usuario en el dashboard de Supabase o vía SQL versionado en `drizzle/000X_storage_policies.sql` si Drizzle puede expresarlas contra `storage.objects`):

```sql
create policy "page-assets read own"
  on storage.objects for select
  using (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "page-assets write own"
  on storage.objects for insert
  with check (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
```

**Alternatives considered**: un bucket por usuario (inviable en el tier gratuito, sin límite documentado pero operacionalmente inmanejable); codificar `ownerId` en metadata en vez de en la ruta (RLS de Storage solo puede filtrar por `name`, no por metadata arbitraria sin una función adicional).

**Rationale**: el primer segmento de la ruta como filtro de RLS es el patrón documentado de Supabase Storage y es lo único performante para políticas declarativas; coincide con "assets de páginas archivadas" (Requirement de `page-assets/spec.md`): archivar una página no toca Storage, así que la ruta debe seguir siendo válida sin importar el estado de la página.

### Decision: `images.remotePatterns` y `img-src` de CSP en el mismo pase

**Choice**: `next.config.ts` agrega `images: { remotePatterns: [{ protocol: "https", hostname: new URL(clientEnv().NEXT_PUBLIC_SUPABASE_URL).hostname, pathname: "/storage/v1/object/sign/**" }] }` (la ruta de Supabase Storage para URLs firmadas de lectura). `src/shared/config/security-headers.ts` añade ese mismo host a `img-src` en la CSP existente; `data:` y `blob:` ya están presentes ahí desde la Fase 0 (`img-src 'self' blob: data: https://*.googleusercontent.com`), así que este cambio solo suma el host de Supabase Storage.

**Alternatives considered**: permitir `**.supabase.co` de forma amplia; dejar `img-src` sin tocar y usar `unoptimized` en `next/image` para servir bytes crudos.

**Rationale**: la exploración marcó explícitamente que ambos toques de CSP deben hacerse en el mismo PR para no generar dos diffs de CSP separados (uno de esta fase, uno del follow-up de nonces). Restringir al hostname exacto del proyecto Supabase configurado (derivado de `NEXT_PUBLIC_SUPABASE_URL`, ya validado por Zod) sigue la recomendación de Next.js de ser específico en `remotePatterns` en vez de un comodín amplio.

### Decision: shadcn/ui inicializado sobre los tokens existentes, primitivos mínimos

**Choice**: `pnpm dlx shadcn@latest init` sin `--defaults`, reutilizando las variables CSS ya presentes en `src/app/globals.css` (mismo criterio que Fase 0 con Tailwind). Primitivos agregados a `src/shared/ui/`: `command` (menú `/`), `popover`, `dropdown-menu`, `dialog` (confirmar archivado), y los que el menú de comandos y la tabla del editor requieran (`separator`, `tooltip`). `button.tsx` existente se mantiene si su API coincide con la de shadcn; si no, se reconcilia en la misma tarea.

**Alternatives considered**: construir cada primitivo a mano (la exploración lo dejó como pregunta abierta); usar Radix directamente sin la capa de shadcn (el proyecto ya depende de `radix-ui` en `package.json`, pero sin patrones de estilo consistentes).

**Rationale**: ADR 0001 ya cerró shadcn/ui como parte del stack; construir un menú de comandos accesible y popovers a mano duplicaría trabajo que shadcn resuelve sobre Radix (ya en `dependencies`) y mantiene la consistencia con el sistema de diseño vía `components.json`.

### Decision: Sidebar como Server Component con mutaciones optimistas de TanStack Query

**Choice**: `src/app/(app)/_components/sidebar-tree.tsx` es un Server Component que llama `ListSidebar` (vía `notebooks/index.ts`) para el árbol inicial; un componente cliente (`sidebar-tree-client.tsx`) hidrata ese árbol en una `useQuery` de TanStack Query con ese mismo dato como `initialData`, y cada mutación (crear, renombrar, ícono/color, archivar) usa `useMutation` con actualización optimista y `onError` que revierte, siguiendo el patrón ya cerrado por ADR 0001 para TanStack Query.

**Alternatives considered**: Zustand para el árbol del sidebar; recargar la página completa en cada mutación (`router.refresh()` sin optimismo).

**Rationale**: TanStack Query ya resuelve caché, invalidación y rollback optimista sin estado global adicional; Zustand (también cerrado por ADR 0001) se reserva para estado de UI efímero sin necesidad de sincronizar con el servidor (p. ej. estado de expansión de un cuaderno en el árbol), no para datos de servidor.

### Slice 8 — follow-ups de cierre

Los ocho ítems formalizados como Requirements ADDED/MODIFIED en `specs/identity-auth/spec.md` y `specs/observability-and-delivery/spec.md` se resuelven en el último slice del change (§ proposal.md, slice 8), después de que el producto de la fase (cuadernos, editor, imágenes) ya está completo. Ninguno depende de las tablas nuevas de `notebooks`/`pages`/`page_assets`.

#### Decision: Nonce de CSP generado por petición en `src/proxy.ts` y propagado vía `x-nonce`

**Choice**: `proxy.ts` genera `const nonce = Buffer.from(crypto.randomUUID()).toString("base64")` en cada petición. `security-headers.ts` deja de exportar una constante estática y pasa a exportar `buildSecurityHeaders(nonce: string)`, que sustituye `'unsafe-inline'` en `script-src` y `style-src` por `` `'nonce-${nonce}' 'strict-dynamic'` `` (conservando `'unsafe-eval'` solo en desarrollo, igual que hoy). El proxy escribe el header `Content-Security-Policy` resultante tanto en `requestHeaders` (vía `NextResponse.next({ request: { headers: requestHeaders } })`) como en la respuesta, y además fija `requestHeaders.set("x-nonce", nonce)` para que cualquier Server Component lo lea con `(await headers()).get("x-nonce")` y lo pase a un `<Script nonce={…}>` de terceros si hace falta. `next.config.ts` conserva su `headers()` estático solo como red de seguridad para rutas fuera del alcance del proxy; en cualquier ruta que el proxy procese, su header dinámico gana porque se aplica después.

**Alternatives considered**: Subresource Integrity (SRI) experimental de Next.js 16 (exige generación estática de las páginas afectadas, incompatible con el resto de rutas dinámicas de la fase que ya dependen de la sesión); mantener `'unsafe-inline'` (es exactamente lo que el Requirement "Nonces de CSP" prohíbe).

**Rationale**: según `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` ("Adding a nonce with Proxy" / "How nonces work in Next.js"), Next.js extrae el nonce parseando el patrón `'nonce-{value}'` del header `Content-Security-Policy` de la propia petición durante el renderizado del lado del servidor, y lo aplica automáticamente a los scripts del framework; el canal documentado para que código de aplicación lea ese mismo valor es un header de petición (`x-nonce`) leído con `headers()`. `'strict-dynamic'` es necesario junto al nonce para que los chunks inyectados dinámicamente por Next.js hereden la confianza del script que los cargó sin listarlos uno a uno.

#### Decision: Matcher del proxy anclado con `monitoring(?:/|$)`

**Choice**: el `matcher` de `src/proxy.ts` cambia el segmento `monitoring` (sin ancla) por `monitoring(?:/|$)` dentro del grupo negativo de exclusión, de forma que solo `/monitoring` y `/monitoring/...` quedan excluidos del proxy; una ruta como `/monitoring-extra` ya no cae en la exclusión por prefijo compartido.

**Alternatives considered**: dejar el patrón actual sin ancla (falla el escenario "Ruta con prefijo similar no excluida" del Requirement).

**Rationale**: `monitoring` sin ancla en una alternancia de regex coincide con cualquier ruta cuyo primer segmento *empiece* con esa cadena, no solo con la ruta exacta del túnel de Sentry (`tunnelRoute: "/monitoring"` en `next.config.ts`); una ruta futura como `/monitoring-extra` quedaría sin sesión refrescada por el proxy sin necesidad. Anclar con `(?:/|$)` restringe la exclusión a la ruta exacta o a sus subrutas.

#### Decision: Evento `user_signed_in` en el callback de OAuth vía `after()`

**Choice**: `src/app/auth/callback/route.ts` importa `after` de `next/server` y, tras un `exchangeCodeForSession` exitoso, obtiene el `userId` de la sesión recién establecida (ver decisión siguiente) y ejecuta `after(() => analytics().track("user_signed_in", userId))`, con la misma fábrica `createServerAnalytics` que ya usa `identity/actions.ts`.

**Alternatives considered**: emitir el evento dentro de `exchangeCodeForSession` en `identity/index.ts`, que mezclaría una dependencia de analítica en una función de sesión reutilizada también por el flujo de restablecimiento de contraseña, donde `user_signed_in` no aplica.

**Rationale**: mantiene la misma disciplina que `signInAction`: la Server Action o route handler que sabe qué flujo de negocio ocurrió decide qué evento corresponde; `after()` difiere el tracking fuera de la respuesta al navegador, igual que en el resto del módulo.

#### Decision: El gateway de sign-in devuelve `userId`

**Choice**: `AuthGateway.signInWithPassword` (en `identity/domain/auth-gateway.ts`) cambia su firma de `Promise<Result<void, DomainError>>` a `Promise<Result<{ userId: string }, DomainError>>`. `SupabaseAuthGateway.signInWithPassword` lee `data.user.id` de la respuesta de `signInWithPassword` de Supabase (ya presente en el payload, hoy descartado) en vez de ignorarlo. `signInAction` deja de hacer una segunda llamada a `createSupabaseServerClient().auth.getUser()` para obtener el `userId` del evento `user_signed_in`; lo toma directamente de `result.value.userId`.

**Alternatives considered**: conservar la segunda consulta a Supabase Auth que `signInAction` hace hoy (es exactamente el comportamiento que el Requirement pide eliminar).

**Rationale**: el Requirement "Sesión por cookies con refresco en middleware" exige que el gateway "exponga el `userId` de la sesión resultante en su valor de retorno, para que los casos de uso de `notebooks` reciban el `ownerId` sin una segunda consulta a Supabase Auth"; `data.user.id` ya viene en la respuesta de `signInWithPassword`, así que la segunda llamada era una consulta de red evitable.

#### Decision: Semántica de upsert de `profiles` = `onConflictDoNothing`

**Choice**: `DrizzleProfileRepository.upsert` conserva `onConflictDoNothing({ target: profiles.id })`, ya implementado en la Fase 0; no cambia a `onConflictDoUpdate`.

**Alternatives considered**: `onConflictDoUpdate` sobrescribiendo todas las columnas en cada llamada.

**Rationale**: el Requirement "Autorización por propiedad en la capa de aplicación" exige que el upsert "no sobrescriba campos no provistos si ya existe"; `onConflictDoUpdate` reescribiría `display_name`/`locale`/`timezone` con los valores por defecto de `createProfile` en cada login repetido, borrando cualquier personalización guardada por el usuario. `onConflictDoNothing` ya satisface el escenario "Upsert no sobrescribe campos existentes" sin cambio de código; este follow-up deja la elección declarada explícitamente en vez de implícita, que es lo que el `proposal.md` había dejado abierto.

#### Decision: `signOutAction` maneja el resultado de `signOut`

**Choice**: `signOutAction` (en `identity/actions.ts`) inspecciona el `Result` de `auth.signOut()` antes de redirigir. Su firma cambia de `Promise<void>` a `Promise<{ status: "error"; message: string } | void>` (o lanza un error capturable por el `error.tsx` más cercano, según lo que fije `sdd-tasks`); en éxito sigue llamando `redirect("/login")`, en error no redirige y expone el mensaje para que el componente que la invoca lo muestre.

**Alternatives considered**: ignorar el error y redirigir siempre (comportamiento actual), prohibido por el Requirement "Cierre de sesión": "MUST NOT dar por cerrada la sesión en la UI si Supabase reporta un error".

**Rationale**: cumple el escenario "Error al cerrar sesión no se oculta"; reutiliza el patrón de estado de error para Server Actions (`AuthFormState`) que ya existe en el módulo en vez de introducir uno nuevo.

#### Decision: `EnsureProfile` resiliente con upsert idempotente y degradación controlada

**Choice**: `ensureProfileForUser` (en `identity/index.ts`) envuelve la llamada a `ensureProfile` en un `try/catch`; ante un error transitorio del repositorio (por ejemplo una desconexión momentánea), reintenta una sola vez tras un backoff corto y, si el reintento también falla, no relanza la excepción hacia el layout de `(app)`: registra el error en Sentry y deja que la petición continúe. El upsert (`onConflictDoNothing`) sigue siendo la garantía de idempotencia contra la carrera entre dos peticiones concurrentes exigida por el escenario "Escritura concurrente resuelta por el upsert"; el reintento acotado cubre el caso distinto de fallo transitorio de red/DB.

**Alternatives considered**: relanzar siempre la excepción (comportamiento actual: bloquea el acceso al shell en cualquier fallo transitorio); una cola de reintento en segundo plano (excede el alcance de una llamada síncrona dentro del layout, sin infraestructura de colas en el stack de costo cero).

**Rationale**: el Requirement exige que `EnsureProfile` "tolere y se recupere de un fallo transitorio... sin dejar al usuario sin perfil ni bloquear el acceso al shell en el siguiente intento". Un reintento acotado más degradación no bloqueante cubre ambas mitades del requisito sin una dependencia nueva: el perfil terminará creándose en un intento posterior porque `ensureProfileForUser` se invoca en cada petición al layout de `(app)`.

#### Decision: Redirect del dominio apex hacia el host canónico en `src/proxy.ts`

**Choice**: `proxy.ts` calcula `canonicalHost = new URL(clientEnv().NEXT_PUBLIC_SITE_URL).hostname` y lo compara contra `request.nextUrl.hostname`. Si difieren y ambos hosts corresponden al mismo dominio en su variante apex/`www` (es decir, uno es igual al otro con o sin el prefijo `www.`), el proxy responde con un `NextResponse.redirect` permanente (308) hacia `` `${clientEnv().NEXT_PUBLIC_SITE_URL}${pathname}${search}` ``, preservando ruta y query string. Si los hosts ya coinciden, no hace nada.

**Alternatives considered**: un redirect a nivel de DNS/proveedor de dominio fuera del código versionado (no verificable por los tests del change); hardcodear el dominio apex y el canónico como dos literales en vez de derivarlos de `NEXT_PUBLIC_SITE_URL`.

**Rationale**: el Requirement pide redirigir "al dominio canónico configurado en `NEXT_PUBLIC_SITE_URL`"; esa variable ya es la única fuente de verdad validada por Zod para el dominio del sitio (usada también para `emailRedirectTo` y, ahora, para el host canónico del redirect), así que derivar el host canónico de ahí evita una segunda fuente de verdad. Comparar por la variante apex/`www` en vez de un dominio fijo hace que la decisión sea correcta independientemente de cuál de las dos formas termine configurada como canónica en el proyecto de Vercel.

## Data Flow

### Guardado de contenido de página (autosave)

```
Tiptap onUpdate → debounce (800–1500ms) → use-autosave hook (editor/application)
    → port.save({ pageId, content, expectedVersion })  // Server Action de notebooks/index.ts
        → SavePage(ownerId, pageId, content, expectedVersion)  // notebooks/application
            → PageRepository.findById(pageId) ── owner_id / archived_at check
            → extractPlainText(content)  // notebooks/domain, sin Tiptap
            → PageRepository.updateIfVersion({ pageId, ownerId, expectedVersion, content, plainText, updatedAt })
                // UPDATE condicional atómico: WHERE id=$pageId AND owner_id=$ownerId
                //   AND archived_at IS NULL AND content_version=$expectedVersion
                //   SET content_version=content_version+1 RETURNING content_version
            → 0 filas afectadas ? DomainError(PAGE_VERSION_CONFLICT, "current version is <releída>") : sigue
        ← { version: content_version actualizado }
    ← hook actualiza content_version local, estado "Guardado"

En conflicto:
    ← DomainError(PAGE_VERSION_CONFLICT)
    → port.getCurrent(pageId) → { content, version }
    → hook reemplaza el documento de Tiptap, conserva el borrador local aparte, avisa al usuario
```

### Subida de imagen

```
usuario suelta/selecciona archivo → editor/ui valida MIME y tamaño localmente (mensaje inmediato si falla)
    → requestImageUpload({ pageId, mime, sizeBytes })  // Server Action
        → RequestImageUpload(ownerId, pageId, mime, sizeBytes)  // notebooks/application
            → PageRepository.findById ── owner_id / archived_at check
            → validateAssetInput(mime, sizeBytes)  // notebooks/domain
            → StorageGateway.createSignedUploadUrl(`${ownerId}/${pageId}/${assetId}.${ext}`)
        ← { storagePath, signedUrl, token }
    → navegador: supabase.storage.from(bucket).uploadToSignedUrl(storagePath, token, file)
        → Supabase Storage (RLS: primer segmento de la ruta === auth.uid())
    → registerPageAsset({ pageId, storagePath, mime, sizeBytes })  // Server Action
        → RegisterPageAsset(ownerId, pageId, storagePath, mime, sizeBytes)
            → revalida propiedad, MIME, tamaño, prefijo de ruta
            → PageAssetRepository.upsert (idempotente por storage_path)
    → nodo de imagen de Tiptap persiste { assetId } (nunca una URL firmada)

Al renderizar:
    nodo de imagen monta → getAssetReadUrl({ assetId })  // Server Action
        → GetAssetReadUrl(ownerId, assetId) → StorageGateway.createSignedUrl(storagePath, 3600)
    ← URL firmada de 1h → <img src="…">
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/shared/db/schema.ts` | Modify | Agrega `notebooks`, `pages`, `page_assets` |
| `drizzle/0002_profiles_auth_fk.sql` | Create | FK manual `profiles.id` → `auth.users.id` |
| `drizzle/0003_notebooks_pages_assets.sql` (+ reversión) | Create | Migración generada por `drizzle-kit generate` |
| `drizzle/0004_page_assets_storage_policies.sql` | Create | Políticas RLS de `storage.objects` para el bucket `page-assets` |
| `package.json` | Modify | `"build": "drizzle-kit migrate && next build"` |
| `.github/workflows/main.yml` | Modify | Elimina el job `migrate` posterior al deploy |
| `src/shared/config/env.schema.ts` | Modify | `SUPABASE_STORAGE_BUCKET` en `serverSchema` |
| `src/shared/config/security-headers.ts` | Modify | `img-src` incluye el host de Supabase Storage; slice 8: `buildSecurityHeaders(nonce)` sustituye la constante estática para soportar nonces de CSP |
| `next.config.ts` | Modify | `images.remotePatterns` hacia Supabase Storage |
| `.dependency-cruiser.cjs` | Modify | Regla nueva `editor-tiptap-only-in-ui` |
| `src/modules/notebooks/domain/{notebook,page,page-asset,plain-text,errors}.ts` | Create | Entidades, invariantes, extractor puro, códigos de `DomainError` |
| `src/modules/notebooks/domain/{notebook-repository,page-repository,page-asset-repository,storage-gateway,save-page-port}.ts` | Create | Puertos |
| `src/modules/notebooks/application/{create-notebook,rename-notebook,set-notebook-appearance,archive-notebook,create-page,rename-page,archive-page,save-page,get-page,list-sidebar,request-image-upload,register-page-asset,get-asset-read-url}.ts` | Create | Casos de uso, `Result<T, DomainError>`, Zod en el borde |
| `src/modules/notebooks/application/testing/{in-memory-notebook-repository,in-memory-page-repository,in-memory-page-asset-repository,fake-storage-gateway}.ts` | Create | Dobles en memoria |
| `src/modules/notebooks/infrastructure/{drizzle-notebook-repository,drizzle-page-repository,drizzle-page-asset-repository,supabase-storage-gateway}.ts` | Create | Adaptadores |
| `src/modules/notebooks/ui/{sidebar-tree,sidebar-tree-client,notebook-item,page-item,create-notebook-dialog,archive-confirm-dialog}.tsx` | Create | Componentes del árbol |
| `src/modules/notebooks/actions.ts` | Create | Server Actions de CRUD, guardado, assets |
| `src/modules/notebooks/index.ts` | Modify | Exporta Server Actions, `SavePagePort`, tipos públicos |
| `src/modules/editor/domain/{save-page-port,autosave-state}.ts` | Create | Tipos puros, sin Tiptap |
| `src/modules/editor/application/use-autosave.ts` | Create | Hook de debounce, reintento, reconciliación |
| `src/modules/editor/application/testing/fake-save-page-port.ts` | Create | Doble en memoria del puerto |
| `src/modules/editor/ui/tiptap/{editor,extensions/*,command-menu,image-node,callout-node,highlight-palette}.tsx` | Create | Tiptap, extensiones, menú `/` |
| `src/modules/editor/ui/{save-status,conflict-banner,upload-progress}.tsx` | Create | Estados visuales |
| `src/modules/editor/index.ts` | Modify | Exporta el componente `Editor` público |
| `src/shared/ui/{command,popover,dropdown-menu,dialog,separator,tooltip}.tsx`, `components.json` | Create | shadcn/ui |
| `src/app/(app)/notebooks/[notebookId]/page.tsx` | Create | Vista de cuaderno |
| `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx` | Create | Vista de página, compone `Editor` con la Server Action real |
| `src/app/(app)/_components/sidebar.tsx`, `layout.tsx` | Modify | Reemplaza el enlace único "Inicio" por el árbol |
| `tests/e2e/shell-empty-state.spec.ts` | Modify | Reescrito para el estado vacío real del sidebar de cuadernos |
| `tests/e2e/{notebooks-acceptance,image-upload,slash-command}.spec.ts` | Create | Flujos críticos de Playwright |
| `docs/diagramas/fase-1-*.json` (+ `.html`) | Create | Diagramas de archify |
| `src/proxy.ts` | Modify | Slice 8: nonce de CSP por petición (`x-nonce`), matcher anclado a `monitoring(?:/|$)`, redirect de apex al host canónico |
| `src/modules/identity/domain/auth-gateway.ts` | Modify | Slice 8: `signInWithPassword` retorna `{ userId }` |
| `src/modules/identity/infrastructure/supabase-auth-gateway.ts` | Modify | Slice 8: expone `userId` desde la respuesta de Supabase |
| `src/modules/identity/actions.ts` | Modify | Slice 8: `signOutAction` maneja el resultado de `signOut`; `signInAction` usa el `userId` del gateway |
| `src/modules/identity/index.ts` | Modify | Slice 8: `ensureProfileForUser` reintenta una vez y degrada sin bloquear el shell |
| `src/app/auth/callback/route.ts` | Modify | Slice 8: emite `user_signed_in` vía `after()` |
| `openspec/specs/{notebooks,editor,page-assets}/spec.md` | Create (al archivar) | Promoción de las specs de este change |
| `openspec/specs/{design-tokens-and-shell,identity-auth,observability-and-delivery,project-tooling}/spec.md` | Modify (al archivar) | Fusión de los deltas MODIFIED |

## Interfaces / Contracts

```ts
// src/modules/notebooks/domain/save-page-port.ts
export interface TiptapDoc {
  type: "doc";
  content?: TiptapNode[];
}
export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface SavePagePort {
  save(input: {
    pageId: string;
    content: TiptapDoc;
    expectedVersion: number;
  }): Promise<Result<{ version: number }, DomainError>>;
  getCurrent(
    pageId: string,
  ): Promise<Result<{ content: TiptapDoc; version: number }, DomainError>>;
}
```

```ts
// src/modules/notebooks/application/save-page.ts
export async function savePage(
  input: unknown,
  deps: { pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<{ version: number }, DomainError>> {
  const parsed = parseInput(savePageSchema, input); // rejects a client-sent plain_text field
  if (!parsed.ok) return parsed;
  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError("PAGE_NOT_FOUND", parsed.value.pageId));
  }
  const plainText = extractPlainText(parsed.value.content);
  // updateIfVersion es un UPDATE condicional atómico: nunca lectura-comparación-escritura
  const result = await deps.pages.updateIfVersion({
    pageId: parsed.value.pageId,
    ownerId,
    expectedVersion: parsed.value.expectedVersion,
    content: parsed.value.content,
    plainText,
    updatedAt: deps.clock.now(),
  });
  if (!result.updated) {
    return err(
      new DomainError(
        "PAGE_VERSION_CONFLICT",
        `current version is ${result.currentVersion}`,
      ),
    );
  }
  return ok({ version: result.version });
}
```

**`PageRepository.updateIfVersion`**: el puerto de 383 agrega `updateIfVersion(input): Promise<{ updated: true; version: number } | { updated: false; currentVersion: number }>`, que ejecuta el `UPDATE` condicional anterior en una sola sentencia. `InMemoryPageRepository` implementa la misma semántica condicional (comparar y escribir como una operación atómica, sin ventana entre lectura y escritura), y un test de contrato compartido (`application/testing/page-repository.contract.ts`) se ejecuta tanto contra el doble en memoria como contra `DrizzlePageRepository`.

```ts
// src/modules/notebooks/domain/errors.ts — DomainError codes for this change
export const NOTEBOOK_ERROR = {
  NOT_FOUND: "NOTEBOOK_NOT_FOUND",
  ARCHIVED: "NOTEBOOK_ARCHIVED",
  INVALID_TITLE: "NOTEBOOK_INVALID_TITLE",
  INVALID_COLOR: "NOTEBOOK_INVALID_COLOR",
} as const;

export const PAGE_ERROR = {
  NOT_FOUND: "PAGE_NOT_FOUND",
  VERSION_CONFLICT: "PAGE_VERSION_CONFLICT",
  INVALID_CONTENT: "PAGE_INVALID_CONTENT",
} as const;

export const ASSET_ERROR = {
  MIME_NOT_ALLOWED: "ASSET_MIME_NOT_ALLOWED",
  TOO_LARGE: "ASSET_TOO_LARGE",
  PATH_OUT_OF_SCOPE: "ASSET_PATH_OUT_OF_SCOPE",
  FORBIDDEN: "ASSET_FORBIDDEN",
} as const;
```

```sql
-- drizzle/0002_profiles_auth_fk.sql
-- guard:start ... guard:end: do $$ ... raise exception ... end $$; (ver archivo real)
delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id);

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
-- 0002_profiles_auth_fk.down.sql (only drops the constraint; the deleted
-- orphan rows above are not restored)
alter table profiles drop constraint profiles_id_fkey;
```

El bloque `do $$ ... $$` (entre los marcadores `-- guard:start`/`-- guard:end` del archivo real) falla cerrado: si `auth.users` aparece vacía mientras `profiles` tiene filas, aborta la migración con una excepción en vez de borrar la tabla completa sin retroceso; los conteos de huérfanos quedan registrados con `raise notice` para diagnóstico.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit — domain | Invariantes de `Notebook`/`Page` (título, color, posición), `extractPlainText` (cobertura 100 %, tabla de nodos anterior), `validateAssetInput` | Vitest puro, sin jsdom ni Next, siguiendo el patrón de `profile.test.ts` |
| Unit — application | Los 13 casos de uso con `InMemory*Repository`/`FakeStorageGateway`, incluidos los escenarios de conflicto de versión, ownership ajeno, MIME/tamaño fuera de rango, registro repetido de asset; test de contrato de `updateIfVersion` sobre el doble en memoria | Vitest, fakes en `application/testing/` |
| Unit — editor | `use-autosave` con `FakeSavePagePort` (guardado tras pausa, escritura durante guardado, fallo de red, conflicto), extensiones de marcas (resaltado por nombre, enlace con esquema no permitido) | Vitest + Testing Library, jsdom |
| Component | Menú `/` (filtro, teclado, Escape), banner de conflicto, estado de progreso de subida | Testing Library |
| Arquitectura | Reglas de `.dependency-cruiser.cjs`, incluida la ausencia de imports de Tiptap/ProseMirror en `domain`/`application` de ambos módulos | `pnpm depcruise` en CI |
| DB smoke | Migración aplicada y revertida (tres tablas, `content_version` default 1, FK de `profiles`); carrera de `SavePage`: dos escritores con el mismo `expectedVersion` → exactamente uno actualiza | `pnpm test:db` contra `cogni-dev` |
| E2E | Aceptación de §13 (crear cuaderno → página → cada familia de bloques → recargar), subida y renderizado de imagen, inserción con `/`, ida y vuelta de bloques, RLS negativo entre usuarios, reescritura de `shell-empty-state.spec.ts` | Playwright, Chromium, contra preview |

## Threat Matrix

Este change agrega enrutamiento nuevo (vistas de cuaderno/página bajo `(app)`) y una frontera de autorización nueva (Storage con RLS por `owner_id`), pero no ejecuta shell, subprocesos, comandos git ni automatización de PR, y no clasifica archivos ejecutables. Las cinco filas de referencia de `threat-matrix.md` (rutas tipo documentación, selección de repositorio git, estado de commit, estado de push, comandos de PR) son **N/A** por la misma razón que en la Fase 0.

| Frontera aplicable (propia de este change) | Comportamiento seguro / de fallo | Test RED |
|---|---|---|
| Rutas de cuaderno/página con identificador ajeno o archivado | responde como recurso no encontrado, sin revelar existencia | `tests/e2e/notebooks-acceptance.spec.ts`: URL de página de otro usuario → vista de no encontrado |
| `RequestImageUpload` / `RegisterPageAsset` con `pageId` ajeno | `DomainError` antes de contactar Storage; ninguna fila creada | Unit: "Página ajena o archivada" en `specs/page-assets/spec.md` |
| Ruta de Storage fuera del prefijo del owner en `RegisterPageAsset` | `DomainError`, sin persistir | Unit: "Ruta fuera del prefijo del owner" |
| Lectura de asset ajeno vía `GetAssetReadUrl` | `DomainError`, ninguna URL | Unit: "Asset ajeno" |
| RLS de `storage.objects` para el bucket `page-assets` | denegación a nivel de Postgres, no solo de aplicación | E2E: "Lectura entre usuarios denegada", "Acceso anónimo denegado" |
| MIME/tamaño de imagen fuera de política | rechazo en tres capas del servidor: permiso (metadatos declarados), bucket (`file_size_limit`/`allowed_mime_types` sobre los bytes reales), registro (metadatos reales del objeto) | Unit: "MIME no permitido", "Tamaño excedido", "Objeto real fuera de política"; E2E: "Subida que excede el límite del bucket rechazada" |
| `SavePage` con `content_version` obsoleto | rechazo con `DomainError`; la escritura es un `UPDATE` condicional atómico en Postgres, nunca lectura-comparación-escritura | Unit: "Guardado obsoleto rechazado"; DB smoke: carrera de `SavePage` |
| `plain_text` enviado por el cliente en `SavePage` | ignorado o rechazado por Zod; el valor persistido siempre viene del cálculo del servidor | Unit: "`plain_text` enviado por el cliente ignorado" |

## Migration / Rollout

Cuatro migraciones versionadas, cada una con su reversión, aplicadas por `drizzle-kit migrate` dentro del build de Vercel (Decision "Migrar dentro del build"):

1. `0002_profiles_auth_fk` — FK de `profiles` (slice 0).
2. `0003_notebooks_pages_assets` — las tres tablas nuevas (slice 1).
3. `0004_page_assets_storage_policies` — políticas RLS de `storage.objects` (slice 6; requiere que el usuario cree el bucket `page-assets` en el dashboard de Supabase antes de este slice, según Dependencies del `proposal.md`).

Rollout sigue el orden de slices 0–8 del `proposal.md` (auto-chain, ~400 líneas de autoría por PR); este `design.md` no reordena esos slices. Cada PR es revertible de forma independiente: revertir el slice de producto correspondiente no afecta a `identity` ni a los slices anteriores, porque `notebooks`/`editor` son aditivos y las migraciones tienen reversión versionada. El slice 0 se entrega y verifica primero en `cogni-dev` antes de fusionarse, mitigando el riesgo "Migrate-in-build falla o bloquea un build de Vercel" del `proposal.md`.

## Open Questions

- [ ] Si las políticas RLS de `storage.objects` se versionan como migración Drizzle o se documentan como SQL a pegar manualmente en el dashboard de Supabase (Drizzle no introspecta `storage.objects`, igual que `auth.users`): se decide en `sdd-tasks` según lo que permita `drizzle-kit generate` para SQL crudo.
- [ ] Nombre exacto de la variable de entorno para el nombre del bucket (`SUPABASE_STORAGE_BUCKET` propuesto aquí) se confirma contra `.env.example` en `sdd-tasks`.
- [ ] Si `next.config.ts` necesita `images.qualities` o `dangerouslyAllowSVG` — no aplica porque `image/svg+xml` está fuera de la lista de MIME permitidos.
- [ ] Extensión exacta de resaltado de sintaxis (`lowlight` + `highlight.js` vs. `shiki`) se fija en `sdd-tasks` con base en tamaño de bundle; ambas son compatibles con `@tiptap/extension-code-block-lowlight`.

## Diagramas

Fuentes en `docs/diagramas/` (JSON de archify; el worker de `sdd-tasks`/`sdd-apply` ejecuta `validate`/`deliver` para generar el `.html` junto a cada una):

| Fuente | HTML | Qué muestra |
|---|---|---|
| `fase-1-arquitectura-modulos.architecture.json` | `fase-1-arquitectura-modulos.html` | Módulos `notebooks`, `editor`, `identity`, `shared/db`, Supabase Storage y Postgres, con la dirección de dependencia `editor → notebooks` solo vía `index.ts` y `notebooks → Postgres/Storage` vía `infrastructure` |
| `fase-1-guardado-pagina.sequence.json` | `fase-1-guardado-pagina.html` | Secuencia de autosave: Tiptap → hook de autosave → Server Action → `SavePage` → repositorio → Postgres, incluida la rama de conflicto de `content_version` |
| `fase-1-subida-imagen.sequence.json` | `fase-1-subida-imagen.html` | Secuencia de subida firmada: editor → `RequestImageUpload` → Storage (subida directa) → `RegisterPageAsset`, y la resolución de `GetAssetReadUrl` al renderizar |
| `fase-1-ciclo-pagina.lifecycle.json` | `fase-1-ciclo-pagina.html` | Ciclo de vida de una página: creada → activa (con transiciones de guardado y conflicto) → archivada, sin estado de papelera ni borrado físico |
