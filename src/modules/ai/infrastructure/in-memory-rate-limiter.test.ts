import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createInMemoryGenerationLimiter } from "./in-memory-rate-limiter";

const clock = createFixedClock(new Date("2026-10-04T10:00:00.000Z"));

describe("createInMemoryGenerationLimiter", () => {
  it("consumes one unit per check until the limit", async () => {
    const limiter = createInMemoryGenerationLimiter({ limit: 2, clock });
    expect((await limiter.check("a")).remaining).toBe(1);
    expect((await limiter.check("a")).remaining).toBe(0);
    expect((await limiter.check("a")).allowed).toBe(false);
  });

  it("peek reports the remaining units without consuming one", async () => {
    const limiter = createInMemoryGenerationLimiter({ limit: 2, clock });
    expect((await limiter.peek("a")).remaining).toBe(2);
    await limiter.check("a");
    expect(await limiter.peek("a")).toEqual({
      allowed: true,
      remaining: 1,
      resetAt: new Date("2026-10-05T00:00:00.000Z"),
    });
    expect((await limiter.check("a")).remaining).toBe(0);
    expect((await limiter.peek("a")).allowed).toBe(false);
  });
});
