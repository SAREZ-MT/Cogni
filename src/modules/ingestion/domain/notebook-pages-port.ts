import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { ImportedDoc } from "./imported-doc";

// design.md, "Interfaces / Contracts" — the port `requestPdfUpload`,
// `startPdfImport` and `processImportJob` (T6) use to create pages and
// write imported content without importing `notebooks` directly
// (`cross-module-via-index` in .dependency-cruiser.cjs forbids reaching
// past a module's public index.ts anyway, and `application-no-infra-or-ui`
// forbids `application` from depending on another module's
// infrastructure). Mirrors `NotebooksServerApi`
// (notebooks/server-api.ts) one-to-one; `NotebooksPagesAdapter` (T7) wraps
// `createNotebooksServerApi` to implement it, and
// `FakeNotebookPagesPort` (application/testing) implements it in memory
// for unit tests.
export interface NotebookPagesPort {
  // null when the notebook does not exist, belongs to another owner, or is
  // archived.
  findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null>;
  createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>>;
  // null when the page does not exist or belongs to another owner. T6
  // addition (review follow-up from T5: R3-idempotent-notebookid-echoed-
  // from-input) — `startPdfImport`'s idempotent path uses this to echo the
  // existing job's *real* notebookId back to the caller and reject a
  // request whose `notebookId` no longer matches it, instead of blindly
  // trusting the caller-supplied value. `NotebooksPagesAdapter` (T7) will
  // need `notebooks` to expose an equivalent lookup, since
  // `NotebooksServerApi` (T4) does not yet have one.
  findPageNotebookId(ownerId: string, pageId: string): Promise<string | null>;
  writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: ImportedDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>>;
}
