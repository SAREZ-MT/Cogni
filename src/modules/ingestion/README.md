# Module `ingestion`

## Responsibility

Document import: a user picks a document from a notebook, it is uploaded
directly to a private Supabase Storage bucket, its content is extracted on
the server and converted into an editable page in the TipTap editor
(`docs/documento-maestro.md` §13, Phase 2). Since document-import T5 the
pipeline is format-aware (PDF, Word `.docx`, PowerPoint `.pptx`); today
only the PDF adapter exists (DOCX/PPTX adapters land in T6/T7) and the UI
still offers PDFs only (T11). The Server Actions keep their PDF names
(`requestPdfUpload`, `startPdfImport`, `processPdfImport`) until T11.

## Layers

Follows the same hexagonal shape as `notebooks`
(`domain/application/infrastructure/ui`), enforced by
`.dependency-cruiser.cjs` (`domain-is-pure`, `application-no-infra-or-ui`,
`ui-never-touches-infra`, `cross-module-via-index`, plus this module's own
`unpdf-only-in-ingestion-infra`).

- `domain/`: pure TypeScript — the `ImportJob` entity and its lifecycle
  transitions (`start`/`complete`/`fail`), the failure taxonomy and its
  UI-safe Spanish copy, the document file rules (`document-file.ts`:
  allowed mimes, 20 MiB limit for every format, the
  `{ownerId}/{uuid v7}.{pdf|docx|pptx}` storage path whose extension
  records the declared format, page title from the file name), format
  detection from the real bytes (`document-format.ts`: `%PDF-`; a ZIP whose
  entries include `[Content_Types].xml` plus `word/document.xml` or
  `ppt/presentation.xml`; OLE2 → `legacy`; read in pure TypeScript from
  the ZIP central directory, or the local headers of a truncated archive),
  the `textToBlocks` heuristic that turns extracted PDF text into
  TipTap-shaped blocks, the `ImportedDoc` type (`imported-doc.ts`, every block of the
  content catalogue in `src/shared/kernel/tiptap-catalogue.ts`; notebooks'
  `writeImportedContent` rejects anything outside it) with its recursive
  `hasTextContent` predicate, the time budgets (`import-budget.ts`) and every port interface.
  No framework, no npm dependency other than Zod.
- `application/`: the five use cases (`requestPdfUpload`, `startPdfImport`,
  `processImportJob`, `getImportJobStatus`, `getActiveImports`), each
  `Result`-returning and testable with the in-memory fakes under
  `application/testing/`. Never imports `infrastructure` or `ui`.
- `infrastructure/`: the only layer allowed to import `unpdf`, the Supabase
  client and `@/modules/notebooks`. `SupabasePdfStorageGateway` wraps the
  private `page-pdfs` bucket, `FormatRoutingDocumentExtractor`
  (`createDocumentExtractor()`) dispatches to one `DocumentExtractor` per
  format — `PdfDocumentExtractor` wraps `unpdf` plus `textToBlocks` —
  `NotebooksPagesAdapter` wraps `createNotebooksServerApi` to implement
  `NotebookPagesPort`, `ImportTelemetryAdapter` reports to PostHog and
  Sentry, and `DrizzleImportJobRepository` persists `import_jobs`.
- `actions.ts`: the composition root. `"use server"` — every Server Action
  resolves the session first, composes the adapters above per call and maps
  every `DomainError` to the plain `ActionError` shape before returning, so
  no action ever throws to the client. This is also the only file allowed
  to read `serverEnv()`'s Supabase/PostHog configuration for this module.
- `index.ts`: the public API. Only the five Server Actions, pure
  types/constants from `domain`/`application` are re-exported; nothing from
  `infrastructure` ever crosses this barrel, so importing this module from
  a Client Component never pulls Drizzle, the Supabase client or `unpdf`
  into the client bundle.
- `ui/`: the menu item, progress card, providers and page view.
  `ActiveImportsProvider`/`useIsImporting` (T13a) track the sidebar's
  active imports (initial ids from a server-side `getActiveImports()` call
  plus polling) so `ImportingPageBadge` can show next to a page under
  import; `PdfImportProvider` calls `add()` right after `startPdfImport`
  succeeds and `PageImportView` calls `remove()` once its own job reaches a
  terminal state.

## Ports and adapters

| Port (`domain/`) | Adapter (`infrastructure/`) | Fake (`application/testing/`) |
|---|---|---|
| `PdfStorageGateway` | `SupabasePdfStorageGateway` | `FakePdfStorageGateway` |
| `DocumentExtractor` | `FormatRoutingDocumentExtractor` → `PdfDocumentExtractor` | `FakeDocumentExtractor` |
| `NotebookPagesPort` | `NotebooksPagesAdapter` | `FakeNotebookPagesPort` |
| `ImportTelemetry` | `ImportTelemetryAdapter` | `FakeImportTelemetry` |
| `ImportJobRepository` | `DrizzleImportJobRepository` | `InMemoryImportJobRepository` |

A shared contract suite (`application/testing/import-job-repository.contract.ts`)
runs against both `InMemoryImportJobRepository` (`pnpm test`) and
`DrizzleImportJobRepository` (`pnpm test:db`, against `cogni-dev`), so the
two never drift on the transition semantics (`create`/`claim`/`markDone`/
`markFailed` are each meant to be one atomic conditional `UPDATE ...
RETURNING`).

