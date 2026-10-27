import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { failureMessage } from "../domain/import-failure";
import {
  type ImportJob,
  type ImportJobStatus,
  isAbandoned,
} from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";
import { parseInput } from "./validation";

export const getImportJobStatusSchema = z.object({
  pageId: z.string(),
});

export interface ImportJobStatusView {
  importJobId: string;
  pageId: string;
  status: ImportJobStatus;
  pageCount: number | null;
  pagesWithoutText: number;
  // Images of a done import that were not kept (document-import T11).
  skippedImages: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// Maps the internal ImportJob to the read-only view design.md's Server
// Actions return (`ImportJobStatusView`) — never includes `storagePath`.
// Exported so T8's `processPdfImport` action can build the identical view
// from the raw ImportJob `processImportJob` returns.
export function toImportJobStatusView(job: ImportJob): ImportJobStatusView {
  return {
    importJobId: job.id,
    pageId: job.pageId,
    status: job.status,
    pageCount: job.pageCount,
    pagesWithoutText: job.pagesWithoutText,
    skippedImages: job.skippedImages,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// design.md, "Decision: Flujo de subida y procesamiento", step 5 — a
// read-only query, never a Server Action that writes. An abandoned job
// (`isAbandoned`) is reported as `failed(timeout)` without ever
// persisting that state: only a later `processPdfImport` call (never this
// query) is allowed to write it, and `getImportJobStatus` guarantees the
// polling UI (T11) always sees a terminal status eventually even if the
// platform silently killed the function that owned the job.
export async function getImportJobStatus(
  input: unknown,
  deps: { jobs: ImportJobRepository; clock: Clock },
  ownerId: string,
): Promise<Result<ImportJobStatusView | null, DomainError>> {
  const parsed = parseInput(getImportJobStatusSchema, input);
  if (!parsed.ok) return parsed;

  // T9b (security audit: existence oracle): looked up by (pageId,
  // ownerId), so another user's page answers ok(null) exactly like a page
  // that never had an import, instead of an error revealing that it has
  // one. The owner check stays as a second guard on the adapter.
  const job = await deps.jobs.findLatestByPage(parsed.value.pageId, ownerId);
  if (!job || job.ownerId !== ownerId) return ok(null);

  if (isAbandoned(job, deps.clock.now())) {
    return ok({
      ...toImportJobStatusView(job),
      status: "failed",
      error: failureMessage("timeout"),
    });
  }

  return ok(toImportJobStatusView(job));
}
