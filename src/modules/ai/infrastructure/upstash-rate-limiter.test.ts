import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRedis } from "./testing/in-memory-redis";

const state = vi.hoisted(() => ({
  fixedWindowArgs: [] as unknown[][],
  constructorOptions: [] as Record<string, unknown>[],
  counts: new Map<string, number>(),
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static fixedWindow(...args: unknown[]) {
      state.fixedWindowArgs.push(args);
      return { algorithm: "fixedWindow", args };
    }
    private readonly max: number;
    constructor(options: Record<string, unknown>) {
      state.constructorOptions.push(options);
      this.max = (options.limiter as { args: [number] }).args[0];
    }
    async limit(identifier: string) {
      const used = (state.counts.get(identifier) ?? 0) + 1;
      state.counts.set(identifier, used);
      return {
        success: used <= this.max,
        limit: this.max,
        remaining: Math.max(0, this.max - used),
        reset: 1_790_000_000_000,
        pending: Promise.resolve(),
      };
    }
  }
  return { Ratelimit };
});

import { createDailyGenerationLimiter } from "./upstash-rate-limiter";

describe("createDailyGenerationLimiter", () => {
  beforeEach(() => {
    state.fixedWindowArgs.length = 0;
    state.constructorOptions.length = 0;
    state.counts.clear();
  });

  it("builds a one-day fixed window under the prefixed key", () => {
    createDailyGenerationLimiter({
      redis: new InMemoryRedis() as never,
      prefix: "cogni:test",
      limit: 6,
    });
    expect(state.fixedWindowArgs).toEqual([[6, "1 d"]]);
    expect(state.constructorOptions[0]?.prefix).toBe("cogni:test:ai:gen");
  });

  it("allows `limit` checks then blocks with remaining 0", async () => {
    const limiter = createDailyGenerationLimiter({
      redis: new InMemoryRedis() as never,
      prefix: "p",
      limit: 2,
    });
    const first = await limiter.check("owner-1");
    expect(first).toEqual({
      allowed: true,
      remaining: 1,
      resetAt: new Date(1_790_000_000_000),
    });
    expect((await limiter.check("owner-1")).remaining).toBe(0);
    const third = await limiter.check("owner-1");
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("counts owners independently", async () => {
    const limiter = createDailyGenerationLimiter({
      redis: new InMemoryRedis() as never,
      prefix: "p",
      limit: 1,
    });
    await limiter.check("a");
    expect((await limiter.check("b")).allowed).toBe(true);
  });
});
