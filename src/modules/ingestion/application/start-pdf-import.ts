import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  documentFormatFromPath,
  isOwnedDocumentPath,
  pageTitleFromFileName,
  UPLOAD_GRANT_TTL_MS,
  uploadIdAgeMs,
  validateDocumentInput,
} from "../domain/document-file";
import {
  DOCUMENT_FILE_ERROR,
  IMPORT_JOB_ERROR,
  INGESTION_ERROR,
} from "../domain/errors";
import { createImportJob, type ImportJobStatus } from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";
import {
  type ImportRateLimiter,
  MAX_ACTIVE_IMPORTS,
} from "../domain/import-rate-limiter";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";
import type { PdfStorageGateway } from "../domain/pdf-storage-gateway";
import { parseInput } from "./validation";

export const startPdfImportSchema = z.object({
  notebookId: z.string(),
  storagePath: z.string(),
  fileName: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
});

export interface StartPdfImportResult {
  importJobId: string;
  pageId: string;
  notebookId: string;
  status: ImportJobStatus;
}

// design.md, "Decision: Flujo de subida y procesamiento", step 3 —
// `startPdfImport` is fast (no download, no extraction). In order:
//
// 1. The storage path must have the exact
//    `{ownerId}/{uuid v7}.{pdf|docx|pptx}` shape (isOwnedDocumentPath),
//    checked before touching the repository or Storage.
// 2. Idempotency by storagePath, checked *before* the expiry check
//    (review follow-up: a repeated call for an already-started import must
//    return the existing job even if the upload grant has since expired).
// 3. The upload grant's 10-minute expiry, derived from the storage path's
//    embedded UUID v7 timestamp (C3). `uploadIdAgeMs` returns +Infinity
//    for a malformed path segment, so this plain comparison already fails
//    closed (T3 follow-up: R3-upload-age-nan-fail-open) — no separate
//    Number.isFinite guard is needed here.
// 4. The notebook is active and owned, re-checked (the grant may outlive
//    the notebook).
// 4b. T9b (security audit): the owner may not have MAX_ACTIVE_IMPORTS
//    imports in flight already, and must have starts left in the hourly
//    limit (`startLimiter`; only a new import consumes one, never an
//    idempotent repeat). Both refuse with INGESTION_ERROR.RATE_LIMITED.
// 5. The object's real metadata from Storage — never the client-declared
//    mime/size for a path this far in — whose mime must also be the format
//    the path's extension declares (document-import T5).
// 6-7. Create the destination page, then the ImportJob in `queued` with
//    the real object's size.
//
// Note (design.md, risk table): steps 6 and 7 are not atomic across
// modules. If job creation fails after the page was created, an orphan
// empty page remains — visible and archivable, accepted as low risk.
export async function startPdfImport(
  input: unknown,
  deps: {
    notebookPages: NotebookPagesPort;
    storage: PdfStorageGateway;
    jobs: ImportJobRepository;
    clock: Clock;
    startLimiter: ImportRateLimiter;
  },
  ownerId: string,
): Promise<Result<StartPdfImportResult, DomainError>> {
  const parsed = parseInput(startPdfImportSchema, input);
  if (!parsed.ok) return parsed;
  const { notebookId, storagePath, fileName } = parsed.value;

  if (!isOwnedDocumentPath(ownerId, storagePath)) {
    return err(
      new DomainError(DOCUMENT_FILE_ERROR.PATH_OUT_OF_SCOPE, storagePath),
    );
  }

  const existing = await deps.jobs.findByStoragePath(storagePath);
  if (existing) {
    return echoIdempotentJob(deps, existing, notebookId, ownerId);
  }

  const ageMs = uploadIdAgeMs(storagePath, deps.clock.now());
  if (ageMs > UPLOAD_GRANT_TTL_MS) {
    return err(
      new DomainError(DOCUMENT_FILE_ERROR.UPLOAD_EXPIRED, storagePath),
    );
  }

  const notebook = await deps.notebookPages.findActiveNotebook(
    ownerId,
    notebookId,
  );
  if (!notebook) {
    return err(new DomainError(INGESTION_ERROR.NOTEBOOK_NOT_FOUND, notebookId));
  }

  const active = await deps.jobs.countActiveJobs(ownerId, deps.clock.now());
  if (active >= MAX_ACTIVE_IMPORTS) {
    return err(
      new DomainError(INGESTION_ERROR.RATE_LIMITED, `${active} active imports`),
    );
  }
  const allowance = await deps.startLimiter.consume(ownerId);
  if (!allowance.allowed) {
    return err(new DomainError(INGESTION_ERROR.RATE_LIMITED, "import starts"));
  }

  // T7c follow-up (R3-metadata-throw-callers-unproved): the port now
  // throws on a transient error instead of reporting it as missing
  // (T7b/T7c: R3-metadata-transient-error-as-missing); this use case must
  // map that thrown exception to a typed failure instead of leaking it,
  // and must not create a page for an object it could not verify.
  let metadata: { sizeBytes: number; mime: string } | null;
  try {
    metadata = await deps.storage.getObjectMetadata(storagePath);
  } catch (cause) {
    // T8 review follow-up (R3-storage-unavailable-discards-cause): keep the
    // original exception as `cause` for server-side diagnostics (never sent
    // to the client — toActionError() only copies code/message) and log it
    // so it is visible in the Vercel function logs.
    console.error("startPdfImport: getObjectMetadata failed", cause);
    return err(
      new DomainError(INGESTION_ERROR.STORAGE_UNAVAILABLE, storagePath, {
        cause,
      }),
    );
  }
  if (!metadata) {
    return err(
      new DomainError(DOCUMENT_FILE_ERROR.OBJECT_MISSING, storagePath),
    );
  }
  const validMetadata = validateDocumentInput(metadata);
  if (!validMetadata.ok) return validMetadata;
  if (validMetadata.value !== documentFormatFromPath(storagePath)) {
    return err(
      new DomainError(DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT, storagePath),
    );
  }

  const page = await deps.notebookPages.createPage(ownerId, {
    notebookId,
    title: pageTitleFromFileName(fileName),
  });
  if (!page.ok) return page;

  const job = createImportJob(
    {
      id: createId(),
      ownerId,
      pageId: page.value.id,
      storagePath,
      fileName,
      sizeBytes: metadata.sizeBytes,
      format: validMetadata.value,
    },
    deps.clock,
  );
  const created = await deps.jobs.create(job, {
    maxActiveJobs: MAX_ACTIVE_IMPORTS,
  });
  if (
    !created.ok &&
    created.error.code === IMPORT_JOB_ERROR.ACTIVE_LIMIT_REACHED
  ) {
    // T10 (T9b review): another start won the last active slot between
    // the early count above and this atomic check. The page just created
    // stays an orphan, the same accepted risk as the conflict below.
    return err(
      new DomainError(INGESTION_ERROR.RATE_LIMITED, "active imports", {
        cause: created.error,
      }),
    );
  }
  if (!created.ok) {
    // Lost the race: another concurrent call already created a job for
    // this storagePath between the idempotency check above and this
    // create() (review follow-up R3-idempotency-check-then-act-race). The
    // page just created above becomes an orphan — accepted risk per
    // design.md's non-atomic "página → job" ordering — and this call
    // resolves idempotently against the winner instead of leaking the
    // conflict.
    const winner = await deps.jobs.findByStoragePath(storagePath);
    if (!winner) return created;
    return echoIdempotentJob(deps, winner, notebookId, ownerId);
  }

  return ok({
    importJobId: job.id,
    pageId: page.value.id,
    notebookId,
    status: job.status,
  });
}

