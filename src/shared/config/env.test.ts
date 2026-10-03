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
  SUPABASE_PDF_BUCKET: "page-pdfs",
  // Fake mode keeps the AI provider keys optional for the non-AI tests.
  AI_PROVIDER_MODE: "fake",
};

const live = {
  ...server,
  AI_PROVIDER_MODE: "live",
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  GOOGLE_GENERATIVE_AI_API_KEY: "g-key",
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

  it("exposes SUPABASE_PDF_BUCKET when it is set", () => {
    expect(parseServerEnv(server).SUPABASE_PDF_BUCKET).toBe("page-pdfs");
  });

  it("fails at boot naming SUPABASE_PDF_BUCKET when it is absent", () => {
    const { SUPABASE_PDF_BUCKET: _, ...missing } = server;
    expect(() => parseServerEnv(missing)).toThrow(/SUPABASE_PDF_BUCKET/);
  });

  it("rejects an empty SUPABASE_PDF_BUCKET", () => {
    expect(() =>
      parseServerEnv({ ...server, SUPABASE_PDF_BUCKET: "" }),
    ).toThrow(/SUPABASE_PDF_BUCKET/);
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

describe("parseServerEnv AI layer", () => {
  it("applies the AI defaults in fake mode", () => {
    const { AI_PROVIDER_MODE: _, ...noMode } = server;
    const parsed = parseServerEnv({ ...noMode, AI_PROVIDER_MODE: "fake" });
    expect(parsed).toMatchObject({
      AI_PROVIDER_MODE: "fake",
      AI_DAILY_GENERATIONS: 6,
      AI_PAGE_TOKEN_CAP: 12000,
      REDIS_KEY_PREFIX: "cogni:dev",
    });
  });

  it("defaults to live mode and fails naming every missing live variable", () => {
    const { AI_PROVIDER_MODE: _, ...noMode } = server;
    let message = "";
    try {
      parseServerEnv(noMode);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/UPSTASH_REDIS_REST_URL/);
    expect(message).toMatch(/UPSTASH_REDIS_REST_TOKEN/);
    expect(message).toMatch(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });

  it("passes in fake mode with no provider or Upstash variables", () => {
    expect(() => parseServerEnv(server)).not.toThrow();
  });

  it("passes in live mode with Upstash and one provider key", () => {
    expect(parseServerEnv(live).GOOGLE_GENERATIVE_AI_API_KEY).toBe("g-key");
  });

  it("accepts OpenRouter alone as the generation provider", () => {
    const { GOOGLE_GENERATIVE_AI_API_KEY: _, ...noGoogle } = live;
    expect(() =>
      parseServerEnv({ ...noGoogle, OPENROUTER_API_KEY: "or-key" }),
    ).not.toThrow();
  });

  it("requires both Cloudflare variables together", () => {
    const { GOOGLE_GENERATIVE_AI_API_KEY: _, ...noGoogle } = live;
    expect(() =>
      parseServerEnv({ ...noGoogle, CLOUDFLARE_ACCOUNT_ID: "acc" }),
    ).toThrow(/CLOUDFLARE_API_TOKEN/);
    expect(() =>
      parseServerEnv({ ...noGoogle, CLOUDFLARE_API_TOKEN: "tok" }),
    ).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    expect(() =>
      parseServerEnv({
        ...noGoogle,
        CLOUDFLARE_ACCOUNT_ID: "acc",
        CLOUDFLARE_API_TOKEN: "tok",
      }),
    ).not.toThrow();
  });

  it("requires Cloudflare pairs even when another provider is set", () => {
    expect(() =>
      parseServerEnv({ ...live, CLOUDFLARE_ACCOUNT_ID: "acc" }),
    ).toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it("coerces and bounds the numeric limits", () => {
    const parsed = parseServerEnv({
      ...live,
      AI_DAILY_GENERATIONS: "10",
      AI_PAGE_TOKEN_CAP: "8000",
    });
    expect(parsed.AI_DAILY_GENERATIONS).toBe(10);
    expect(parsed.AI_PAGE_TOKEN_CAP).toBe(8000);
    expect(() =>
      parseServerEnv({ ...live, AI_DAILY_GENERATIONS: "0" }),
    ).toThrow(/AI_DAILY_GENERATIONS/);
  });

  it("rejects an unknown provider mode", () => {
    expect(() =>
      parseServerEnv({ ...server, AI_PROVIDER_MODE: "mock" }),
    ).toThrow(/AI_PROVIDER_MODE/);
  });
});
