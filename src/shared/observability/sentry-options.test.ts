import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

describe("sentryOptions", () => {
  it("derives environment and release from Vercel", () => {
    expect(
      sentryOptions({
        dsn: "https://k@o.ingest.sentry.io/1",
        vercelEnv: "production",
        commitSha: "abc123",
      }),
    ).toMatchObject({
      dsn: "https://k@o.ingest.sentry.io/1",
      environment: "production",
      release: "abc123",
      enabled: true,
    });
  });

  it("is disabled without a DSN so local runs send nothing", () => {
    expect(sentryOptions({ dsn: undefined })).toMatchObject({
      enabled: false,
      environment: "development",
    });
  });

  it("keeps tracing off and marks previews as preview", () => {
    const options = sentryOptions({
      dsn: "https://k@o.ingest.sentry.io/1",
      vercelEnv: "preview",
    });
    expect(options.environment).toBe("preview");
    expect(options.tracesSampleRate).toBe(0);
  });
});
