import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  slidingWindowArgs: [] as unknown[][],
  redisOptions: [] as unknown[],
  counts: new Map<string, number>(),
  failing: false,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(options: unknown) {
      state.redisOptions.push(options);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow(...args: unknown[]) {
      state.slidingWindowArgs.push(args);
      return { args };
    }
    private readonly max: number;
    private readonly prefix: string;
    constructor(options: Record<string, unknown>) {
      state.options.push(options);
      this.max = (options.limiter as { args: [number] }).args[0];
      this.prefix = options.prefix as string;
    }
    async limit(identifier: string) {
      if (state.failing) throw new Error("ECONNREFUSED");
      const key = `${this.prefix}:${identifier}`;
      const used = (state.counts.get(key) ?? 0) + 1;
      state.counts.set(key, used);
      return { success: used <= this.max, reset: 1_790_000_000_000 };
    }
  }
  return { Ratelimit };
});

const { createInMemoryRateLimiter, createRateLimiter } = await import(
  "./index"
);

const RULE = { name: "import-start", limit: 2, windowMs: 3_600_000 };

function clockAt(iso: string) {
  let now = new Date(iso);
  return {
    now: () => now,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

beforeEach(() => {
  state.options.length = 0;
  state.slidingWindowArgs.length = 0;
  state.redisOptions.length = 0;
  state.counts.clear();
  state.failing = false;
});

describe("createInMemoryRateLimiter", () => {
  it("allows `limit` attempts per key and window, then refuses until the window resets", async () => {
    const clock = clockAt("2026-10-26T10:00:00.000Z");
    const limiter = createInMemoryRateLimiter(RULE, clock);

    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(true);
    const refused = await limiter.consume("a");
    expect(refused).toEqual({
      allowed: false,
      resetAt: new Date("2026-10-26T11:00:00.000Z"),
    });
    expect((await limiter.consume("b")).allowed).toBe(true);

    clock.advance(RULE.windowMs);
    expect((await limiter.consume("a")).allowed).toBe(true);
  });
});

describe("createRateLimiter", () => {
  it("uses Upstash in live mode with the shared prefix and a sliding window", async () => {
    const limiter = createRateLimiter(RULE, {
      mode: "live",
      upstashUrl: "https://example.upstash.io",
      upstashToken: "token",
      prefix: "cogni:test",
      clock: clockAt("2026-10-26T10:00:00.000Z"),
    });

    expect(state.redisOptions).toEqual([
      { url: "https://example.upstash.io", token: "token" },
    ]);
    expect(state.slidingWindowArgs).toEqual([[2, "3600 s"]]);
    expect(state.options[0].prefix).toBe("cogni:test:rl:import-start");
    expect((await limiter.consume("u1")).allowed).toBe(true);
    expect((await limiter.consume("u1")).allowed).toBe(true);
    expect((await limiter.consume("u1")).allowed).toBe(false);
  });

  it("fails open and logs when Upstash is unreachable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const limiter = createRateLimiter(RULE, {
        mode: "live",
        upstashUrl: "https://example.upstash.io",
        upstashToken: "token",
        prefix: "cogni:test",
        clock: clockAt("2026-10-26T10:00:00.000Z"),
      });
      state.failing = true;

      expect((await limiter.consume("u1")).allowed).toBe(true);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refuses to run live without Upstash credentials", () => {
    expect(() =>
      createRateLimiter(RULE, {
        mode: "live",
        prefix: "cogni:test",
        clock: clockAt("2026-10-26T10:00:00.000Z"),
      }),
    ).toThrow(/Upstash credentials/);
  });

  it("shares one in-memory limiter per rule across calls in fake mode", async () => {
    const rule = { ...RULE, name: "fake-shared" };
    const config = {
      mode: "fake" as const,
      prefix: "cogni:test",
      clock: clockAt("2026-10-26T10:00:00.000Z"),
    };

    await createRateLimiter(rule, config).consume("u1");
    await createRateLimiter(rule, config).consume("u1");
    const third = await createRateLimiter(rule, config).consume("u1");

    expect(third.allowed).toBe(false);
    expect(state.options).toHaveLength(0);
  });
});
