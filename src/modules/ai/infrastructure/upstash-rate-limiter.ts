import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { GenerationRateLimiter } from "../application/ports";

// Per-owner daily limit: fixed window of 1 day under `{prefix}:ai:{scope}`
// — `gen` for generations (AI_DAILY_GENERATIONS, ADR 0004) and `eval` for
// answers evaluated by the model (AI_DAILY_EVALUATIONS, Phase 6), so the two
// limits never share a counter. `limit()` consumes one unit when it succeeds.
// `Ratelimit.fixedWindow(tokens, window)` and the `limit()` result
// (`success`, `remaining`, `reset` in unix ms) were verified with Context7.
export function createDailyGenerationLimiter(options: {
  redis: Redis;
  prefix: string;
  limit: number;
  scope?: "gen" | "eval";
}): GenerationRateLimiter {
  const ratelimit = new Ratelimit({
    redis: options.redis,
    limiter: Ratelimit.fixedWindow(options.limit, "1 d"),
    prefix: `${options.prefix}:ai:${options.scope ?? "gen"}`,
  });
  return {
    async check(ownerId) {
      const result = await ratelimit.limit(ownerId);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: new Date(result.reset),
      };
    },
    // `getRemaining` reads the window without consuming a unit.
    async peek(ownerId) {
      const result = await ratelimit.getRemaining(ownerId);
      return {
        allowed: result.remaining > 0,
        remaining: result.remaining,
        resetAt: new Date(result.reset),
      };
    },
  };
}
