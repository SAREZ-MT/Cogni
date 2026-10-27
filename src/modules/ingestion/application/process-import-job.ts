import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { DocumentExtractor } from "../domain/document-extractor";
import {
  documentFormatFromPath,
  MAX_DOCUMENT_BYTES,
} from "../domain/document-file";
import { detectDocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR, IMPORT_JOB_ERROR } from "../domain/errors";
import {
  IMAGE_UPLOAD_RESERVE_MS,
  PROCESSING_BUDGET_MS,
} from "../domain/import-budget";
import {
  DOCUMENT_LIMIT_EXCEEDED_MESSAGE,
  failureMessage,
  type ImportFailureKind,
  PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE,
} from "../domain/import-failure";
import type { ImportJob } from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";
import type { ImportTelemetry } from "../domain/import-telemetry";
import { hasTextContent } from "../domain/imported-doc";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";
import type { PdfStorageGateway } from "../domain/pdf-storage-gateway";
import {
  pendingImageKeys,
  resolvePendingImages,
} from "../domain/pending-images";
import { parseInput } from "./validation";

export const processImportJobSchema = z.object({
  importJobId: z.string(),
});

export interface ProcessImportJobDeps {
  jobs: ImportJobRepository;
  storage: PdfStorageGateway;
  extractor: DocumentExtractor;
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
  // Review follow-up from T7b (R3-swallowed-exception-cause-lost): the
  // original thrown exception (extractor or write), when there was one,
  // forwarded to `telemetry.finished` so `ImportTelemetryAdapter` can
  // report it to Sentry with `captureException` (stack included) instead
  // of the stack-less `captureMessage`.
  cause?: unknown;
}

