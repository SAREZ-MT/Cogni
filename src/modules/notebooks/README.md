# Module `notebooks`

## Responsibility

Notebooks, pages, their TipTap content and `plain_text` (used by search),
plus image assets attached to a page. The sole persistence gateway for the
editor: nothing else in the app writes page content directly to Postgres
(`docs/documento-maestro.md` §13, Phase 1; design.md, "notebooks como único
puerto de persistencia hacia el editor").

## Layers

Hexagonal shape enforced by `.dependency-cruiser.cjs` (`domain-is-pure`,
`application-no-infra-or-ui`, `ui-never-touches-infra`,
`cross-module-via-index`):

- `domain/`: pure TypeScript — `Notebook`, `Page`, `PageAsset` entities,
  the `TiptapDoc`/`TiptapNode` document shape, `plain-text.ts` extraction
  and every port interface (`NotebookRepository`, `PageRepository`,
  `PageAssetRepository`, `StorageGateway`). No framework, no npm
  dependency other than Zod. `TiptapDoc`/`TiptapNode` are defined in
  `src/shared/kernel/tiptap-doc.ts` and re-exported from `plain-text.ts`.
  `extractPlainText` covers every catalogue node (its comment table lists
  the rule per node): inline atoms stay on their line (`@label`, `:emoji:`,
  inline LaTeX), block math is its LaTeX line, an image is its caption
  (never its alt: alt text is invisible on the page, so since
  document-import T9b it no longer feeds search or the AI; it stays on the
  node for accessibility), and youtube/divider/table-of-contents write
  nothing. Text taken from attrs (LaTeX, mention label, caption) has its
  line breaks replaced by one space, and an unknown node among inline
  content stays on that line, so neither ever splits a line. `plain_text` feeds the AI paragraph split
  (`src/shared/kernel/page-paragraphs.ts`), so output for pre-catalogue
  nodes is pinned byte-identical to keep paragraph fingerprints stable —
  except, deliberately, images (the caption is new text; the previous
  implementation wrote nothing for them) and unknown inline nodes (no
  longer split their line): such pages get new fingerprints once, on their
  next save.
  The editor's `SavePagePort` belongs to `editor/domain`; this module's
  `saveContent`/`getCurrentContent` Server Actions satisfy it structurally.
- `application/`: use cases for creating/renaming/archiving notebooks and
  pages, saving and reading page content (`content-schema.ts` holds two
  Zod schemas: the permissive `tiptapDocSchema` the editor autosave in
  `save-page.ts` validates against, and the strict `tiptapContentSchema`
  `write-imported-content.ts` uses — an allow-list built from the content
  catalogue in `src/shared/kernel/tiptap-catalogue.ts` that rejects unknown
  nodes, marks and attrs, invalid attr values, wrong nesting, links other
  than http/https/mailto and empty text nodes, so imported content always
  renders in the editor), the signed image-upload flow
  (`request-image-upload.ts`/`register-page-asset.ts`/
  `get-asset-read-url.ts`), its server-side twin for imported images
  (`store-imported-asset.ts`, which validates mime/size and ownership,
  uploads to the canonical path and reuses `registerPageAsset`, plus the
  best-effort cleanup `delete-imported-assets.ts`), `list-sidebar.ts` and
  `list-page-picker-tree.ts` (Phase 8 H14: the same tree with each page's
  word count, for the technique hubs' page pickers; served by
  `getPagePickerTree`, the plain text never leaves the server).
  Tested against the
  in-memory fakes under `application/testing/`.
- `infrastructure/`: Drizzle repositories (`DrizzleNotebookRepository`,
  `DrizzlePageRepository`, `DrizzlePageAssetRepository`) and
  `SupabaseStorageGateway` for the private `page-assets` bucket. The only
  layer allowed to import Drizzle or the Supabase client.
- `ui/`: `SidebarTree` and its dialogs, plus `notebook-actions-slot.tsx` —
  a slot the app shell injects a cross-module menu item and page badge
  into (used by `ingestion`'s "Importar documento" entry and importing badge,
  without `notebooks` importing `ingestion`).
- `actions.ts`: the composition root. `"use server"` — every Server Action
  resolves the session first (`requireOwnerId`/`requireOwnerIdResult`,
  depending on whether the action throws or returns a `Result`), composes
  the Drizzle repositories and storage gateway per call, and maps
  `DomainError` to Spanish copy (`ui/notebooks-copy.ts`) or to the plain
  `ActionError` shape at the boundary.
- `server-api.ts`: a second composition root, `createNotebooksServerApi`,
  for **other modules** to create pages and write their first content —
  not a Server Action (no `"use server"`, not client-reachable). Currently
  consumed by `ingestion/infrastructure/notebooks-pages-adapter.ts`, which
  implements `ingestion`'s `NotebookPagesPort` by wrapping it one-to-one.
  `writeImportedContent` uses the same atomic compare-and-swap on
  `content_version` as `saveContent`'s `updateIfVersion`, filtering
  `archived_at IS NULL` so an archive racing the write cannot be
  overwritten. `storeImportedAsset`/`deleteImportedAssets` (document-import
  T9) let the importer upload extracted images and register their
  `page_assets` rows; `SupabaseStorageGateway` uses the service-role key,
  so these server-side uploads bypass the bucket's RLS and rely on the
  use case's ownership and canonical-path checks.
- `index.ts`: the public API — Server Actions, use cases (for their Zod
  schemas and types), domain types/constants, `createNotebooksServerApi`
  and `SidebarTree`. `cross-module-via-index` forbids any other module
  from reaching past this file.

## Cross-module usage

`ingestion` is the only module that depends on `notebooks` today, entirely
through `index.ts`: `NotebooksPagesAdapter` wraps
`createNotebooksServerApi()` to implement `NotebookPagesPort`
(`findActiveNotebook`, `createPage`, `findPageNotebookId`,
`writeImportedContent`, `storeImportedAsset`, `deleteImportedAssets`), and the app's notebook menu/sidebar inject
`ingestion`'s "Importar documento" item and importing badge through
`notebook-actions-slot.tsx` — the reverse direction, `notebooks` never
imports `ingestion`.

## Tests

- `pnpm test -- notebooks` — unit tests (Vitest): `domain`, `application`
  (in-memory fakes), `infrastructure` adapters (mocked clients), `actions.ts`
  and `server-api.ts` (mocked session/adapters), `ui` components (Testing
  Library). No `DATABASE_URL` or Supabase config needed.
- `pnpm test:db` — DB smoke tests against `cogni-dev`: schema, cascades,
  RLS predicates, the `updateIfVersion`/`writeImportedContent`
  compare-and-swap races and the owner-scoped
  `DrizzlePageAssetRepository.deleteByIds`.
