import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { INGESTION_ERROR } from "../domain/errors";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";
import {
  UPLOAD_GRANT_TTL_MS,
  validateFileName,
  validatePdfInput,
} from "../domain/pdf-file";
import type { PdfStorageGateway } from "../domain/pdf-storage-gateway";
import { parseInput } from "./validation";

export const requestPdfUploadSchema = z.object({
  notebookId: z.string(),
  fileName: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
});

export interface PdfUploadGrant {
  storagePath: string;
  signedUrl: string;
  token: string;
  bucket: string;
  expiresAt: string; // ISO, at most UPLOAD_GRANT_TTL_MS after issue (C3).
}

// design.md, "Decision: Flujo de subida y procesamiento", step 1:
// validates the client-declared file (name, mime, size) and the target
// notebook (active and owned), then issues a signed upload grant to the
// canonical `{ownerId}/{uuid v7}.pdf` path. Any validation failure returns
// a DomainError without ever contacting Storage.
export async function requestPdfUpload(
  input: unknown,
  deps: {
    notebookPages: NotebookPagesPort;
    storage: PdfStorageGateway;
    clock: Clock;
  },
  ownerId: string,
): Promise<Result<PdfUploadGrant, DomainError>> {
  const parsed = parseInput(requestPdfUploadSchema, input);
  if (!parsed.ok) return parsed;

  const nameResult = validateFileName(parsed.value.fileName);
  if (!nameResult.ok) return nameResult;

  const pdfResult = validatePdfInput(parsed.value);
  if (!pdfResult.ok) return pdfResult;

  const notebook = await deps.notebookPages.findActiveNotebook(
    ownerId,
    parsed.value.notebookId,
  );
  if (!notebook) {
    return err(
      new DomainError(
        INGESTION_ERROR.NOTEBOOK_NOT_FOUND,
        parsed.value.notebookId,
      ),
    );
  }

  const storagePath = `${ownerId}/${createId()}.pdf`;
  // T7c follow-up (R3-metadata-throw-callers-unproved): a thrown Storage
  // call (e.g. PdfStorageAdapterError for a transient failure) must
  // resolve to a typed failure instead of propagating out of the use case.
  let grant: { signedUrl: string; token: string; bucket: string };
  try {
    grant = await deps.storage.createSignedUploadUrl(storagePath);
  } catch {
    return err(
      new DomainError(INGESTION_ERROR.STORAGE_UNAVAILABLE, storagePath),
    );
  }
  const { signedUrl, token, bucket } = grant;
  const expiresAt = new Date(
    deps.clock.now().getTime() + UPLOAD_GRANT_TTL_MS,
  ).toISOString();

  return ok({ storagePath, signedUrl, token, bucket, expiresAt });
}