## Document port

`DocumentExtractor.extract(bytes, format)` returns
`Result<ExtractedDocument, DomainError>`, where `ExtractedDocument` is
`{ content: ImportedDoc; totalPages; pagesWithoutText; images:
ExtractedImage[] }` and `ExtractedImage` is `{ key, bytes, mime, alt }`.
An image node in `content` points at its image with `attrs.pendingId ===
key`; T9 uploads the bytes and swaps `pendingId` for `assetId` before the
write (no adapter emits images yet). Errors: `DOCUMENT_UNSUPPORTED_FORMAT`
when no adapter handles the format, `DOCUMENT_UNREADABLE` for a corrupt,
encrypted or truncated file.

`processImportJob` downloads the object, rejects it above 20 MiB, detects
its format from the bytes, and maps each outcome to a failure kind:

| Outcome | Kind | Message |
|---|---|---|
| Legacy (`.doc`/`.ppt`), unknown bytes, or bytes that are not the format the path declares | `unsupported_format` | "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx)." |
| Extractor returns `DOCUMENT_UNSUPPORTED_FORMAT` | `unsupported_format` | same |
| Any other extractor error, a thrown extractor, or a file over 20 MiB | `invalid_document` | "Este archivo no es un documento válido o está protegido. …" |
| No block carries text (`hasTextContent`), PDF | `no_text_layer` | "Este PDF no tiene texto seleccionable y Cogni no hace OCR. …" |
| No block carries text, DOCX/PPTX | `empty_document` | "El documento no tiene texto que podamos importar." |

`startPdfImport` also refuses (`DOCUMENT_UNSUPPORTED_FORMAT`) a stored
object whose real mime is not the format its path declares. Only the
message is stored on the job; the kind classifies the Sentry report
(`warning` for `no_text_layer`, `empty_document`, `unsupported_format`).
The `pdf_imported` event keeps its name until T10 and already carries the
declared `format`. The `page-pdfs` bucket still allows only
`application/pdf` (`drizzle/0006_page_pdfs_storage.sql`) until T10's
migration, so a DOCX/PPTX upload is refused by Storage before then.

## Job lifecycle

```
queued --claim()--> processing --markDone()--> done
                                --markFailed()--> failed
queued --markFailed(timeout)--> failed   (Server Action ran out of budget before claiming)
```

`queued`/`processing`/`done`/`failed` is the full set (`IMPORT_JOB_STATUS`).
There is no lease column: a non-terminal job that goes longer than
`ABANDONED_AFTER_MS` (`MAX_DURATION_S + 30` seconds) without an
`updated_at` write is swept purely by age. `getImportJobStatus` reports
such a job as `failed(timeout)` to the caller without ever writing that
state itself — only a later `processPdfImport` call is allowed to persist
a terminal transition, so a job the platform actually killed mid-flight
still eventually resolves once someone reopens the page.

Idempotency is keyed by `storagePath` (a `UNIQUE` constraint since T1):
`startPdfImport` called twice for the same upload returns the existing job
instead of creating a second page/job pair, and a repeated
`processPdfImport` on a non-`queued` job is a no-op (`ok(job)`, no
download, no write, no second `pdf_imported`).

## `maxDuration`

`processPdfImport` runs `processImportJob` synchronously inside the same
Vercel function invocation (Fluid Compute; ADR 0003 — no worker, no
Trigger.dev). Next.js applies a Server Action's `maxDuration` from the page
segment it is invoked from, not from the module that defines the action:
`processPdfImport` is only ever invoked from
`src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`, which
exports `export const maxDuration = 120;` — a literal (route segment
config must be statically analyzable at build time), pinned equal to
`MAX_DURATION_S` by `max-duration.test.ts`. `processImportJob`'s own
internal budget (`PROCESSING_BUDGET_MS`, 100 s) stays well under that
ceiling so there is always time left to persist a `failed` state and
respond even when the platform never interrupts the call. No other route
segment changes its `maxDuration`; `startPdfImport` is fast and keeps the
platform default wherever it is invoked from.

**Requires Fluid Compute enabled on the Vercel project** (Settings →
Functions) — without it, the Hobby plan's ceiling is lower and
`maxDuration = 120` is not honored.

## Environment

- `SUPABASE_PDF_BUCKET` (server-only, required, no default): the name of
  the private Storage bucket for imported PDFs. Validated at boot by
  `serverEnv()` (`src/shared/config/env.schema.ts`) — a deploy without it
  fails loudly instead of silently pointing at the wrong bucket.

## Tests

- `pnpm test -- ingestion` — unit tests (Vitest): `domain`, `application`
  (against the in-memory fakes), `infrastructure` adapters (against mocked
  clients) and `actions.ts` (against mocked adapters + session, matching
  `notebooks/actions.test.ts`'s pattern). No `DATABASE_URL` or
  `SUPABASE_PDF_BUCKET` needed.
- `pnpm test:db` — DB smoke tests against `cogni-dev`: the shared
  repository contract run through `DrizzleImportJobRepository`, plus the
  `import_jobs` table/bucket migration proofs.
