import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { GENERATION_TECHNIQUES } from "@/shared/kernel/generation-fingerprints";
import {
  GENERATION_FINGERPRINT_TECHNIQUES,
  generationFingerprints,
  profiles,
} from "./schema";

describe("profiles table", () => {
  // The publishable key reaches the browser, so PostgREST exposes every
  // public table without RLS. The app only reads profiles through the
  // server connection, which bypasses RLS; nobody else may touch the rows.
  it("enables row level security so PostgREST cannot expose rows", () => {
    expect(getTableConfig(profiles).enableRLS).toBe(true);
  });
});

describe("generation_fingerprints table", () => {
  it("enables row level security like every business table", () => {
    expect(getTableConfig(generationFingerprints).enableRLS).toBe(true);
  });

  it("accepts exactly the kernel's generation techniques", () => {
    expect([...GENERATION_FINGERPRINT_TECHNIQUES]).toEqual([
      ...GENERATION_TECHNIQUES,
    ]);
  });
});
