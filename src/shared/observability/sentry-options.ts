// Shared between server, edge and client Sentry.init calls. Pure so it can
// be unit tested; callers pass the values they read from their environment.
export interface SentryOptionsInput {
  dsn: string | undefined;
  vercelEnv?: string;
  commitSha?: string;
}

export function sentryOptions(input: SentryOptionsInput) {
  return {
    dsn: input.dsn,
    // Local runs have no DSN and must never report.
    enabled: Boolean(input.dsn),
    environment: input.vercelEnv ?? "development",
    release: input.commitSha,
    // Errors only in phase 0; tracing is a paid-quota decision for later.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  };
}
