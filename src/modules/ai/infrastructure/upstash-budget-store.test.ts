import { describe, expect, it } from "vitest";
import { InMemoryRedis } from "./testing/in-memory-redis";
import { UpstashBudgetStore } from "./upstash-budget-store";

const NOW = new Date("2026-11-23T14:05:30Z");
const LIMITS = { generation: 2, evaluation: 1, feedback: 1 };

describe("UpstashBudgetStore", () => {
  it("allows calls up to the group's daily budget and refuses the next", async () => {
    const store = new UpstashBudgetStore(new InMemoryRedis(), "p", LIMITS);
    expect(await store.consume("generation", NOW)).toBe(true);
    expect(await store.consume("generation", NOW)).toBe(true);
    expect(await store.consume("generation", NOW)).toBe(false);
  });

  it("counts under a UTC day key with a 48 h TTL", async () => {
    const redis = new InMemoryRedis();
    const store = new UpstashBudgetStore(redis, "cogni:test", LIMITS);
    await store.consume("feedback", NOW);
    const key = "cogni:test:ai:budget:feedback:2026-11-23";
    expect(redis.values.get(key)).toBe(1);
    expect(redis.ttls.get(key)).toBe(48 * 3600);
  });

  it("keeps groups and days separate", async () => {
    const store = new UpstashBudgetStore(new InMemoryRedis(), "p", LIMITS);
    expect(await store.consume("evaluation", NOW)).toBe(true);
    expect(await store.consume("evaluation", NOW)).toBe(false);
    expect(await store.consume("feedback", NOW)).toBe(true);
    const tomorrow = new Date("2026-11-24T00:00:01Z");
    expect(await store.consume("evaluation", tomorrow)).toBe(true);
  });

  it("refuses when the counter cannot be read back", async () => {
    const redis = new InMemoryRedis();
    redis.pipeline = () => {
      const pipeline = {
        incr: () => pipeline,
        expire: () => pipeline,
        exec: async () => [null, 1],
      };
      return pipeline;
    };
    const store = new UpstashBudgetStore(redis, "p", LIMITS);
    expect(await store.consume("generation", NOW)).toBe(false);
  });
});
