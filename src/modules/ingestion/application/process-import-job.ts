import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { IMPORT_JOB_ERROR } from "../domain/errors";
import { PROCESSING_BUDGET_MS } from "../domain/import-budget";
import {
  failureMessage,
  type ImportFailureKind,
  PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE,
} from "../domain/import-failure";
import type { ImportJob } from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";
import type { ImportTelemetry } from "../domain/import-telemetry";
import { hasTextContent } from "../domain/imported-doc";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";
import { looksLikePdf, MAX_PDF_BYTES } from "../domain/pdf-file";
import type { PdfStorageGateway } from "../domain/pdf-storage-gateway";
import type { PdfTextExtractor } from "../domain/pdf-text-extractor";
import { textToBlocks } from "../domain/text-to-blocks";
import { parseInput } from "./validation";

export const processImportJobSchema = z.object({
  importJobId: z.string(),
});

export interface ProcessImportJobDeps {
  jobs: ImportJobRepository;
  storage: PdfStorageGateway;
  extractor: PdfTextExtractor;
  notebookPages: NotebookPagesPort;
  telemetry: ImportTelemetry;
  clock: Clock;
}

// The literal code notebooks/domain/errors.ts's PAGE_ERROR exports for a
// version conflict. Hardcoded (not imported) — `cross-module-via-index`
// forbids `ingestion` from reaching into `notebooks` for anything but its
// public index, and `NotebookPagesPort.writeImportedContent` only
// promises a DomainError with one of PAGE_ERROR's codes. Any other code
// (missing/archived page, a database error) maps to the generic
// page-unavailable message (design.md, "PAGE_VERSION_CONFLICT,
// PAGE_NOT_FOUND o excepción → fail(persistence)").
const PAGE_VERSION_CONFLICT_CODE = "PAGE_VERSION_CONFLICT";

interface Failure {
  kind: ImportFailureKind;
  message: string;
  pageCount?: number;
  pagesWithoutText?: number;
}

// design.md, "Decision: Procesamiento síncrono en la Server Action con
// maxDuration" — `processImportJob({ importJobId }, deps, ownerId)`.
// Claims the queued job with a conditional transition, downloads the PDF,
// extracts its text, converts it to blocks, writes it through
// `NotebookPagesPort.writeImportedContent` with compare-and-swap, and
// always leaves the job in a terminal state (unless the platform kills
// the function first — `getImportJobStatus`'s abandoned-job rule covers
// that case). No failure ever propagates as an exception: every branch
// resolves to `ok(job)` in its final state, `err` only for "job not
// found/not owned" before anything was claimed.
export async function processImportJob(
  input: unknown,
  deps: ProcessImportJobDeps,
  ownerId: string,
): Promise<Result<ImportJob, DomainError>> {
  const parsed = parseInput(processImportJobSchema, input);
  if (!parsed.ok) return parsed;

  const job = await deps.jobs.findById(parsed.value.importJobId);
  if (!job || job.ownerId !== ownerId) {
    return err(
      new DomainError(IMPORT_JOB_ERROR.NOT_FOUND, parsed.value.importJobId),
    );
  }

  // Idempotency against a repeated call (design.md's failure table):
  // `processing`, `done` and `failed` are all left exactly as they are,
  // with no download, no write and no second `pdf_imported`.
  if (job.status !== "queued") {
    return ok(job);
  }

  const claimed = await deps.jobs.claim({ id: job.id, now: deps.clock.now() });
  if (!claimed) {
    // Lost the race: another call's claim already won. Re-read the
    // current state instead of assuming it is still `queued`.
    const current = await deps.jobs.findById(job.id);
    return ok(current ?? job);
  }

  const deadlineMs =
    (claimed.startedAt ?? deps.clock.now()).getTime() + PROCESSING_BUDGET_MS;
  const remainingMs = () => deadlineMs - deps.clock.now().getTime();

  const finishFailed = async (
    failure: Failure,
  ): Promise<Result<ImportJob, DomainError>> => {
    const failed = await deps.jobs.markFailed({
      id: claimed.id,
      kind: failure.kind,
      message: failure.message,
      pageCount: failure.pageCount,
      pagesWithoutText: failure.pagesWithoutText,
      now: deps.clock.now(),
    });
    if (!failed) {
      const current = await deps.jobs.findById(claimed.id);
      return ok(current ?? claimed);
    }
    await deps.telemetry.finished(failed, { kind: failure.kind });
    return ok(failed);
  };

  const downloadStart = deps.clock.now();
  let bytes: Uint8Array | null;
  try {
    bytes = await deps.storage.download(claimed.storagePath, {
      signal: AbortSignal.timeout(Math.max(remainingMs(), 0)),
    });
  } catch {
    bytes = null;
  }
  deps.telemetry.stage(
    claimed,
    "download",
    deps.clock.now().getTime() - downloadStart.getTime(),
  );
  if (!bytes) {
    return finishFailed({
      kind: "download",
      message: failureMessage("download"),
    });
  }
  if (!looksLikePdf(bytes) || bytes.length > MAX_PDF_BYTES) {
    return finishFailed({
      kind: "invalid_pdf",
      message: failureMessage("invalid_pdf"),
    });
  }

  if (remainingMs() <= 0) {
    return finishFailed({
      kind: "timeout",
      message: failureMessage("timeout"),
    });
  }

  const extractStart = deps.clock.now();
  const extracted = await deps.extractor.extract(bytes);
  deps.telemetry.stage(
    claimed,
    "extract",
    deps.clock.now().getTime() - extractStart.getTime(),
  );
  if (!extracted.ok) {
    return finishFailed({
      kind: "invalid_pdf",
      message: failureMessage("invalid_pdf"),
    });
  }

  const convertStart = deps.clock.now();
  const blocksResult = textToBlocks(extracted.value.pages);
  deps.telemetry.stage(
    claimed,
    "convert",
    deps.clock.now().getTime() - convertStart.getTime(),
  );

  if (
    blocksResult.pagesWithText === 0 ||
    blocksResult.doc.content.length === 0 ||
    !hasTextContent(blocksResult.doc)
  ) {
    return finishFailed({
      kind: "no_text_layer",
      message: failureMessage("no_text_layer"),
      pageCount: blocksResult.totalPages,
      pagesWithoutText: blocksResult.pagesWithoutText,
    });
  }

  if (remainingMs() <= 0) {
    return finishFailed({
      kind: "timeout",
      message: failureMessage("timeout"),
    });
  }

  const persistStart = deps.clock.now();
  const written = await deps.notebookPages.writeImportedContent(ownerId, {
    pageId: claimed.pageId,
    content: blocksResult.doc,
    expectedVersion: 1,
  });
  deps.telemetry.stage(
    claimed,
    "persist",
    deps.clock.now().getTime() - persistStart.getTime(),
  );
  if (!written.ok) {
    const message =
      written.error.code === PAGE_VERSION_CONFLICT_CODE
        ? failureMessage("persistence")
        : PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE;
    return finishFailed({ kind: "persistence", message });
  }

  const completed = await deps.jobs.markDone({
    id: claimed.id,
    pageCount: blocksResult.totalPages,
    pagesWithoutText: blocksResult.pagesWithoutText,
    now: deps.clock.now(),
  });
  if (!completed) {
    const current = await deps.jobs.findById(claimed.id);
    return ok(current ?? claimed);
  }
  await deps.telemetry.finished(completed);
  return ok(completed);
}
