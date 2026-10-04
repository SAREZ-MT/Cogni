import type { Clock } from "@/shared/kernel/clock";
import type { GenerationRateLimiter } from "../application/ports";

// Fixed UTC-day window per owner, in process memory. Only for fake mode
// (e2e and CI), where Upstash is not configured.
export function createInMemoryGenerationLimiter(options: {
  limit: number;
  clock: Clock;
}): GenerationRateLimiter {
  const counts = new Map<string, number>();

  function window(ownerId: string) {
    const day = options.clock.now().toISOString().slice(0, 10);
    const resetAt = new Date(`${day}T00:00:00.000Z`);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    const key = `${ownerId}:${day}`;
    return { key, used: counts.get(key) ?? 0, resetAt };
  }

  return {
    async check(ownerId) {
      const { key, used, resetAt } = window(ownerId);
      if (used >= options.limit) {
        return { allowed: false, remaining: 0, resetAt };
      }
      counts.set(key, used + 1);
      return { allowed: true, remaining: options.limit - used - 1, resetAt };
    },
    async peek(ownerId) {
      const { used, resetAt } = window(ownerId);
      const remaining = Math.max(0, options.limit - used);
      return { allowed: remaining > 0, remaining, resetAt };
    },
  };
}
