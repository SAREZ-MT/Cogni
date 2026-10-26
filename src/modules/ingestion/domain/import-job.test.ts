import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ABANDONED_AFTER_MS } from "./import-budget";
import type { ImportFailureKind } from "./import-failure";
import {
  complete,
  createImportJob,
  fail,
  IMPORT_JOB_STATUS,
  type ImportJob,
  type ImportJobStatus,
  isAbandoned,
  isTerminal,
  start,
} from "./import-job";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const LATER = new Date("2026-09-23T10:01:30.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE_ID = "9f8e7d6c-5b4a-4938-8271-605f4e3d2c1b";
const JOB_ID = "0198a2b0-0000-7000-8000-000000000001";

const NEW_JOB = {
  id: JOB_ID,
  ownerId: OWNER_ID,
  pageId: PAGE_ID,
  storagePath: `${OWNER_ID}/0198a2b0-0000-7000-8000-000000000002.pdf`,
  fileName: "Cálculo I - unidad 3.pdf",
  sizeBytes: 1_048_576,
};

// Builds an ImportJob directly (not through the transition functions) so
// isTerminal/isAbandoned tests can put the job in any state, including ones
// unreachable through `start`/`complete`/`fail` alone.
function buildJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: JOB_ID,
    ownerId: OWNER_ID,
    pageId: PAGE_ID,
    storagePath: NEW_JOB.storagePath,
    fileName: NEW_JOB.fileName,
    sizeBytes: NEW_JOB.sizeBytes,
    status: "queued",
    pageCount: null,
    pagesWithoutText: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("createImportJob", () => {
  it("creates a new job in queued with the schema defaults", () => {
    const job = createImportJob(NEW_JOB, createFixedClock(NOW));

    expect(job.id).toBe(JOB_ID);
    expect(job.ownerId).toBe(OWNER_ID);
    expect(job.pageId).toBe(PAGE_ID);
    expect(job.storagePath).toBe(NEW_JOB.storagePath);
    expect(job.fileName).toBe(NEW_JOB.fileName);
    expect(job.sizeBytes).toBe(NEW_JOB.sizeBytes);
    expect(job.status).toBe("queued");
    expect(job.pageCount).toBeNull();
    expect(job.pagesWithoutText).toBe(0);
    expect(job.error).toBeNull();
    expect(job.startedAt).toBeNull();
    expect(job.finishedAt).toBeNull();
    expect(job.createdAt).toEqual(NOW);
    expect(job.updatedAt).toEqual(NOW);
  });
});

describe("start", () => {
  it("moves queued -> processing and stamps startedAt/updatedAt (Scenario: Flujo feliz de transiciones)", () => {
    const job = buildJob({ status: "queued" });

    const result = start(job, createFixedClock(LATER));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("processing");
    expect(result.value.startedAt).toEqual(LATER);
    expect(result.value.updatedAt).toEqual(LATER);
  });

  it.each<ImportJobStatus>([
    "processing",
    "done",
    "failed",
  ])("rejects start from %s (Scenario: Transicion desde estado terminal rechazada)", (status) => {
    const job = buildJob({ status });

    const result = start(job, createFixedClock(LATER));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
    expect(job.status).toBe(status);
  });
});

describe("complete", () => {
  it("moves processing -> done with the extraction counts (Scenario: Flujo feliz de transiciones)", () => {
    const job = buildJob({ status: "processing", startedAt: NOW });

    const result = complete(
      job,
      { pageCount: 30, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("done");
    expect(result.value.pageCount).toBe(30);
    expect(result.value.pagesWithoutText).toBe(0);
    expect(result.value.error).toBeNull();
    expect(result.value.finishedAt).toEqual(LATER);
    expect(result.value.updatedAt).toEqual(LATER);
  });

  it.each<ImportJobStatus>([
    "queued",
    "done",
    "failed",
  ])("rejects complete from %s (Scenario: Transicion desde estado terminal rechazada)", (status) => {
    const job = buildJob({ status });

    const result = complete(
      job,
      { pageCount: 30, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
    expect(job.status).toBe(status);
  });

  it("rejects a null pageCount (Scenario: complete sin contadores validos rechazado)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: null as unknown as number, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
    expect(job.status).toBe("processing");
  });

  it("rejects pagesWithoutText equal to pageCount (Scenario: complete sin contadores validos rechazado)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: 3, pagesWithoutText: 3 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
  });

  it("rejects pagesWithoutText greater than pageCount", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: 3, pagesWithoutText: 4 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a NaN pageCount (R3-complete-count-guard)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: Number.NaN, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
  });

  it("rejects a negative pageCount (R3-complete-count-guard)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: -1, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer pageCount (R3-complete-count-guard)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: 3.5, pagesWithoutText: 0 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a negative pagesWithoutText (R3-complete-count-guard)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: 3, pagesWithoutText: -1 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer pagesWithoutText (R3-complete-count-guard)", () => {
    const job = buildJob({ status: "processing" });

    const result = complete(
      job,
      { pageCount: 3, pagesWithoutText: 1.2 },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });
});

describe("fail", () => {
  it("moves processing -> failed and keeps existing counts when none are given", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      {
        kind: "download",
        message: "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.error).toBe(
      "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
    );
    expect(result.value.pageCount).toBeNull();
    expect(result.value.pagesWithoutText).toBe(0);
    expect(result.value.finishedAt).toEqual(LATER);
    expect(result.value.updatedAt).toEqual(LATER);
  });

  it("moves processing -> failed with the extraction counts (Scenario: hueco no_text_layer, E17)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      {
        kind: "no_text_layer",
        message:
          "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
        pageCount: 2,
        pagesWithoutText: 1,
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pageCount).toBe(2);
    expect(result.value.pagesWithoutText).toBe(1);
  });

  it("moves queued -> failed only for kind timeout (Scenario: queued -> failed budget exhausted)", () => {
    const job = buildJob({ status: "queued" });

    const result = fail(
      job,
      {
        kind: "timeout",
        message:
          "La importación tardó demasiado. Inténtalo de nuevo con un documento más pequeño o en unos minutos.",
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
  });

  it.each<Exclude<ImportFailureKind, "timeout">>([
    "download",
    "invalid_document",
    "unsupported_format",
    "no_text_layer",
    "empty_document",
    "persistence",
  ])("rejects queued -> failed for kind %s (only timeout may fail a queued job)", (kind) => {
    const job = buildJob({ status: "queued" });

    const result = fail(
      job,
      { kind, message: "algo salió mal" },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
    expect(job.status).toBe("queued");
  });

  it.each<ImportJobStatus>([
    "done",
    "failed",
  ])("rejects fail from the terminal state %s (Scenario: Transicion desde estado terminal rechazada)", (status) => {
    const job = buildJob({ status });

    const result = fail(
      job,
      { kind: "download", message: "algo salió mal" },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
  });

  it("rejects an empty message (Scenario: fail sin mensaje rechazado)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      { kind: "download", message: "" },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
    expect(job.status).toBe("processing");
  });

  it("rejects a whitespace-only message (Scenario: fail sin mensaje rechazado)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      { kind: "download", message: "   \n\t " },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("trims the stored message", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      { kind: "download", message: "  mensaje con espacios  " },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.error).toBe("mensaje con espacios");
  });

  it("rejects a NaN pageCount when provided (R3-fail-counts-unvalidated)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      {
        kind: "no_text_layer",
        message: "mensaje",
        pageCount: Number.NaN,
        pagesWithoutText: 0,
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IMPORT_JOB_INVALID_TRANSITION");
  });

  it("rejects a negative pageCount when provided (R3-fail-counts-unvalidated)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      {
        kind: "no_text_layer",
        message: "mensaje",
        pageCount: -2,
        pagesWithoutText: 0,
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer pagesWithoutText when provided (R3-fail-counts-unvalidated)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      {
        kind: "no_text_layer",
        message: "mensaje",
        pageCount: 2,
        pagesWithoutText: 0.5,
      },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(false);
  });

  it("accepts fail() with no counts at all (they stay optional)", () => {
    const job = buildJob({ status: "processing" });

    const result = fail(
      job,
      { kind: "download", message: "mensaje" },
      createFixedClock(LATER),
    );

    expect(result.ok).toBe(true);
  });
});

