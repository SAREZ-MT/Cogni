import { describe, expect, it, vi } from "vitest";
import type { Analytics } from "@/shared/observability/analytics";
import type { ImportJob } from "../domain/import-job";
import {
  ImportTelemetryAdapter,
  reportPdfInProcessParse,
} from "./import-telemetry-adapter";

const { captureException, captureMessage } = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException, captureMessage }));

const CREATED_AT = new Date("2026-09-23T10:00:00.000Z");
const FINISHED_AT = new Date("2026-09-23T10:00:04.200Z");

function makeJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: "job-1",
    ownerId: "owner-1",
    pageId: "page-1",
    storagePath: "owner-1/upload-1.pdf",
    fileName: "notas.pdf",
    sizeBytes: 2048,
    format: "pdf",
    status: "done",
    pageCount: 12,
    pagesWithoutText: 0,
    skippedImages: 0,
    error: null,
    startedAt: CREATED_AT,
    finishedAt: FINISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: FINISHED_AT,
    ...overrides,
  };
}

function makeAnalytics(): Analytics & { track: ReturnType<typeof vi.fn> } {
  return { track: vi.fn().mockResolvedValue(undefined) };
}

// design.md, "Observabilidad: pdf_imported en toda transición terminal y
// Sentry en todo fallo". Never throws — a telemetry failure must never
// fail the caller (process-import-job.ts's own reportFinished() guard is
// defense-in-depth on top of this contract, not a substitute for it).
describe("ImportTelemetryAdapter", () => {
  it("logs a structured stage() line without throwing", () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    expect(() => adapter.stage(makeJob(), "extract", 120)).not.toThrow();

    expect(consoleInfo).toHaveBeenCalledWith(
      "[ingestion] stage",
      expect.objectContaining({
        importJobId: "job-1",
        stage: "extract",
        durationMs: 120,
      }),
    );
    consoleInfo.mockRestore();
  });

  it("sends document_imported with page_count/pages_without_text/duration_ms/status for a done job", async () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob());

    expect(analytics.track).toHaveBeenCalledWith(
      "document_imported",
      "owner-1",
      {
        page_count: 12,
        pages_without_text: 0,
        duration_ms: 4200,
        status: "done",
        format: "pdf",
        skipped_images: 0,
      },
    );
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  // document-import T9/T10: images dropped during the import, read from
  // the job (import_jobs.skipped_images).
  it("sends the job's skipped_images", async () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob({ skippedImages: 3 }));

    expect(analytics.track).toHaveBeenCalledWith(
      "document_imported",
      "owner-1",
      expect.objectContaining({ status: "done", skipped_images: 3 }),
    );
  });

  it("sends duration_ms: null when the job has no finishedAt (defensive)", async () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob({ finishedAt: null }));

    expect(analytics.track).toHaveBeenCalledWith(
      "document_imported",
      "owner-1",
      expect.objectContaining({ duration_ms: null }),
    );
  });

  it("sends document_imported with status failed and reports to Sentry at error level for most kinds", async () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);
    const cause = new Error("connection reset");

    await adapter.finished(makeJob({ status: "failed", pageCount: null }), {
      kind: "download",
      cause,
    });

    expect(analytics.track).toHaveBeenCalledWith(
      "document_imported",
      "owner-1",
      expect.objectContaining({ status: "failed", page_count: null }),
    );
    expect(captureException).toHaveBeenCalledWith(
      cause,
      expect.objectContaining({ level: "error" }),
    );
  });

  it("reports no_text_layer to Sentry at warning level", async () => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob({ status: "failed" }), {
      kind: "no_text_layer",
    });

    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("no_text_layer"),
      expect.objectContaining({ level: "warning" }),
    );
    expect(captureException).not.toHaveBeenCalled();
  });

  // document-import T10: the format-neutral event carries the job's
  // recorded format (import_jobs.format).
  it.each([
    "docx",
    "pptx",
  ] as const)("sends the job's format %s", async (format) => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob({ format }));

    expect(analytics.track).toHaveBeenCalledWith(
      "document_imported",
      "owner-1",
      expect.objectContaining({ format }),
    );
  });

  // A user's file, not a bug: an office document without text or a file
  // in a format Cogni does not import is a warning, like no_text_layer.
  it.each([
    "empty_document",
    "unsupported_format",
  ] as const)("reports %s to Sentry at warning level", async (kind) => {
    const analytics = makeAnalytics();
    const adapter = new ImportTelemetryAdapter(analytics);

    await adapter.finished(makeJob({ status: "failed" }), { kind });

    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining(kind),
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("never rejects when analytics.track() itself throws", async () => {
    const analytics = makeAnalytics();
    analytics.track.mockRejectedValueOnce(new Error("posthog down"));
    const adapter = new ImportTelemetryAdapter(analytics);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(adapter.finished(makeJob())).resolves.toBeUndefined();

    consoleError.mockRestore();
  });

  it("never rejects when Sentry reporting itself throws", async () => {
    const analytics = makeAnalytics();
    captureException.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    const adapter = new ImportTelemetryAdapter(analytics);

    await expect(
      adapter.finished(makeJob({ status: "failed" }), {
        kind: "download",
        cause: new Error("x"),
      }),
    ).resolves.toBeUndefined();
  });
});

// document-import T8b: the PDF adapter's degraded mode (pdf.js in the
// server process) is reported on every such parse, never silently.
describe("reportPdfInProcessParse", () => {
  const event = {
    reason: "PDF_SEPARATE_PROCESS_UNAVAILABLE" as const,
    maxPages: 50,
    maxPageChars: 20_000,
    maxTotalChars: 250_000,
  };

  it("reports the degraded parse to Sentry at warning level with its codes and caps only", () => {
    captureMessage.mockClear();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportPdfInProcessParse(event);
    reportPdfInProcessParse(event);

    expect(captureMessage).toHaveBeenCalledTimes(2);
    expect(captureMessage).toHaveBeenCalledWith(
      "pdf parsed in the server process: PDF_SEPARATE_PROCESS_UNAVAILABLE",
      { level: "warning", extra: event },
    );
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("never throws when Sentry reporting itself throws", () => {
    captureMessage.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => reportPdfInProcessParse(event)).not.toThrow();
    warn.mockRestore();
  });
});
