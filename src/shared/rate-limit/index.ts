import type { Clock } from "@/shared/kernel/clock";
import { createInMemoryRateLimiter } from "./in-memory-rate-limiter";
import type { RateLimiter, RateLimitRule } from "./rate-limiter";
import { createUpstashRateLimiter } from "./upstash-rate-limiter";

export { createInMemoryRateLimiter } from "./in-memory-rate-limiter";
export type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
} from "./rate-limiter";

// document-import T9b: picks the limiter for a rule from the existing
// configuration, the same switch the AI layer uses (ai/server-api.ts):
// `AI_PROVIDER_MODE=live` → Upstash (its credentials are required in live
// mode by env.schema.ts); `fake` → in memory, one shared counter set per
// rule name for the whole process, so limits still hold across the
// per-request composition roots of a dev server or an e2e run.
const inMemory = new Map<string, RateLimiter>();

export function createRateLimiter(
  rule: RateLimitRule,
  config: {
    mode: "live" | "fake";
    upstashUrl?: string;
    upstashToken?: string;
    prefix: string;
    clock: Clock;
  },
): RateLimiter {
  if (config.mode === "live") {
    if (!config.upstashUrl || !config.upstashToken) {
      throw new Error("Upstash credentials are required in live mode");
    }
    return createUpstashRateLimiter({
      rule,
      url: config.upstashUrl,
      token: config.upstashToken,
      prefix: config.prefix,
    });
  }
  const key = `${rule.name}:${rule.limit}:${rule.windowMs}`;
  let limiter = inMemory.get(key);
  if (!limiter) {
    limiter = createInMemoryRateLimiter(rule, config.clock);
    inMemory.set(key, limiter);
  }
  return limiter;
}
