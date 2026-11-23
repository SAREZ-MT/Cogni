import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { GenerationRateLimiter } from "../application/ports";

// Daily limit per key: fixed window of 1 day under `{prefix}:ai:{scope}`,
// one scope per limit so they never share a counter:
// - `gen`: generations per owner (AI_DAILY_GENERATIONS, ADR 0004)
// - `eval`: recall sessions evaluated by the model per owner
//   (AI_DAILY_EVALUATIONS)
// - `feedback`: session feedbacks per owner (AI_DAILY_FEEDBACKS)
// - `evalrun`: model evaluation runs per recall session (keyed by session)
// `limit()` consumes one unit when it succeeds.
// `Ratelimit.fixedWindow(tokens, window)` and the `limit()` result
// (`success`, `remaining`, `reset` in unix ms) were verified with Context7.
export type DailyLimitScope = "gen" | "eval" | "feedback" | "evalrun";

export function createDailyGenerationLimiter(options: {
  redis: Redis;
  prefix: string;
  limit: number;
  scope?: DailyLimitScope;
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
