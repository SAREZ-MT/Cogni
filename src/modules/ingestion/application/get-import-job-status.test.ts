import { describe, expect, it, vi } from "vitest";
import { createImportJob } from "../domain/import-job";
import {
  getImportJobStatus,
  toImportJobStatusView,
} from "./get-import-job-status";
import { FixedClock } from "./testing/fixed-clock";
import { InMemoryImportJobRepository } from "./testing/in-memory-import-job-repository";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps(now: Date = NOW) {
  return {
    jobs: new InMemoryImportJobRepository(),
    clock: new FixedClock(now),
  };
}

// specs/pdf-import/spec.md; design.md, "Decision: Flujo de subida y
// procesamiento", step 5 ("getImportJobStatus").
describe("getImportJobStatus use case", () => {
  it("returns ok(null) when the page has no import job", async () => {
    const deps = makeDeps();

    const result = await getImportJobStatus(
      { pageId: "page-1" },
      deps,
      OWNER_ID,
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns the job's view without revealing storagePath", async () => {
    const deps = makeDeps();
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OWNER_ID,
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-1.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
      },
      deps.clock,
    );
    await deps.jobs.create(job);

    const result = await getImportJobStatus(
      { pageId: "page-1" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      importJobId: "job-1",
      pageId: "page-1",
      status: "queued",
      pageCount: null,
      pagesWithoutText: 0,
      error: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(result.value && "storagePath" in result.value).toBe(false);
  });

  it("rejects a job owned by someone else without revealing existence", async () => {
    const deps = makeDeps();
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OTHER_OWNER_ID,
        pageId: "page-1",
        storagePath: `${OTHER_OWNER_ID}/upload-1.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
      },
      deps.clock,
    );
    await deps.jobs.create(job);

    const result = await getImportJobStatus(
      { pageId: "page-1" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
  });

  it("reports an abandoned processing job as failed(timeout) without writing", async () => {
    const deps = makeDeps();
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OWNER_ID,
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-1.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
      },
      deps.clock,
    );
    await deps.jobs.create(job);
    await deps.jobs.claim({ id: job.id, now: NOW });
    const markFailedSpy = vi.spyOn(deps.jobs, "markFailed");
    const wayLater = new Date(NOW.getTime() + 10 * 60 * 1000);
    const laterDeps = { ...deps, clock: new FixedClock(wayLater) };

    const result = await getImportJobStatus(
      { pageId: "page-1" },
      laterDeps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.status).toBe("failed");
    expect(result.value?.error).toBe(
      "La importación tardó demasiado. Inténtalo de nuevo con un documento más pequeño o en unos minutos.",
    );
    expect(markFailedSpy).not.toHaveBeenCalled();
    // Nothing was persisted: re-reading directly still shows `processing`.
    expect((await deps.jobs.findById(job.id))?.status).toBe("processing");
  });

  it("reports a non-abandoned processing job as-is", async () => {
    const deps = makeDeps();
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OWNER_ID,
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-1.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
      },
      deps.clock,
    );
    await deps.jobs.create(job);
    await deps.jobs.claim({ id: job.id, now: NOW });

    const result = await getImportJobStatus(
      { pageId: "page-1" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.status).toBe("processing");
  });

  it("rejects malformed input", async () => {
    const deps = makeDeps();

    const result = await getImportJobStatus({}, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
  });
});

describe("toImportJobStatusView", () => {
  it("maps every ImportJob field to its view shape", () => {
    const clock = { now: () => NOW };
    const job = createImportJob(
      {
        id: "job-1",
        ownerId: OWNER_ID,
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-1.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
      },
      clock,
    );

    expect(toImportJobStatusView(job)).toEqual({
      importJobId: "job-1",
      pageId: "page-1",
      status: "queued",
      pageCount: null,
      pagesWithoutText: 0,
      error: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });
});