// design.md, "Decision: Procesamiento síncrono en la Server Action con
// maxDuration" — `processImportJob({ importJobId }, deps, ownerId)`.
// Claims the queued job with a conditional transition, downloads the
// document, detects its format from the real bytes (document-import T5:
// PDF, DOCX or PPTX, which must match the format its storage path
// declares), extracts it into blocks through the DocumentExtractor port,
// rejects it when no block carries text, writes it through
// `NotebookPagesPort.writeImportedContent` with compare-and-swap, and
// always leaves the job in a terminal state (unless the platform kills
// the function first — `getImportJobStatus`'s abandoned-job rule covers
// that case). No failure ever propagates as an exception: every branch
// resolves to `ok(job)` in its final state, `err` only for "job not
// found/not owned" before anything was claimed.
// Settles with `work`'s value, "threw" when it rejects, or "timeout" once
// `budgetMs` passes first; `onLate` then receives the value it settles
// with afterwards, if any.
async function withinBudget<T>(
  work: Promise<T>,
  budgetMs: number,
  onLate: (value: T) => void,
): Promise<T | "threw" | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const settled = work.then(
    (value) => {
      if (timedOut) onLate(value);
      return value;
    },
    () => "threw" as const,
  );
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve("timeout");
    }, budgetMs);
  });
  try {
    return await Promise.race([settled, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

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
  // with no download, no write and no second `document_imported`.
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

  // Review follow-up from T6 (R3-telemetry-finished-rejection-propagates):
  // the job's terminal state is already durably persisted by the time
  // `finished()` runs; a rejection here (a broken adapter, despite the
  // port's "never throws" contract) must never surface as an unhandled
  // rejection out of `processImportJob` and must never undo the terminal
  // transition that already happened.
  const reportFinished = async (
    finishedJob: ImportJob,
    failure?: { kind: ImportFailureKind; cause?: unknown },
  ): Promise<void> => {
    try {
      await deps.telemetry.finished(finishedJob, failure);
    } catch (error) {
      console.error("ingestion: telemetry.finished rejected", {
        importJobId: finishedJob.id,
        error,
      });
    }
  };

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
    await reportFinished(failed, { kind: failure.kind, cause: failure.cause });
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
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return finishFailed({
      kind: "invalid_document",
      message: failureMessage("invalid_document"),
    });
  }
  // The real bytes decide the format; a legacy/unknown file, or one whose
  // bytes are not the format the upload declared (the path's extension,
  // picked by requestPdfUpload from the validated mime), is refused before
  // any parser sees it.
  const detected = detectDocumentFormat(bytes);
  if (
    detected === "legacy" ||
    detected === "unknown" ||
    detected !== documentFormatFromPath(claimed.storagePath)
  ) {
    return finishFailed({
      kind: "unsupported_format",
      message: failureMessage("unsupported_format"),
    });
  }
  const format = detected;

  if (remainingMs() <= 0) {
    return finishFailed({
      kind: "timeout",
      message: failureMessage("timeout"),
    });
  }

  const extractStart = deps.clock.now();
  // Review follow-up from T6 (R3-persist-and-extract-exceptions-
  // unhandled): the port promises a Result, never a throw, but an adapter
  // bug (or the parser itself) can still reject; the job must reach a
  // terminal state instead of leaking the exception out of
  // processImportJob.
  let extracted: Awaited<ReturnType<DocumentExtractor["extract"]>>;
  // Captured only when `extract` actually threw (never set for a plain
  // `err(...)` Result) so `finishFailed` only forwards a `cause` to
  // telemetry when there is a real exception with a stack to report.
  let extractCause: unknown;
  //
  // T9b (audit: parsing outside the time budget): the extraction is raced
  // against what is left of the budget. A parser stuck on an async step
  // loses the race and the job ends as `timeout`; the adapter's signal is
  // aborted so it stops at its next step. Synchronous parser work cannot
  // be preempted — the caps of "Límites y seguridad" bound it instead.
  const extraction = new AbortController();
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budgetSpent = new Promise<"timeout">((resolve) => {
    budgetTimer = setTimeout(
      () => {
        extraction.abort();
        resolve("timeout");
      },
      Math.max(remainingMs(), 0),
    );
  });
  let timedOut = false;
  try {
    const pending = deps.extractor.extract(bytes, format, {
      signal: extraction.signal,
    });
    // A late rejection after the budget won must not go unhandled.
    pending.catch(() => {});
    const outcome = await Promise.race([pending, budgetSpent]);
    if (outcome === "timeout") {
      timedOut = true;
      extracted = err(
        new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "timeout"),
      );
    } else {
      extracted = outcome;
    }
  } catch (error) {
    extractCause = error;
    extracted = err(new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "threw"));
  } finally {
    clearTimeout(budgetTimer);
  }
  deps.telemetry.stage(
    claimed,
    "extract",
    deps.clock.now().getTime() - extractStart.getTime(),
  );
  if (timedOut) {
    return finishFailed({
      kind: "timeout",
      message: failureMessage("timeout"),
    });
  }
  if (!extracted.ok) {
    const kind: ImportFailureKind =
      extracted.error.code === DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT
        ? "unsupported_format"
        : "invalid_document";
    return finishFailed({
      kind,
      message:
        extracted.error.code === DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED
          ? DOCUMENT_LIMIT_EXCEEDED_MESSAGE
          : failureMessage(kind),
      cause: extractCause,
    });
  }
  const document = extracted.value;

  // Conversion to blocks now happens inside the extractor adapter; this
  // stage covers the post-extraction checks and T9's image uploads.
  const convertStart = deps.clock.now();
  const hasText = hasTextContent(document.content);

  // `hasTextContent` is recursive: it also catches a doc whose blocks were
  // all discarded as noise (e.g. page numbers only). A PDF without text is
  // a missing text layer (scanned); a DOCX/PPTX without text is just empty.
  if (!hasText) {
    deps.telemetry.stage(
      claimed,
      "convert",
      deps.clock.now().getTime() - convertStart.getTime(),
    );
    const kind: ImportFailureKind =
      format === "pdf" ? "no_text_layer" : "empty_document";
    return finishFailed({
      kind,
      message: failureMessage(kind),
      pageCount: document.totalPages,
      pagesWithoutText: document.pagesWithoutText,
    });
  }

  if (remainingMs() <= 0) {
    deps.telemetry.stage(
      claimed,
      "convert",
      deps.clock.now().getTime() - convertStart.getTime(),
    );
    return finishFailed({
      kind: "timeout",
      message: failureMessage("timeout"),
    });
  }

  // document-import T9: every image the content references is stored as a
  // page asset, one at a time, while more than IMAGE_UPLOAD_RESERVE_MS of
  // the budget is left; the content then carries their assetIds. Images
  // that could not be stored (refused mime/size, failed or throwing
  // upload, budget exhausted) are dropped from the content and counted
  // with the ones the extractor already skipped.
  const imagesByKey = new Map(
    document.images.map((image) => [image.key, image]),
  );
  const resolvedImages = new Map<string, string>();
  for (const key of pendingImageKeys(document.content)) {
    const uploadBudgetMs = remainingMs() - IMAGE_UPLOAD_RESERVE_MS;
    if (uploadBudgetMs <= 0) break;
    const image = imagesByKey.get(key);
    if (!image) continue;
    // T9b (T9 review follow-up): each upload is raced against what is left
    // of the upload budget, so one stalled upload cannot eat the persist
    // reserve. A timed-out upload is dropped like a failed one and the
    // loop stops; if it completes later its asset is unreferenced, so it is
    // deleted again best effort (it stays orphaned if the function is
    // frozen first — page assets are swept with their page).
    const outcome = await withinBudget(
      (async () =>
        deps.notebookPages.storeImportedAsset(ownerId, {
          pageId: claimed.pageId,
          bytes: image.bytes,
          mime: image.mime,
        }))(),
      uploadBudgetMs,
      (late) => {
        if (!late.ok) return;
        deps.notebookPages
          .deleteImportedAssets(ownerId, [late.value.assetId])
          .catch((error) => {
            console.error("ingestion: late asset cleanup rejected", {
              importJobId: claimed.id,
              error,
            });
          });
      },
    );
    if (outcome === "timeout") break;
    if (outcome !== "threw" && outcome.ok) {
      resolvedImages.set(key, outcome.value.assetId);
    }
    // Otherwise (refused or throwing upload): dropped and counted like
    // any other image that was not stored.
  }
  const storedAssetIds = [...resolvedImages.values()];
  const resolved = resolvePendingImages(document.content, resolvedImages);
  const skippedImages = document.skippedImages + resolved.removed;
  deps.telemetry.stage(
    claimed,
    "convert",
    deps.clock.now().getTime() - convertStart.getTime(),
  );

  // Best effort: the assets of a page whose content was never written are
  // unreferenced, so a cleanup failure is only logged.
  const discardStoredAssets = async (): Promise<void> => {
    if (storedAssetIds.length === 0) return;
    try {
      await deps.notebookPages.deleteImportedAssets(ownerId, storedAssetIds);
    } catch (error) {
      console.error("ingestion: deleteImportedAssets rejected", {
        importJobId: claimed.id,
        error,
      });
    }
  };

  const persistStart = deps.clock.now();
  // Review follow-up from T6 (R3-persist-and-extract-exceptions-
  // unhandled): the port promises a Result, but a thrown database
  // exception must still leave the job terminal instead of propagating
  // out of processImportJob — mapped to the generic page-unavailable
  // message, the same text design.md assigns to "PAGE_NOT_FOUND o
  // excepción".
  let written: Awaited<ReturnType<NotebookPagesPort["writeImportedContent"]>>;
  // Same convention as `extractCause` above: only set when
  // `writeImportedContent` actually threw.
  let writeCause: unknown;
  try {
    written = await deps.notebookPages.writeImportedContent(ownerId, {
      pageId: claimed.pageId,
      content: resolved.content,
      expectedVersion: 1,
    });
  } catch (error) {
    writeCause = error;
    // Any code other than PAGE_VERSION_CONFLICT_CODE below maps to the
    // generic page-unavailable message; this sentinel just needs to not
    // collide with that one literal.
    written = err(
      new DomainError(
        "INGESTION_WRITE_IMPORTED_CONTENT_THREW",
        "writeImportedContent threw",
      ),
    );
  }
  deps.telemetry.stage(
    claimed,
    "persist",
    deps.clock.now().getTime() - persistStart.getTime(),
  );
  if (!written.ok) {
    if (writeCause === undefined) {
      await discardStoredAssets();
    } else if (storedAssetIds.length > 0) {
      // T9b (T9 review follow-up): a thrown write is ambiguous — it may
      // have committed before the error reached us — so deleting the
      // assets could leave committed image nodes pointing at nothing.
      // They are kept (unreferenced assets of an unwritten page are the
      // lesser harm) and logged; only a definite error Result deletes.
      console.error("ingestion: write outcome unknown, imported assets kept", {
        importJobId: claimed.id,
        assetIds: storedAssetIds,
      });
    }
    const message =
      written.error.code === PAGE_VERSION_CONFLICT_CODE
        ? failureMessage("persistence")
        : PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE;
    return finishFailed({ kind: "persistence", message, cause: writeCause });
  }

  const completed = await deps.jobs.markDone({
    id: claimed.id,
    pageCount: document.totalPages,
    pagesWithoutText: document.pagesWithoutText,
    skippedImages,
    now: deps.clock.now(),
  });
  if (!completed) {
    const current = await deps.jobs.findById(claimed.id);
    return ok(current ?? claimed);
  }
  await reportFinished(completed);
  return ok(completed);
}
