import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
} from "./rate-limiter";

// Sliding window per key under `{prefix}:rl:{rule.name}` in the same
// Upstash database the AI layer uses (UPSTASH_REDIS_REST_URL/TOKEN,
// REDIS_KEY_PREFIX; no new variable). `Ratelimit.slidingWindow(tokens,
// window)` and `limit()`'s `success`/`reset` (unix ms) are the same API
// ai/infrastructure/upstash-rate-limiter.ts uses (verified with Context7).
//
// Fails open: when Redis cannot be reached the attempt is allowed and the
// error logged, so an Upstash outage never blocks imports. Callers keep
// their own hard bounds (ingestion also caps a user's active jobs in the
// database).
export function createUpstashRateLimiter(options: {
  rule: RateLimitRule;
  url: string;
  token: string;
  prefix: string;
}): RateLimiter {
  const ratelimit = new Ratelimit({
    redis: new Redis({ url: options.url, token: options.token }),
    limiter: Ratelimit.slidingWindow(
      options.rule.limit,
      `${Math.max(1, Math.round(options.rule.windowMs / 1000))} s`,
    ),
    prefix: `${options.prefix}:rl:${options.rule.name}`,
  });
  return {
    async consume(key): Promise<RateLimitDecision> {
      try {
        const result = await ratelimit.limit(key);
        return { allowed: result.success, resetAt: new Date(result.reset) };
      } catch (error) {
        console.error("rate-limit: Upstash unavailable, allowing", {
          rule: options.rule.name,
          error,
        });
        return { allowed: true, resetAt: new Date() };
      }
    },
  };
}
