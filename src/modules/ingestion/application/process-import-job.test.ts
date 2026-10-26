import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import type { ExtractedDocument } from "../domain/document-extractor";
import {
  IMAGE_UPLOAD_RESERVE_MS,
  PROCESSING_BUDGET_MS,
} from "../domain/import-budget";
import { createImportJob } from "../domain/import-job";
import type { ImportedBlock } from "../domain/imported-doc";
import { textToBlocks } from "../domain/text-to-blocks";
import { processImportJob } from "./process-import-job";
import { FakeDocumentExtractor } from "./testing/fake-document-extractor";
import { FakeImportTelemetry } from "./testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "./testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./testing/fake-pdf-storage-gateway";
import { FixedClock } from "./testing/fixed-clock";
import { InMemoryImportJobRepository } from "./testing/in-memory-import-job-repository";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const STORAGE_PATH = `${OWNER_ID}/upload-1.pdf`;

const DOCX_STORAGE_PATH = `${OWNER_ID}/upload-1.docx`;

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 fake content");
// Real OOXML from the T1 fixtures: format detection reads the ZIP entry
// names, so a hand-written "PK" prefix would not be recognised as docx.
const DOCX_BYTES = new Uint8Array(
  readFileSync(
    join(process.cwd(), "tests/fixtures/documents/files/all-constructs.docx"),
  ),
);
const LEGACY_BYTES = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
]);

const INVALID_DOCUMENT_MESSAGE =
  "Este archivo no es un documento válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.";
const UNSUPPORTED_FORMAT_MESSAGE =
  "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx).";
const TIMEOUT_MESSAGE =
  "La importación tardó demasiado. Inténtalo de nuevo con un documento más pequeño o en unos minutos.";

function makeDeps(now: Date = NOW) {
  const notebookPages = new FakeNotebookPagesPort();
  return {
    jobs: new InMemoryImportJobRepository(),
    storage: new FakePdfStorageGateway(),
    extractor: new FakeDocumentExtractor(),
    notebookPages,
    telemetry: new FakeImportTelemetry(),
    clock: new FixedClock(now),
  };
}

async function seedQueuedJob(
  deps: ReturnType<typeof makeDeps>,
  overrides: { ownerId?: string; storagePath?: string } = {},
) {
  const page = await deps.notebookPages.createPage(
    overrides.ownerId ?? OWNER_ID,
    { notebookId: "nb-1" },
  );
  if (!page.ok) throw new Error("setup failed");
  const job = createImportJob(
    {
      id: "job-1",
      ownerId: overrides.ownerId ?? OWNER_ID,
      pageId: page.value.id,
      storagePath: overrides.storagePath ?? STORAGE_PATH,
      fileName: "notas.pdf",
      sizeBytes: PDF_BYTES.length,
    },
    deps.clock,
  );
  await deps.jobs.create(job);
  return job;
}

// The PDF adapter still converts page text with textToBlocks (until T8),
// so the fake returns exactly what that adapter would for these pages.
function extractedFromPages(pages: string[]) {
  const converted = textToBlocks(pages);
  return {
    content: converted.doc,
    totalPages: converted.totalPages,
    pagesWithoutText: converted.pagesWithoutText,
    images: [],
    skippedImages: 0,
  };
}

function seedTextExtraction(
  deps: ReturnType<typeof makeDeps>,
  pages: string[],
) {
  deps.storage.put(STORAGE_PATH, {
    sizeBytes: PDF_BYTES.length,
    mime: "application/pdf",
    bytes: PDF_BYTES,
  });
  deps.extractor.setResult(ok(extractedFromPages(pages)));
}

