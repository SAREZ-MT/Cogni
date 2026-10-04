import type { QuotaStore } from "../application/ports";
import type { ProviderUsage } from "../domain";
import type { RedisLike } from "./redis-like";

const DAY_TTL_SECONDS = 48 * 3600;
const MINUTE_TTL_SECONDS = 120;

// Two counters per provider (documento-maestro §8.2), both bucketed in UTC:
//   {prefix}:ai:quota:{provider}:{yyyy-mm-dd}        TTL 48 h
//   {prefix}:ai:quota:{provider}:{yyyy-mm-dd-hh-mm}  TTL 120 s
export class UpstashQuotaStore implements QuotaStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix: string,
  ) {}

  private keys(providerId: string, now: Date) {
    const iso = now.toISOString(); // always UTC
    const base = `${this.prefix}:ai:quota:${providerId}`;
    return {
      day: `${base}:${iso.slice(0, 10)}`,
      minute: `${base}:${iso.slice(0, 16).replace("T", "-").replace(":", "-")}`,
    };
  }

  async readUsage(providerId: string, now: Date): Promise<ProviderUsage> {
    const keys = this.keys(providerId, now);
    const [day, minute] = await Promise.all([
      this.redis.get<number | string>(keys.day),
      this.redis.get<number | string>(keys.minute),
    ]);
    return { day: Number(day ?? 0), minute: Number(minute ?? 0) };
  }

  async recordCall(providerId: string, now: Date): Promise<void> {
    const keys = this.keys(providerId, now);
    const pipeline = this.redis.pipeline();
    pipeline.incr(keys.day);
    pipeline.expire(keys.day, DAY_TTL_SECONDS);
    pipeline.incr(keys.minute);
    pipeline.expire(keys.minute, MINUTE_TTL_SECONDS);
    await pipeline.exec();
  }
}
