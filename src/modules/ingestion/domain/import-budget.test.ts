import { describe, expect, it } from "vitest";
import {
  ABANDONED_AFTER_MS,
  MAX_DURATION_S,
  PROCESSING_BUDGET_MS,
} from "./import-budget";

describe("import budget constants", () => {
  it("fixes MAX_DURATION_S to the Vercel function maxDuration (design.md)", () => {
    expect(MAX_DURATION_S).toBe(120);
  });

  it("keeps PROCESSING_BUDGET_MS strictly below MAX_DURATION_S with a safety margin", () => {
    expect(PROCESSING_BUDGET_MS).toBe(100_000);
    expect(PROCESSING_BUDGET_MS).toBeLessThan(MAX_DURATION_S * 1000);
  });

  it("derives ABANDONED_AFTER_MS from MAX_DURATION_S plus a 30 s margin", () => {
    expect(ABANDONED_AFTER_MS).toBe((MAX_DURATION_S + 30) * 1000);
  });
});
