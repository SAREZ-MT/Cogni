import type { ImportFailureKind } from "../../domain/import-failure";
import type { ImportJob } from "../../domain/import-job";
import type {
  ImportOutcome,
  ImportTelemetry,
} from "../../domain/import-telemetry";

// Test double for the ImportTelemetry port — records every call in memory
// so `processImportJob` (T6) tests can assert `pdf_imported` (`finished`)
// fires exactly once per terminal job and never for a job `getImportJobStatus`
// merely reports as abandoned without writing.
export class FakeImportTelemetry implements ImportTelemetry {
  readonly stageCalls: Array<{
    jobId: string;
    stage: "download" | "extract" | "convert" | "persist";
    durationMs: number;
  }> = [];

  readonly finishedCalls: Array<{
    job: ImportJob;
    failure?: { kind: ImportFailureKind; cause?: unknown };
    outcome?: ImportOutcome;
  }> = [];

  stage(
    job: ImportJob,
    stage: "download" | "extract" | "convert" | "persist",
    durationMs: number,
  ): void {
    this.stageCalls.push({ jobId: job.id, stage, durationMs });
  }

  async finished(
    job: ImportJob,
    failure?: { kind: ImportFailureKind; cause?: unknown },
    outcome?: ImportOutcome,
  ): Promise<void> {
    this.finishedCalls.push(
      outcome ? { job, failure, outcome } : { job, failure },
    );
  }
}
