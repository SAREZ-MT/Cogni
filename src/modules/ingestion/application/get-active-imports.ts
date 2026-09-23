import type { ImportJobRepository } from "../domain/import-job-repository";

// design.md, "Decision: Vista de página, llamada en curso y polling con
// TanStack Query", last paragraph: `listActiveImports(ownerId)` — the page
// ids of the caller's `queued`/`processing`, non-abandoned jobs, for the
// sidebar's `ImportingPageBadge` (T13a). Read-only, no input to validate,
// and no error channel: every filtering rule (status, ownership,
// abandonment) already lives in
// `ImportJobRepository.listActivePageIds` (domain/import-job-repository.ts),
// proven independently by the in-memory repository's own tests and the DB
// smoke suite, and that port has no failure case of its own (unlike, say,
// `create`'s storage-path conflict). A plain `Promise<string[]>` instead of
// this module's usual `Result`-returning shape keeps that honest instead of
// carrying a `DomainError` branch the use case can never actually produce
// (`actions.ts`'s `withBoundary` already maps a genuinely thrown exception
// to `INGESTION_UNEXPECTED`). Named `getActiveImports` (not design.md's
// `listActiveImports`) to match this file per the `get-*.ts` convention
// (`getImportJobStatus`) and the Server Action of the same name.
export async function getActiveImports(
  deps: { jobs: ImportJobRepository },
  ownerId: string,
): Promise<string[]> {
  return deps.jobs.listActivePageIds(ownerId);
}
