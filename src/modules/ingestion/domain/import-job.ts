import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { IMPORT_JOB_ERROR } from "./errors";
import { ABANDONED_AFTER_MS } from "./import-budget";
import type { ImportFailureKind } from "./import-failure";

// design.md, "Decision: Entidad ImportJob y transiciones de la spec".
export const IMPORT_JOB_STATUS = [
  "queued",
  "processing",
  "done",
  "failed",
] as const;

export type ImportJobStatus = (typeof IMPORT_JOB_STATUS)[number];

export interface ImportJob {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly sizeBytes: number; // from the real Storage object
  readonly status: ImportJobStatus;
  readonly pageCount: number | null; // null until known
  readonly pagesWithoutText: number; // starts at 0
  readonly error: string | null; // UI-safe Spanish message, only when failed
  readonly startedAt: Date | null; // start of processing
  readonly finishedAt: Date | null; // terminal instant
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewImportJob {
  id: string;
  ownerId: string;
  pageId: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number;
}

function invalidTransition(from: ImportJobStatus, action: string): DomainError {
  return new DomainError(
    IMPORT_JOB_ERROR.INVALID_TRANSITION,
    `cannot ${action} a job in ${from}`,
  );
}

// A page count (or pages-without-text count) is only ever a non-negative
// integer. `Number.isInteger` is false for `NaN`, `Infinity` and any
// fractional value, so this single guard rejects all three at once
// (review follow-up from T2: R3-complete-count-guard /
// R3-fail-counts-unvalidated).
function isValidCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

// StartPdfImport (application) builds the job's fields; this factory only
// fixes the schema defaults for a brand-new job (design.md's ImportJob
// interface: `queued`, no page count yet, zero pages without text, no
// error, not started, not finished).
export function createImportJob(input: NewImportJob, clock: Clock): ImportJob {
  const now = clock.now();
  return {
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    storagePath: input.storagePath,
    fileName: input.fileName,
    sizeBytes: input.sizeBytes,
    status: "queued",
    pageCount: null,
    pagesWithoutText: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// queued -> processing.
export function start(
  job: ImportJob,
  clock: Clock,
): Result<ImportJob, DomainError> {
  if (job.status !== "queued") {
    return err(invalidTransition(job.status, "start"));
  }
  const now = clock.now();
  return ok({ ...job, status: "processing", startedAt: now, updatedAt: now });
}

// processing -> done. Requires a known pageCount with pagesWithoutText
// strictly less than pageCount (Requirement "Ciclo de vida del ImportJob").
export function complete(
  job: ImportJob,
  counts: { pageCount: number; pagesWithoutText: number },
  clock: Clock,
): Result<ImportJob, DomainError> {
  if (job.status !== "processing") {
    return err(invalidTransition(job.status, "complete"));
  }
  if (
    !isValidCount(counts.pageCount) ||
    !isValidCount(counts.pagesWithoutText) ||
    counts.pagesWithoutText >= counts.pageCount
  ) {
    return err(
      new DomainError(
        IMPORT_JOB_ERROR.INVALID_TRANSITION,
        "complete requires a known pageCount with pagesWithoutText less than pageCount",
      ),
    );
  }
  const now = clock.now();
  return ok({
    ...job,
    status: "done",
    pageCount: counts.pageCount,
    pagesWithoutText: counts.pagesWithoutText,
    finishedAt: now,
    updatedAt: now,
  });
}

// processing -> failed (any kind), or queued -> failed only for kind
// "timeout" (the only way a job can fail before processing starts: the
// Server Action itself ran out of budget). Requires a non-empty message
// after trim; counts are optional (e.g. the no-text-layer case still knows
// pageCount/pagesWithoutText from extraction).
export function fail(
  job: ImportJob,
  failure: {
    kind: ImportFailureKind;
    message: string;
    pageCount?: number;
    pagesWithoutText?: number;
  },
  clock: Clock,
): Result<ImportJob, DomainError> {
  const canFail =
    job.status === "processing" ||
    (job.status === "queued" && failure.kind === "timeout");
  if (!canFail) {
    return err(invalidTransition(job.status, "fail"));
  }
  const message = failure.message.trim();
  if (message.length === 0) {
    return err(
      new DomainError(
        IMPORT_JOB_ERROR.INVALID_TRANSITION,
        "fail requires a non-empty message",
      ),
    );
  }
  if (
    (failure.pageCount !== undefined && !isValidCount(failure.pageCount)) ||
    (failure.pagesWithoutText !== undefined &&
      !isValidCount(failure.pagesWithoutText))
  ) {
    return err(
      new DomainError(
        IMPORT_JOB_ERROR.INVALID_TRANSITION,
        "fail requires pageCount/pagesWithoutText to be non-negative integers when provided",
      ),
    );
  }
  const now = clock.now();
  return ok({
    ...job,
    status: "failed",
    error: message,
    pageCount: failure.pageCount ?? job.pageCount,
    pagesWithoutText: failure.pagesWithoutText ?? job.pagesWithoutText,
    finishedAt: now,
    updatedAt: now,
  });
}

export function isTerminal(status: ImportJobStatus): boolean {
  return status === "done" || status === "failed";
}

// Non-terminal and not updated for longer than ABANDONED_AFTER_MS: the
// function that owned it can no longer be running (the platform stops it
// at maxDuration). Read-only rule used by GetImportJobStatus; it never
// writes.
export function isAbandoned(job: ImportJob, now: Date): boolean {
  if (isTerminal(job.status)) return false;
  return now.getTime() - job.updatedAt.getTime() > ABANDONED_AFTER_MS;
}
