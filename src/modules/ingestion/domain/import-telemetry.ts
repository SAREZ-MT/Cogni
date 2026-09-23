import type { ImportFailureKind } from "./import-failure";
import type { ImportJob } from "./import-job";

// design.md, "Decision: Observabilidad: pdf_imported en toda transición
// terminal y Sentry en todo fallo" — the port `processImportJob` (T6)
// depends on instead of calling PostHog/Sentry directly
// (`application-no-infra-or-ui`). `ServerImportTelemetry` (T7, the only
// adapter) writes a structured server log for `stage`, sends `pdf_imported`
// through `createServerAnalytics` and reports failures to Sentry from
// `finished`; `FakeImportTelemetry` (application/testing) records calls in
// memory for unit tests.
export interface ImportTelemetry {
  // A structured log line with ids, stage name and duration — visible in
  // Vercel's function logs. Never throws and never blocks a terminal
  // transition.
  stage(
    job: ImportJob,
    stage: "download" | "extract" | "convert" | "persist",
    durationMs: number,
  ): void;
  // Called exactly once, right after a terminal transition actually
  // happened (a `markDone`/`markFailed` call that returned a job, never
  // one that returned `null` because another call already won). Emits
  // `pdf_imported` (`distinctId = ownerId`) and, when `failure` is given,
  // reports to Sentry with `warning` for `no_text_layer` and `error` for
  // every other kind.
  finished(
    job: ImportJob,
    failure?: { kind: ImportFailureKind; cause?: unknown },
  ): Promise<void>;
}