describe("isTerminal", () => {
  it.each<[ImportJobStatus, boolean]>([
    ["queued", false],
    ["processing", false],
    ["done", true],
    ["failed", true],
  ])("reports %s as terminal=%s", (status, expected) => {
    expect(isTerminal(status)).toBe(expected);
  });

  it("agrees with IMPORT_JOB_STATUS on every known status (R3-weak-isTerminal-test)", () => {
    const expectedByStatus: Record<ImportJobStatus, boolean> = {
      queued: false,
      processing: false,
      done: true,
      failed: true,
    };
    for (const status of IMPORT_JOB_STATUS) {
      expect(isTerminal(status)).toBe(expectedByStatus[status]);
    }
  });
});

describe("isAbandoned", () => {
  it("is false exactly at the ABANDONED_AFTER_MS boundary", () => {
    const job = buildJob({
      status: "processing",
      updatedAt: new Date(NOW.getTime()),
    });
    const now = new Date(NOW.getTime() + ABANDONED_AFTER_MS);

    expect(isAbandoned(job, now)).toBe(false);
  });

  it("is false one millisecond before the boundary", () => {
    const job = buildJob({ status: "processing", updatedAt: NOW });
    const now = new Date(NOW.getTime() + ABANDONED_AFTER_MS - 1);

    expect(isAbandoned(job, now)).toBe(false);
  });

  it("is true one millisecond after the boundary (Scenario: Job abandonado reportado como fallido)", () => {
    const job = buildJob({ status: "processing", updatedAt: NOW });
    const now = new Date(NOW.getTime() + ABANDONED_AFTER_MS + 1);

    expect(isAbandoned(job, now)).toBe(true);
  });

  it("is true for a queued job left untouched past the window", () => {
    const job = buildJob({ status: "queued", updatedAt: NOW });
    const now = new Date(NOW.getTime() + ABANDONED_AFTER_MS + 1);

    expect(isAbandoned(job, now)).toBe(true);
  });

  it.each<ImportJobStatus>([
    "done",
    "failed",
  ])("is always false for a terminal %s job, no matter how old", (status) => {
    const job = buildJob({ status, updatedAt: new Date(0) });
    const now = new Date(NOW.getTime() + ABANDONED_AFTER_MS * 100);

    expect(isAbandoned(job, now)).toBe(false);
  });
});
