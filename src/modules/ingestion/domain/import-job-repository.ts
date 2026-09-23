import type { ImportFailureKind } from "./import-failure";
import type { ImportJob } from "./import-job";

// design.md, "Puerto del repositorio" — every transition below is meant to
// be one atomic conditional `UPDATE ... RETURNING`, the same pattern as
// `updateIfVersion` in notebooks: two concurrent or repeated calls must
// never duplicate work or reopen a terminal job. `startPdfImport` (T5)
// only calls `create`/`findByStoragePath` (idempotency by storage path);
// `claim`/`markDone`/`markFailed`/`findById`/`findLatestByPage`/
// `listActivePageIds` are consumed starting T6.
export interface ImportJobRepository {
  create(job: ImportJob): Promise<void>;
  findById(id: string): Promise<ImportJob | null>;
  findByStoragePath(storagePath: string): Promise<ImportJob | null>;
  findLatestByPage(pageId: string): Promise<ImportJob | null>;
  // ids of pages with a `queued` or `processing`, non-abandoned job owned
  // by `ownerId` (read-only; for the sidebar importing badge).
  listActivePageIds(ownerId: string): Promise<string[]>;
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
