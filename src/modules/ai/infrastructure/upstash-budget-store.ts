import type { BudgetStore } from "../application/ports";
import type { AiBudgetGroup } from "../domain";
import type { RedisLike } from "./redis-like";
import { QUOTA_DAY_TTL_SECONDS } from "./upstash-quota-store";

// One counter per group and UTC day, shared by every user:
//   {prefix}:ai:budget:{group}:{yyyy-mm-dd}   TTL 48 h
// `consume` increments first and then compares, so concurrent calls can
// never pass the budget together. A refused call still counts; the counter
// only matters up to the limit. A reply without a numeric counter refuses
// (fail closed).
export class UpstashBudgetStore implements BudgetStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix: string,
    private readonly limits: Readonly<Record<AiBudgetGroup, number>>,
  ) {}

  async consume(group: AiBudgetGroup, now: Date): Promise<boolean> {
    const day = now.toISOString().slice(0, 10);
    const key = `${this.prefix}:ai:budget:${group}:${day}`;
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, QUOTA_DAY_TTL_SECONDS);
    const replies = await pipeline.exec();
    const used = Array.isArray(replies) ? replies[0] : null;
    return typeof used === "number" && used <= this.limits[group];
  }
}
