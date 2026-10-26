import type { Clock } from "@/shared/kernel/clock";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
} from "./rate-limiter";

// Fixed window per key, in process memory. Used when Upstash is not
// configured (AI_PROVIDER_MODE=fake: CI, e2e, local dev) and in tests;
// counts are per server process, so it is a convenience, not a guarantee.
export function createInMemoryRateLimiter(
  rule: RateLimitRule,
  clock: Clock,
): RateLimiter {
  const windows = new Map<string, { startedAt: number; used: number }>();
  return {
    async consume(key): Promise<RateLimitDecision> {
      const now = clock.now().getTime();
      let window = windows.get(key);
      if (!window || now - window.startedAt >= rule.windowMs) {
        window = { startedAt: now, used: 0 };
        windows.set(key, window);
      }
      const resetAt = new Date(window.startedAt + rule.windowMs);
      if (window.used >= rule.limit) return { allowed: false, resetAt };
      window.used++;
      return { allowed: true, resetAt };
    },
  };
}
