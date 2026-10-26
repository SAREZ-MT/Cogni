# Module `ingestion`

## Responsibility

PDF import: a user picks a PDF from a notebook, it is uploaded directly to
a private Supabase Storage bucket, its text is extracted on the server and
converted into an editable page in the TipTap editor (`docs/documento-maestro.md`
§13, Phase 2).

## Layers

Follows the same hexagonal shape as `notebooks`
(`domain/application/infrastructure/ui`), enforced by
`.dependency-cruiser.cjs` (`domain-is-pure`, `application-no-infra-or-ui`,
`ui-never-touches-infra`, `cross-module-via-index`, plus this module's own
`unpdf-only-in-ingestion-infra`).

- `domain/`: pure TypeScript — the `ImportJob` entity and its lifecycle
  transitions (`start`/`complete`/`fail`), the failure taxonomy and its
  UI-safe Spanish copy, PDF validation helpers (`pdf-file.ts`), the
  `textToBlocks` heuristic that turns extracted text into TipTap-shaped
  blocks, the `ImportedDoc` type (`imported-doc.ts`, every block of the
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
  private `page-pdfs` bucket, `UnpdfTextExtractor` wraps `unpdf`,
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
| `PdfTextExtractor` | `UnpdfTextExtractor` | `FakePdfTextExtractor` |
| `NotebookPagesPort` | `NotebooksPagesAdapter` | `FakeNotebookPagesPort` |
| `ImportTelemetry` | `ImportTelemetryAdapter` | `FakeImportTelemetry` |
| `ImportJobRepository` | `DrizzleImportJobRepository` | `InMemoryImportJobRepository` |

A shared contract suite (`application/testing/import-job-repository.contract.ts`)
runs against both `InMemoryImportJobRepository` (`pnpm test`) and
`DrizzleImportJobRepository` (`pnpm test:db`, against `cogni-dev`), so the
two never drift on the transition semantics (`create`/`claim`/`markDone`/
`markFailed` are each meant to be one atomic conditional `UPDATE ...
RETURNING`).

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