// specs/pdf-import/spec.md; design.md, "Decision: Procesamiento síncrono
// en la Server Action con maxDuration".
describe("processImportJob use case", () => {
  it("rejects an unknown or another owner's job without writing", async () => {
    const deps = makeDeps();
    await seedQueuedJob(deps);

    const result = await processImportJob(
      { importJobId: "job-1" },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
    expect(deps.storage.downloadCalls).toHaveLength(0);
  });

  it("rejects a truly missing job id", async () => {
    const deps = makeDeps();

    const result = await processImportJob(
      { importJobId: "missing" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
  });

  it("is a no-op for a job already processing, done or failed (idempotent)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    await deps.jobs.claim({ id: job.id, now: NOW });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("processing");
    expect(deps.storage.downloadCalls).toHaveLength(0);
    expect(deps.telemetry.finishedCalls).toHaveLength(0);
  });

  // T7b review follow-up from T6 (R3-idempotency-test-overclaims): the
  // test above only exercises `processing`; `done` and `failed` need
  // their own proof of no download and no second `pdf_imported`.
  it("is a no-op for a job already done: no download, no second pdf_imported", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    const first = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );
    expect(first.ok && first.value.status).toBe("done");

    const second = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.status).toBe("done");
    expect(deps.storage.downloadCalls).toHaveLength(1);
    expect(deps.telemetry.finishedCalls).toHaveLength(1);
  });

  it("is a no-op for a job already failed: no download, no second pdf_imported", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    // No object was ever `put()`, so the first call fails(download).
    const first = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );
    expect(first.ok && first.value.status).toBe("failed");

    const second = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.status).toBe("failed");
    expect(deps.storage.downloadCalls).toHaveLength(1);
    expect(deps.telemetry.finishedCalls).toHaveLength(1);
  });

  it("returns the current job when claim() loses the race (another call already claimed it)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    vi.spyOn(deps.jobs, "claim").mockResolvedValueOnce(null);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The job is still `queued` in the store (the mock only intercepted
    // this call's own claim, nothing else transitioned it); the use case
    // must re-read the current state rather than assume anything.
    expect(result.value.status).toBe("queued");
    expect(deps.storage.downloadCalls).toHaveLength(0);
  });

  it("falls back to the just-read job if it also vanished after losing the claim race (defensive)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    vi.spyOn(deps.jobs, "findById")
      .mockResolvedValueOnce(job) // the initial lookup
      .mockResolvedValueOnce(null); // the re-check after losing the race
    vi.spyOn(deps.jobs, "claim").mockResolvedValueOnce(null);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result).toEqual({ ok: true, value: job });
  });

  it("uses the current clock as the budget start when a claimed job unexpectedly has no startedAt (defensive)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    const realClaim = deps.jobs.claim.bind(deps.jobs);
    vi.spyOn(deps.jobs, "claim").mockImplementationOnce(async (claimInput) => {
      // Let the real transition happen (the store actually moves to
      // `processing`) but hand the use case back a job whose `startedAt`
      // is unexpectedly null, exercising the defensive `??` fallback.
      const claimedJob = await realClaim(claimInput);
      return claimedJob ? { ...claimedJob, startedAt: null } : claimedJob;
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("done");
  });

  it("fails(download) when the object cannot be downloaded", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    // No object was ever `put()`, so download() resolves null.

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
    );
    expect(deps.telemetry.finishedCalls).toEqual([
      { job: result.value, failure: { kind: "download" } },
    ]);
  });

  it("fails(download) when the download throws", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    vi.spyOn(deps.storage, "download").mockRejectedValueOnce(
      new Error("network error"),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
    );
  });

  it("fails(unsupported_format) when the downloaded bytes are not any supported document", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: 5,
      mime: "application/pdf",
      bytes: new TextEncoder().encode("nope!"),
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(UNSUPPORTED_FORMAT_MESSAGE);
    expect(deps.extractor.extractCalls).toHaveLength(0);
    expect(deps.telemetry.finishedCalls).toEqual([
      { job: result.value, failure: { kind: "unsupported_format" } },
    ]);
  });

  it("fails(unsupported_format) for a legacy binary Office file (OLE2 header)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: LEGACY_BYTES.length,
      mime: "application/pdf",
      bytes: LEGACY_BYTES,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.error).toBe(UNSUPPORTED_FORMAT_MESSAGE);
    expect(deps.extractor.extractCalls).toHaveLength(0);
  });

  it("fails(unsupported_format) when the detected format does not match the job's declared extension", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps); // declared .pdf
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: DOCX_BYTES.length,
      mime: "application/pdf",
      bytes: DOCX_BYTES,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.error).toBe(UNSUPPORTED_FORMAT_MESSAGE);
    expect(deps.extractor.extractCalls).toHaveLength(0);
  });

  it("fails(unsupported_format) when the extractor has no adapter for the format yet", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps, { storagePath: DOCX_STORAGE_PATH });
    deps.storage.put(DOCX_STORAGE_PATH, {
      sizeBytes: DOCX_BYTES.length,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: DOCX_BYTES,
    });
    deps.extractor.setResult(
      err(new DomainError("DOCUMENT_UNSUPPORTED_FORMAT", "docx")),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.error).toBe(UNSUPPORTED_FORMAT_MESSAGE);
    expect(deps.extractor.extractCalls.map((call) => call.format)).toEqual([
      "docx",
    ]);
  });

  it("imports a docx job: passes the detected format to the extractor and writes its content", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps, { storagePath: DOCX_STORAGE_PATH });
    deps.storage.put(DOCX_STORAGE_PATH, {
      sizeBytes: DOCX_BYTES.length,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: DOCX_BYTES,
    });
    const content = {
      type: "doc" as const,
      content: [
        {
          type: "heading" as const,
          attrs: { level: 1 as const },
          content: [{ type: "text" as const, text: "Derivadas" }],
        },
      ],
    };
    deps.extractor.setResult(
      ok({
        content,
        totalPages: 3,
        pagesWithoutText: 0,
        images: [],
        skippedImages: 0,
      }),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("done");
    expect(result.value.pageCount).toBe(3);
    expect(deps.extractor.extractCalls).toEqual([
      { bytes: DOCX_BYTES, format: "docx", signal: expect.any(AbortSignal) },
    ]);
    expect(deps.notebookPages.getPage(job.pageId)?.content).toEqual(content);
  });

  it("fails(empty_document) when a docx yields no text", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps, { storagePath: DOCX_STORAGE_PATH });
    deps.storage.put(DOCX_STORAGE_PATH, {
      sizeBytes: DOCX_BYTES.length,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: DOCX_BYTES,
    });
    deps.extractor.setResult(
      ok({
        content: { type: "doc", content: [{ type: "horizontalRule" }] },
        totalPages: 1,
        pagesWithoutText: 1,
        images: [],
        skippedImages: 0,
      }),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "El documento no tiene texto que podamos importar.",
    );
    expect(deps.telemetry.finishedCalls).toEqual([
      { job: result.value, failure: { kind: "empty_document" } },
    ]);
  });

  it("fails(invalid_document) when the downloaded bytes exceed the size limit", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    const oversized = new Uint8Array(20 * 1024 * 1024 + 1);
    oversized.set(new TextEncoder().encode("%PDF-1.7"));
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: oversized.length,
      mime: "application/pdf",
      bytes: oversized,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(INVALID_DOCUMENT_MESSAGE);
  });

  it("fails(timeout) when the internal budget is already spent before extraction", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    // Simulate a claim that started well before the current instant (the
    // real store stays `queued`, which `fail(timeout)` may still target —
    // design.md: "fail: ... o queued -> failed solo para kind 'timeout'").
    const staleStartedAt = new Date(NOW.getTime() - (PROCESSING_BUDGET_MS + 1));
    vi.spyOn(deps.jobs, "claim").mockResolvedValueOnce({
      ...job,
      status: "processing",
      startedAt: staleStartedAt,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(TIMEOUT_MESSAGE);
    expect(deps.extractor.extractCalls).toHaveLength(0);
  });

  it("fails(invalid_document) when the extractor returns an error", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    deps.extractor.setResult(
      err(new DomainError("DOCUMENT_UNREADABLE", "encrypted")),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(INVALID_DOCUMENT_MESSAGE);
  });

  // document-import T9b (audit: parsing outside the time budget): the
  // extraction is raced against the remaining budget, so a parser stuck on
  // an async step ends the job as timeout instead of running past
  // maxDuration; the adapter's signal is aborted so it stops between steps.
  it("fails(timeout) and aborts the extractor when extraction outlives the budget", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const deps = makeDeps();
      const job = await seedQueuedJob(deps);
      deps.storage.put(STORAGE_PATH, {
        sizeBytes: PDF_BYTES.length,
        mime: "application/pdf",
        bytes: PDF_BYTES,
      });
      deps.extractor.hang();

      const pending = processImportJob({ importJobId: job.id }, deps, OWNER_ID);
      await vi.advanceTimersByTimeAsync(PROCESSING_BUDGET_MS);
      const result = await pending;

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("failed");
      expect(result.value.error).toBe(TIMEOUT_MESSAGE);
      expect(deps.extractor.extractCalls[0].signal?.aborted).toBe(true);
      expect(deps.notebookPages.writeImportedContentCalls).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes a live signal to the extractor and clears its timer once extraction ends", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["Hola"]);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.status).toBe("done");
    expect(deps.extractor.extractCalls[0].signal?.aborted).toBe(false);
  });

  // document-import T9b: a document over an import cap (zip bomb, page
  // cap, XML element flood) fails as invalid_document with its own
  // message, so the user knows to split it instead of checking a password.
  it("fails(invalid_document) with the too-large message when the extractor reports a limit", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    deps.extractor.setResult(
      err(new DomainError("DOCUMENT_LIMIT_EXCEEDED", "301 pages")),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "Este documento es demasiado grande o complejo para importarlo. Divídelo en partes más pequeñas e inténtalo de nuevo.",
    );
    expect(deps.telemetry.finishedCalls.at(-1)?.failure?.kind).toBe(
      "invalid_document",
    );
  });

  // T7b review follow-up from T6 (R3-persist-and-extract-exceptions-
  // unhandled): the port promises a Result, but a thrown exception must
  // still leave the job terminal instead of propagating out of
  // processImportJob.
  // T7b review follow-up (R3-swallowed-exception-cause-lost): the original
  // exception must reach `telemetry.finished` as `failure.cause` so
  // `ImportTelemetryAdapter` can report it to Sentry with `captureException`
  // (stack included) instead of the stack-less `captureMessage`.
  it("fails(invalid_document) when the extractor throws instead of returning an error Result, forwarding the exception as cause", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    const thrown = new Error("unpdf blew up");
    vi.spyOn(deps.extractor, "extract").mockRejectedValueOnce(thrown);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(INVALID_DOCUMENT_MESSAGE);
    expect(deps.telemetry.finishedCalls).toEqual([
      {
        job: result.value,
        failure: { kind: "invalid_document", cause: thrown },
      },
    ]);
  });

  it("fails(invalid_document) with no cause when the extractor returns an error Result without throwing", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    deps.extractor.setResult(
      err(new DomainError("DOCUMENT_UNREADABLE", "encrypted")),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deps.telemetry.finishedCalls).toEqual([
      {
        job: result.value,
        failure: { kind: "invalid_document", cause: undefined },
      },
    ]);
  });

  it("fails(no_text_layer) when no page has text", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["   ", ""]);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
    );
    expect(result.value.pageCount).toBe(2);
    expect(result.value.pagesWithoutText).toBe(2);
  });

  // T4 review follow-up: textToBlocks can report `pagesWithText > 0` (raw
  // text was non-blank) while every line was discarded as page-number
  // noise, leaving zero real blocks. `hasTextContent` catches this even
  // though the shallower `pagesWithoutText === pageCount` check would not.
  it("fails(no_text_layer) when every page's text is discarded (e.g. page numbers only), even though pagesWithText > 0", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["12"]);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
    );
  });

  it("fails(timeout) when the internal budget is spent before writing", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    const writeSpy = vi.spyOn(deps.notebookPages, "writeImportedContent");
    vi.spyOn(deps.extractor, "extract").mockImplementationOnce(async () => {
      deps.clock.advanceMs(PROCESSING_BUDGET_MS + 1);
      return ok(extractedFromPages(["hola mundo"]));
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(TIMEOUT_MESSAGE);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("fails(persistence) with the version-conflict message on a page version conflict", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    // Bump the page's version so expectedVersion: 1 no longer matches.
    await deps.notebookPages.writeImportedContent(OWNER_ID, {
      pageId: job.pageId,
      content: { type: "doc", content: [] },
      expectedVersion: 1,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el documento.",
    );
  });

  it("fails(persistence) with the page-unavailable message when the page no longer exists", async () => {
    const deps = makeDeps();
    const page = await deps.notebookPages.createPage(OWNER_ID, {
      notebookId: "nb-1",
    });
    if (!page.ok) throw new Error("setup failed");
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OWNER_ID,
        pageId: "page-does-not-exist",
        storagePath: STORAGE_PATH,
        fileName: "notas.pdf",
        sizeBytes: PDF_BYTES.length,
      },
      deps.clock,
    );
    await deps.jobs.create(job);
    seedTextExtraction(deps, ["hola mundo"]);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "La página de destino ya no está disponible. Vuelve a importar el documento.",
    );
  });

  // T7b review follow-up from T6 (R3-persist-and-extract-exceptions-
  // unhandled): a thrown database exception from writeImportedContent
  // must map to the generic page-unavailable message, not propagate.
  // T7b review follow-up (R3-swallowed-exception-cause-lost): same
  // guarantee as the extractor-throws test above, for the write path.
  it("fails(persistence) with the page-unavailable message when writeImportedContent throws, forwarding the exception as cause", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    const thrown = new Error("connection reset");
    vi.spyOn(deps.notebookPages, "writeImportedContent").mockRejectedValueOnce(
      thrown,
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "La página de destino ya no está disponible. Vuelve a importar el documento.",
    );
    expect(deps.telemetry.finishedCalls).toEqual([
      { job: result.value, failure: { kind: "persistence", cause: thrown } },
    ]);
  });

  it("completes the job, writes the content and reports pdf_imported exactly once", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["Título\n\nUn párrafo de contenido."]);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("done");
    expect(result.value.pageCount).toBe(1);
    expect(result.value.pagesWithoutText).toBe(0);
    expect(deps.notebookPages.getPage(job.pageId)?.content).toBeTruthy();
    expect(deps.telemetry.finishedCalls).toEqual([
      { job: result.value, failure: undefined, outcome: { skippedImages: 0 } },
    ]);
  });

  // T7b review follow-up from T6 (R3-telemetry-finished-rejection-
  // propagates): the job is already terminal in the repository by the
  // time telemetry.finished() runs; a rejection there must never surface
  // out of processImportJob or undo the terminal transition.
  // T7b review follow-up (R3-console-spy-restore-skipped-on-failure): the
  // previous version called `consoleError.mockRestore()` as the last
  // statement, so a failed assertion above it left the spy installed for
  // every later test in this file. `finally` restores it unconditionally,
  // and the added assertion proves `reportFinished` actually logged the
  // rejection instead of merely swallowing it silently.
  it("still resolves ok with the terminal job when telemetry.finished() rejects, and logs the rejection", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    const rejection = new Error("posthog unreachable");
    vi.spyOn(deps.telemetry, "finished").mockRejectedValueOnce(rejection);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await processImportJob(
        { importJobId: job.id },
        deps,
        OWNER_ID,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("done");
      expect(consoleError).toHaveBeenCalledWith(
        "ingestion: telemetry.finished rejected",
        expect.objectContaining({ importJobId: job.id, error: rejection }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("never emits a second pdf_imported when markDone/markFailed lose the race (job already terminal)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    vi.spyOn(deps.jobs, "markDone").mockResolvedValueOnce(null);

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    expect(deps.telemetry.finishedCalls).toHaveLength(0);
  });

  it("falls back to the just-claimed job if markDone loses the race and the job also vanished on re-read (defensive)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);
    vi.spyOn(deps.jobs, "markDone").mockResolvedValueOnce(null);
    vi.spyOn(deps.jobs, "findById")
      .mockResolvedValueOnce(job) // the initial lookup
      .mockResolvedValueOnce(null); // the re-check after markDone loses the race

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("processing");
    expect(deps.telemetry.finishedCalls).toHaveLength(0);
  });

  it("falls back to the just-claimed job if markFailed loses the race and the job also vanished on re-read (defensive)", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    // No object was ever `put()`, so download() resolves null -> fail(download).
    vi.spyOn(deps.jobs, "markFailed").mockResolvedValueOnce(null);
    vi.spyOn(deps.jobs, "findById")
      .mockResolvedValueOnce(job) // the initial lookup
      .mockResolvedValueOnce(null); // the re-check after markFailed loses the race

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("processing");
    expect(deps.telemetry.finishedCalls).toHaveLength(0);
  });

  it("records a stage() call for every stage reached in the happy path", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedTextExtraction(deps, ["hola mundo"]);

    await processImportJob({ importJobId: job.id }, deps, OWNER_ID);

    const stages = deps.telemetry.stageCalls.map((call) => call.stage);
    expect(stages).toEqual(["download", "extract", "convert", "persist"]);
  });

  it("stops recording stages after an earlier stage already failed", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    // No object was ever `put()`: download fails immediately.

    await processImportJob({ importJobId: job.id }, deps, OWNER_ID);

    const stages = deps.telemetry.stageCalls.map((call) => call.stage);
    expect(stages).toEqual(["download"]);
  });

  it("rejects malformed input", async () => {
    const deps = makeDeps();

    const result = await processImportJob({}, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
  });
});