// Review follow-up from T5 (R3-idempotent-notebookid-echoed-from-input):
// the idempotent path must echo the existing job's *real* notebookId —
// looked up from its page — instead of blindly trusting the caller's
// input, and reject a request whose notebookId no longer matches it.
//
// Review follow-up from T6 (R3-idempotent-null-page-reported-as-mismatch):
// `findPageNotebookId` returning null means the page is missing, archived
// or no longer owned by the caller — a different failure than a
// notebookId that simply does not match — so it must not fall through to
// the `!== notebookId` comparison, which would always be true for null
// and misreport a mismatch.
async function echoIdempotentJob(
  deps: { notebookPages: NotebookPagesPort },
  job: { id: string; pageId: string; status: ImportJobStatus },
  notebookId: string,
  ownerId: string,
): Promise<Result<StartPdfImportResult, DomainError>> {
  const actualNotebookId = await deps.notebookPages.findPageNotebookId(
    ownerId,
    job.pageId,
  );
  if (actualNotebookId === null) {
    return err(new DomainError(INGESTION_ERROR.PAGE_NOT_FOUND, job.pageId));
  }
  if (actualNotebookId !== notebookId) {
    return err(new DomainError(INGESTION_ERROR.NOTEBOOK_MISMATCH, notebookId));
  }
  return ok({
    importJobId: job.id,
    pageId: job.pageId,
    notebookId: actualNotebookId,
    status: job.status,
  });
}
