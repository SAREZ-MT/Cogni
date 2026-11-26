import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { sentryOptions } from "./shared/observability/sentry-options";

// Runs in the browser before hydration. Each variable is referenced
// literally so Next.js inlines it into the bundle.
Sentry.init(
  sentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    commitSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Explicit events only: no autocapture, no automatic pageviews. Phase 0
// declares user_signed_up and user_signed_in, both sent from the server.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    // Session replay needs explicit opt-in consent. Keep it off in code so
    // a project-side toggle in PostHog cannot turn it on by itself.
    disable_session_recording: true,
    persistence: "localStorage+cookie",
  });
}