// document-import T9: extracted images become page assets before the
// content is written; whatever cannot be stored is dropped and counted.
describe("processImportJob images", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function pendingImage(key: string): ImportedBlock {
    return {
      type: "image",
      attrs: { assetId: null, pendingId: key, align: "center", alt: null },
    };
  }

  function withImages(
    keys: string[],
    overrides: Partial<ExtractedDocument> = {},
  ): ExtractedDocument {
    return {
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "hola" }] },
          ...keys.map(pendingImage),
        ],
      },
      totalPages: 1,
      pagesWithoutText: 0,
      images: keys.map((key) => ({
        key,
        bytes: PNG,
        mime: "image/png",
        alt: null,
      })),
      skippedImages: 0,
      ...overrides,
    };
  }

  function seedExtraction(
    deps: ReturnType<typeof makeDeps>,
    extracted: ExtractedDocument,
  ) {
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    deps.extractor.setResult(ok(extracted));
  }

  function writtenImages(deps: ReturnType<typeof makeDeps>, pageId: string) {
    const content = deps.notebookPages.getPage(pageId)?.content;
    return (content?.content ?? []).filter((block) => block.type === "image");
  }

  it("stores every referenced image and writes the content with their assetIds", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedExtraction(deps, withImages(["img-1", "img-2"], { skippedImages: 1 }));

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.status).toBe("done");
    expect(deps.notebookPages.storeImportedAssetCalls).toEqual([
      { ownerId: OWNER_ID, pageId: job.pageId, mime: "image/png", size: 8 },
      { ownerId: OWNER_ID, pageId: job.pageId, mime: "image/png", size: 8 },
    ]);
    const assetIds = deps.notebookPages.storedAssetIds();
    expect(writtenImages(deps, job.pageId)).toEqual(
      assetIds.map((assetId) => ({
        type: "image",
        attrs: { assetId, align: "center", alt: null },
      })),
    );
    expect(deps.telemetry.finishedCalls.at(-1)?.outcome).toEqual({
      skippedImages: 1,
    });
    expect(deps.notebookPages.deleteImportedAssetsCalls).toEqual([]);
  });

  it("drops and counts images whose upload fails, throws or is not an allowed type", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    const extracted = withImages(["ok", "fails", "throws", "tiff"], {
      skippedImages: 2,
    });
    extracted.images[3] = { ...extracted.images[3], mime: "image/tiff" };
    seedExtraction(deps, extracted);
    deps.notebookPages.failStoreAt(1, "error");
    deps.notebookPages.failStoreAt(2, "throw");

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.status).toBe("done");
    expect(writtenImages(deps, job.pageId)).toHaveLength(1);
    expect(deps.telemetry.finishedCalls.at(-1)?.outcome).toEqual({
      skippedImages: 5,
    });
  });

  it("only uploads images the content references", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    const extracted = withImages(["img-1"]);
    extracted.images.push({
      key: "orphan",
      bytes: PNG,
      mime: "image/png",
      alt: null,
    });
    seedExtraction(deps, extracted);

    await processImportJob({ importJobId: job.id }, deps, OWNER_ID);

    expect(deps.notebookPages.storeImportedAssetCalls).toHaveLength(1);
  });

  it("stops uploading once the processing budget only leaves the persist reserve, dropping the rest", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedExtraction(deps, withImages(["img-1", "img-2", "img-3"]));
    const original = deps.notebookPages.storeImportedAsset.bind(
      deps.notebookPages,
    );
    vi.spyOn(deps.notebookPages, "storeImportedAsset").mockImplementation(
      async (ownerId, input) => {
        deps.clock.advanceMs(PROCESSING_BUDGET_MS - IMAGE_UPLOAD_RESERVE_MS);
        return original(ownerId, input);
      },
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.status).toBe("done");
    expect(deps.notebookPages.storeImportedAssetCalls).toHaveLength(1);
    expect(writtenImages(deps, job.pageId)).toHaveLength(1);
    expect(deps.telemetry.finishedCalls.at(-1)?.outcome).toEqual({
      skippedImages: 2,
    });
  });

  it("deletes the stored assets when the content write fails", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedExtraction(deps, withImages(["img-1", "img-2"]));
    vi.spyOn(deps.notebookPages, "writeImportedContent").mockResolvedValueOnce(
      err(new DomainError("PAGE_VERSION_CONFLICT", job.pageId)),
    );

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.status).toBe("failed");
    const [cleanup] = deps.notebookPages.deleteImportedAssetsCalls;
    expect(deps.notebookPages.deleteImportedAssetsCalls).toHaveLength(1);
    expect(cleanup.ownerId).toBe(OWNER_ID);
    expect(cleanup.assetIds).toHaveLength(2);
    // Both stored assets are gone again.
    expect(deps.notebookPages.storedAssetIds()).toEqual([]);
  });

  it("deletes the stored assets when the content write throws, even if the cleanup throws too", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedExtraction(deps, withImages(["img-1"]));
    vi.spyOn(deps.notebookPages, "writeImportedContent").mockRejectedValueOnce(
      new Error("db down"),
    );
    const cleanup = vi
      .spyOn(deps.notebookPages, "deleteImportedAssets")
      .mockRejectedValueOnce(new Error("storage down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const result = await processImportJob(
        { importJobId: job.id },
        deps,
        OWNER_ID,
      );

      expect(result.ok && result.value.status).toBe("failed");
      expect(cleanup).toHaveBeenCalledWith(
        OWNER_ID,
        deps.notebookPages.storedAssetIds(),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("never calls the cleanup when nothing was stored", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    seedExtraction(deps, withImages([]));
    vi.spyOn(deps.notebookPages, "writeImportedContent").mockResolvedValueOnce(
      err(new DomainError("PAGE_VERSION_CONFLICT", job.pageId)),
    );

    await processImportJob({ importJobId: job.id }, deps, OWNER_ID);

    expect(deps.notebookPages.deleteImportedAssetsCalls).toEqual([]);
  });
});
