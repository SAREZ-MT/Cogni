import { describe, expect, it } from "vitest";
import { createImportJob } from "../../domain/import-job";
import { FakeImportTelemetry } from "./fake-import-telemetry";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const clock = { now: () => new Date("2026-09-23T10:00:00.000Z") };

function newJob() {
  return createImportJob(
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
}

describe("FakeImportTelemetry", () => {
  it("records every stage() call with the job id, stage and duration", () => {
    const telemetry = new FakeImportTelemetry();
    const job = newJob();

    telemetry.stage(job, "download", 120);
    telemetry.stage(job, "extract", 340);

    expect(telemetry.stageCalls).toEqual([
      { jobId: job.id, stage: "download", durationMs: 120 },
      { jobId: job.id, stage: "extract", durationMs: 340 },
    ]);
  });

  it("records a finished() call without a failure", async () => {
    const telemetry = new FakeImportTelemetry();
    const job = newJob();

    await telemetry.finished(job);

    expect(telemetry.finishedCalls).toEqual([{ job, failure: undefined }]);
  });

  it("records a finished() call with a failure", async () => {
    const telemetry = new FakeImportTelemetry();
    const job = newJob();
    const cause = new Error("boom");

    await telemetry.finished(job, { kind: "download", cause });

    expect(telemetry.finishedCalls).toEqual([
      { job, failure: { kind: "download", cause } },
    ]);
  });
});
