import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { ImportFailureKind } from "./import-failure";
import type { ImportJob } from "./import-job";

// design.md, "Puerto del repositorio" — every transition below is meant to
// be one atomic conditional `UPDATE ... RETURNING`, the same pattern as
// `updateIfVersion` in notebooks: two concurrent or repeated calls must
// never duplicate work or reopen a terminal job. `startPdfImport` (T5)
// calls `create`/`findByStoragePath` (idempotency by storage path);
// `claim`/`markDone`/`markFailed`/`findById`/`findLatestByPage`/
// `listActivePageIds` are consumed starting T6.
export interface ImportJobRepository {
  // err(IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT) instead of throwing when a
  // job with the same `storagePath` already exists (unique constraint
  // since T1) — the concurrent-call case `startPdfImport` (T6 follow-up)
  // resolves by re-fetching the winner through `findByStoragePath` instead
  // of leaking an exception after its own page was already created.
  create(job: ImportJob): Promise<Result<void, DomainError>>;
  findById(id: string): Promise<ImportJob | null>;
  findByStoragePath(storagePath: string): Promise<ImportJob | null>;
  findLatestByPage(pageId: string): Promise<ImportJob | null>;
  // ids of pages with a `queued` or `processing`, non-abandoned job owned
  // by `ownerId` (read-only; for the sidebar importing badge).
  listActivePageIds(ownerId: string): Promise<string[]>;
  // document-import T9b: how many `queued`/`processing` jobs `ownerId` has
  // that are not abandoned at `now` (startPdfImport's MAX_ACTIVE_IMPORTS).
  countActiveJobs(ownerId: string, now: Date): Promise<number>;
  // queued -> processing. null when the job is no longer queued (another
  // call already won the transition).
  claim(input: { id: string; now: Date }): Promise<ImportJob | null>;
  // processing -> done. null when nothing changed.
  markDone(input: {
    id: string;
    pageCount: number;
    pagesWithoutText: number;
    now: Date;
  }): Promise<ImportJob | null>;
  // processing -> failed, or queued -> failed only when kind is "timeout".
  // null when nothing changed.
  markFailed(input: {
    id: string;
    kind: ImportFailureKind;
    message: string;
    pageCount?: number;
    pagesWithoutText?: number;
    now: Date;
  }): Promise<ImportJob | null>;
}
