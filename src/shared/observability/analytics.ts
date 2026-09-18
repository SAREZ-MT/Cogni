import { PostHog } from "posthog-node";

// The only product events phase 0 may send. Adding one here is a product
// decision, not a code detail.
export type AnalyticsEvent = "user_signed_up" | "user_signed_in";

export interface Analytics {
  track(event: AnalyticsEvent, distinctId: string): Promise<void>;
}

const noop: Analytics = { track: async () => undefined };

// Serverless functions are short-lived: a client per call with flushAt: 1
// and flushInterval: 0, shut down after the event, never loses a buffer.
export function createServerAnalytics(input: {
  key: string | undefined;
  host: string | undefined;
}): Analytics {
  if (!input.key) return noop;
  const { key, host } = input;
  return {
    async track(event, distinctId) {
      const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
      client.capture({ distinctId, event });
      await client.shutdown();
    },
  };
}
