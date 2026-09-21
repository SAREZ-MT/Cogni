import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "./env.schema";

const client = {
  NEXT_PUBLIC_SITE_URL: "https://cogni.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

const server = {
  ...client,
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
  DATABASE_URL: "postgresql://u:p@host:6543/postgres",
  CRON_SECRET: "0123456789abcdef0123456789abcdef",
  SUPABASE_STORAGE_BUCKET: "page-assets",
};

describe("parseClientEnv", () => {
  it("exposes the public variables when they are valid", () => {
    expect(parseClientEnv(client)).toEqual({
      ...client,
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      NEXT_PUBLIC_POSTHOG_KEY: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
  });

  it("names the missing variable", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _, ...missing } = client;
    expect(() => parseClientEnv(missing)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a Supabase URL that is not the project root", () => {
    expect(() =>
      parseClientEnv({
        ...client,
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/rest/v1/",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("never carries server secrets", () => {
    expect(parseClientEnv(server)).not.toHaveProperty(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(parseClientEnv(server)).not.toHaveProperty("DATABASE_URL");
  });
});

describe("parseServerEnv", () => {
  it("requires the database, service role and cron secret", () => {
    expect(parseServerEnv(server)).toMatchObject({
      DATABASE_URL: server.DATABASE_URL,
      CRON_SECRET: server.CRON_SECRET,
    });
  });

  it("fails at boot naming DATABASE_URL when it is absent", () => {
    const { DATABASE_URL: _, ...missing } = server;
    expect(() => parseServerEnv(missing)).toThrow(/DATABASE_URL/);
  });

  it("rejects a short cron secret", () => {
    expect(() => parseServerEnv({ ...server, CRON_SECRET: "short" })).toThrow(
      /CRON_SECRET/,
    );
  });

  it("fails at boot naming SUPABASE_STORAGE_BUCKET when it is absent", () => {
    const { SUPABASE_STORAGE_BUCKET: _, ...missing } = server;
    expect(() => parseServerEnv(missing)).toThrow(/SUPABASE_STORAGE_BUCKET/);
  });

  it("treats an empty optional variable as unset (.env.example ships blanks)", () => {
    const parsed = parseServerEnv({
      ...server,
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
    });
    expect(parsed.SENTRY_DSN).toBeUndefined();
    expect(parsed.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
  });

  it("keeps observability keys optional", () => {
    expect(parseServerEnv(server).SENTRY_DSN).toBeUndefined();
    expect(
      parseServerEnv({
        ...server,
        SENTRY_DSN: "https://k@o.ingest.sentry.io/1",
      }).SENTRY_DSN,
    ).toBe("https://k@o.ingest.sentry.io/1");
  });
});
