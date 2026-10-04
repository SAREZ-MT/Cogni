import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { GenerationRateLimiter } from "../application/ports";

// Per-owner daily generation limit: fixed window of 1 day under
// `{prefix}:ai:gen`. `limit()` consumes one unit when it succeeds.
// `Ratelimit.fixedWindow(tokens, window)` and the `limit()` result
// (`success`, `remaining`, `reset` in unix ms) were verified with Context7.
export function createDailyGenerationLimiter(options: {
  redis: Redis;
  prefix: string;
  limit: number;
}): GenerationRateLimiter {
  const ratelimit = new Ratelimit({
    redis: options.redis,
    limiter: Ratelimit.fixedWindow(options.limit, "1 d"),
    prefix: `${options.prefix}:ai:gen`,
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
