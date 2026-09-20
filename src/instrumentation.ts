import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once per runtime at boot.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Server Components, Server Actions and route handlers that throw land here.
export const onRequestError = Sentry.captureRequestError;
