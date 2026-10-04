import { describe, expect, it } from "vitest";
import type { GenerationRateLimiter } from "@/modules/ai";
import { getGenerationStatus } from "./get-generation-status";

const RESET = new Date("2026-10-05T00:00:00.000Z");

describe("getGenerationStatus", () => {
  it("reports the remaining generations through peek, never check", async () => {
    let checks = 0;
    const limiter: GenerationRateLimiter = {
      async check() {
        checks += 1;
        return { allowed: true, remaining: 0, resetAt: RESET };
      },
      async peek() {
        return { allowed: true, remaining: 4, resetAt: RESET };
      },
    };

    const result = await getGenerationStatus({ limiter }, "o1");

    expect(result).toEqual({
      ok: true,
      value: { remainingToday: 4, resetAt: RESET },
    });
    expect(checks).toBe(0);
  });
});
