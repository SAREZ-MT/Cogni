import type { Clock } from "@/shared/kernel/clock";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
} from "./rate-limiter";

type Window = { startedAt: number; used: number };

// Fixed window per key, in process memory. Used when Upstash is not
// configured (AI_PROVIDER_MODE=fake: CI, e2e, local dev) and in tests;
// counts are per server process, so it is a convenience, not a guarantee.
//
// document-import T10 (T9b review: the map only ever grew): windows that
// ended are evicted on access — at most one sweep per window length, so a
// consume stays amortized O(1) and the map holds only the keys seen during
// the last two windows. `windows` is injectable so tests can observe it.
export function createInMemoryRateLimiter(
  rule: RateLimitRule,
  clock: Clock,
  windows: Map<string, Window> = new Map(),
): RateLimiter {
  let lastSweep = Number.NEGATIVE_INFINITY;
  const sweep = (now: number) => {
    if (now - lastSweep < rule.windowMs) return;
    lastSweep = now;
    for (const [key, window] of windows) {
      if (now - window.startedAt >= rule.windowMs) windows.delete(key);
    }
  };
  return {
    async consume(key): Promise<RateLimitDecision> {
      const now = clock.now().getTime();
      sweep(now);
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
