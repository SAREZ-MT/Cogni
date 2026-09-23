import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { PROCESSING_BUDGET_MS } from "../domain/import-budget";
import { createImportJob } from "../domain/import-job";
import { processImportJob } from "./process-import-job";
import { FakeImportTelemetry } from "./testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "./testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./testing/fake-pdf-storage-gateway";
import { FakePdfTextExtractor } from "./testing/fake-pdf-text-extractor";
import { FixedClock } from "./testing/fixed-clock";
import { InMemoryImportJobRepository } from "./testing/in-memory-import-job-repository";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const STORAGE_PATH = `${OWNER_ID}/upload-1.pdf`;

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 fake content");

function makeDeps(now: Date = NOW) {
  const notebookPages = new FakeNotebookPagesPort();
  return {
    jobs: new InMemoryImportJobRepository(),
    storage: new FakePdfStorageGateway(),
    extractor: new FakePdfTextExtractor(),
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

function seedTextExtraction(
  deps: ReturnType<typeof makeDeps>,
  pages: string[],
) {
  deps.storage.put(STORAGE_PATH, {
    sizeBytes: PDF_BYTES.length,
    mime: "application/pdf",
    bytes: PDF_BYTES,
  });
  deps.extractor.setResult(ok({ totalPages: pages.length, pages }));
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

  it("fails(invalid_pdf) when the downloaded bytes do not start with the PDF magic number", async () => {
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
    expect(result.value.error).toBe(
      "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
    );
  });

  it("fails(invalid_pdf) when the downloaded bytes exceed the size limit", async () => {
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
    expect(result.value.error).toBe(
      "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
    );
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
    expect(result.value.error).toBe(
      "La importación tardó demasiado. Inténtalo de nuevo con un PDF más pequeño o en unos minutos.",
    );
    expect(deps.extractor.extractCalls).toHaveLength(0);
  });

  it("fails(invalid_pdf) when the extractor returns an error", async () => {
    const deps = makeDeps();
    const job = await seedQueuedJob(deps);
    deps.storage.put(STORAGE_PATH, {
      sizeBytes: PDF_BYTES.length,
      mime: "application/pdf",
      bytes: PDF_BYTES,
    });
    deps.extractor.setResult(
      err(new DomainError("PDF_UNREADABLE", "encrypted")),
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
      "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
    );
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
      return ok({ totalPages: 1, pages: ["hola mundo"] });
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
      "La importación tardó demasiado. Inténtalo de nuevo con un PDF más pequeño o en unos minutos.",
    );
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
      "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el PDF.",
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
      "La página de destino ya no está disponible. Vuelve a importar el PDF.",
    );
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
      { job: result.value, failure: undefined },
    ]);
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
