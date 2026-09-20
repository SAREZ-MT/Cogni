import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/shared/observability/sentry-options";

Sentry.init(
  sentryOptions({
    dsn: process.env.SENTRY_DSN,
    vercelEnv: process.env.VERCEL_ENV,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  }),
);
