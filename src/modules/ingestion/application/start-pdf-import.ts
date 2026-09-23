import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { INGESTION_ERROR, PDF_FILE_ERROR } from "../domain/errors";
import { createImportJob, type ImportJobStatus } from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";
import {
  isOwnedPdfPath,
  pageTitleFromFileName,
  UPLOAD_GRANT_TTL_MS,
  uploadIdAgeMs,
  validatePdfInput,
} from "../domain/pdf-file";
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
// 1. The storage path must have the exact `{ownerId}/{uuid v7}.pdf` shape
//    (isOwnedPdfPath), checked before touching the repository or Storage.
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
// 5. The object's real metadata from Storage — never the client-declared
//    mime/size for a path this far in.
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
  },
  ownerId: string,
): Promise<Result<StartPdfImportResult, DomainError>> {
  const parsed = parseInput(startPdfImportSchema, input);
  if (!parsed.ok) return parsed;
  const { notebookId, storagePath, fileName } = parsed.value;

  if (!isOwnedPdfPath(ownerId, storagePath)) {
    return err(new DomainError(PDF_FILE_ERROR.PATH_OUT_OF_SCOPE, storagePath));
  }

  const existing = await deps.jobs.findByStoragePath(storagePath);
  if (existing) {
    return ok({
      importJobId: existing.id,
      pageId: existing.pageId,
      notebookId,
      status: existing.status,
    });
  }

  const ageMs = uploadIdAgeMs(storagePath, deps.clock.now());
  if (ageMs > UPLOAD_GRANT_TTL_MS) {
    return err(new DomainError(PDF_FILE_ERROR.UPLOAD_EXPIRED, storagePath));
  }

  const notebook = await deps.notebookPages.findActiveNotebook(
    ownerId,
    notebookId,
  );
  if (!notebook) {
    return err(new DomainError(INGESTION_ERROR.NOTEBOOK_NOT_FOUND, notebookId));
  }

  const metadata = await deps.storage.getObjectMetadata(storagePath);
  if (!metadata) {
    return err(new DomainError(PDF_FILE_ERROR.OBJECT_MISSING, storagePath));
  }
  const validMetadata = validatePdfInput(metadata);
  if (!validMetadata.ok) return validMetadata;

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
    },
    deps.clock,
  );
  await deps.jobs.create(job);

  return ok({
    importJobId: job.id,
    pageId: page.value.id,
    notebookId,
    status: job.status,
  });
}
