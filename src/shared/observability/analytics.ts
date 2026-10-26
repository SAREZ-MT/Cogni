import { PostHog } from "posthog-node";

// The only product events this app may send. Adding one here is a product
// decision, not a code detail. `document_imported` (Fase 2's
// `pdf_imported`, renamed in document-import T10 once DOCX/PPTX import) is
// sent by ingestion's ImportTelemetryAdapter on every terminal import, with
// page_count/pages_without_text/duration_ms/status/format/skipped_images.
export type AnalyticsEvent =
  | "user_signed_up"
  | "user_signed_in"
  | "document_imported"
  | "generation_requested"
  | "terms_accepted";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;

export interface Analytics {
  track(
    event: AnalyticsEvent,
    distinctId: string,
    properties?: AnalyticsProperties,
  ): Promise<void>;
}

const noop: Analytics = { track: async () => undefined };

// Serverless functions are short-lived: a client per call with flushAt: 1
// and flushInterval: 0, shut down after the event, never loses a buffer.
// Analytics is never a dependency of the caller: any failure is swallowed
// and shutdown is capped well below the SDK's 30 s default.
const SHUTDOWN_TIMEOUT_MS = 2000;

export function createServerAnalytics(input: {
  key: string | undefined;
  host: string | undefined;
}): Analytics {
  if (!input.key) return noop;
  const { key, host } = input;
  return {
    async track(event, distinctId, properties) {
      try {
        const client = new PostHog(key, {
          host,
          flushAt: 1,
          flushInterval: 0,
        });
        client.capture({
          distinctId,
          event,
          ...(properties ? { properties } : {}),
        });
        await client.shutdown(SHUTDOWN_TIMEOUT_MS);
      } catch {
        // Losing one event is acceptable; failing the request is not.
      }
    },
  };
}
