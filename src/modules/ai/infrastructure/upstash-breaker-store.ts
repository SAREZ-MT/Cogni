import type { BreakerStore } from "../application/ports";
import { type BreakerState, initialBreakerState } from "../domain";
import type { RedisLike } from "./redis-like";

const BREAKER_TTL_SECONDS = 3600;

interface StoredBreaker {
  consecutiveFailures: number;
  openedAt: string | null;
}

function isStoredBreaker(value: unknown): value is StoredBreaker {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.consecutiveFailures === "number" &&
    (v.openedAt === null || typeof v.openedAt === "string")
  );
}

// Key {prefix}:ai:breaker:{provider}, JSON state, TTL 1 h. A missing or
// corrupted value reads as the closed state: a broken breaker record must
// never take a provider out of rotation.
export class UpstashBreakerStore implements BreakerStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix: string,
  ) {}

  private key(providerId: string): string {
    return `${this.prefix}:ai:breaker:${providerId}`;
  }

  async read(providerId: string): Promise<BreakerState> {
    const raw = await this.redis.get<unknown>(this.key(providerId));
    if (raw === null) return initialBreakerState;
    let value: unknown = raw;
    // Upstash auto-deserializes JSON strings; accept both shapes.
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        return initialBreakerState;
      }
    }
    if (!isStoredBreaker(value)) return initialBreakerState;
    return {
      consecutiveFailures: value.consecutiveFailures,
      openedAt: value.openedAt === null ? null : new Date(value.openedAt),
    };
  }

  async write(providerId: string, state: BreakerState): Promise<void> {
    const stored: StoredBreaker = {
      consecutiveFailures: state.consecutiveFailures,
      openedAt: state.openedAt === null ? null : state.openedAt.toISOString(),
    };
    await this.redis.set(this.key(providerId), JSON.stringify(stored), {
      ex: BREAKER_TTL_SECONDS,
    });
  }
}
