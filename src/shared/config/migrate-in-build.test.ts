import { describe, expect, it } from "vitest";
import { shouldRunMigrations } from "../../../scripts/migrate-in-build.mjs";

describe("shouldRunMigrations", () => {
  it("runs migrations in production", () => {
    expect(shouldRunMigrations({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("skips migrations in preview", () => {
    expect(shouldRunMigrations({ VERCEL_ENV: "preview" })).toBe(false);
  });

  it("skips migrations in development", () => {
    expect(shouldRunMigrations({ VERCEL_ENV: "development" })).toBe(false);
  });

  it("skips migrations when VERCEL_ENV is unset", () => {
    expect(shouldRunMigrations({})).toBe(false);
  });

  it("runs migrations when RUN_DB_MIGRATIONS=1 even in preview", () => {
    expect(
      shouldRunMigrations({ VERCEL_ENV: "preview", RUN_DB_MIGRATIONS: "1" }),
    ).toBe(true);
  });
});
