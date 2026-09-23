import * as Sentry from "@sentry/nextjs";
import type { Analytics } from "@/shared/observability/analytics";
import type { ImportFailureKind } from "../domain/import-failure";
import type { ImportJob } from "../domain/import-job";
import type { ImportTelemetry } from "../domain/import-telemetry";

// design.md, "Decision: Observabilidad: pdf_imported en toda transición
// terminal y Sentry en todo fallo". The only adapter for ImportTelemetry
// (domain/import-telemetry.ts): `stage()` writes a structured server log
// (visible in Vercel's function logs); `finished()` sends `pdf_imported`
// through the injected Analytics (actions.ts composes it with
// createServerAnalytics from serverEnv()'s PostHog config, the same
// composition-root pattern identity/actions.ts already uses) and reports
// failures to Sentry with `warning` for `no_text_layer` and `error` for
// every other kind. Neither method ever throws or rejects — a telemetry
// failure must never fail the caller.
const WARNING_KIND: ImportFailureKind = "no_text_layer";

export class ImportTelemetryAdapter implements ImportTelemetry {
  constructor(private readonly analytics: Analytics) {}

  stage(
    job: ImportJob,
    stage: "download" | "extract" | "convert" | "persist",
    durationMs: number,
  ): void {
    try {
      console.info("[ingestion] stage", {
        importJobId: job.id,
        stage,
        durationMs,
      });
    } catch {
      // A logging failure must never interrupt processing.
    }
  }

  async finished(
    job: ImportJob,
    failure?: { kind: ImportFailureKind; cause?: unknown },
  ): Promise<void> {
    const durationMs = job.finishedAt
      ? job.finishedAt.getTime() - job.createdAt.getTime()
      : null;
    try {
      await this.analytics.track("pdf_imported", job.ownerId, {
        page_count: job.pageCount,
        pages_without_text: job.pagesWithoutText,
        duration_ms: durationMs,
        status: job.status === "done" ? "done" : "failed",
      });
    } catch (error) {
      console.error("[ingestion] pdf_imported tracking failed", {
        importJobId: job.id,
        error,
      });
    }

    if (!failure) return;
    try {
      const level = failure.kind === WARNING_KIND ? "warning" : "error";
      const extra = {
        importJobId: job.id,
        ownerId: job.ownerId,
        kind: failure.kind,
      };
      if (failure.cause instanceof Error) {
        Sentry.captureException(failure.cause, { level, extra });
      } else {
        Sentry.captureMessage(`pdf import failed: ${failure.kind}`, {
          level,
          extra,
        });
      }
    } catch {
      // Sentry reporting must never fail the caller.
    }
  }
}
