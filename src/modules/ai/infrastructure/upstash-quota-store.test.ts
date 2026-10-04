import { describe, expect, it } from "vitest";
import { InMemoryRedis } from "./testing/in-memory-redis";
import { UpstashQuotaStore } from "./upstash-quota-store";

const NOW = new Date("2026-10-03T14:05:30Z");

describe("UpstashQuotaStore", () => {
  it("reads zero usage when no key exists", async () => {
    const store = new UpstashQuotaStore(new InMemoryRedis(), "cogni:test");
    expect(await store.readUsage("gemini-flash-lite", NOW)).toEqual({
      day: 0,
      minute: 0,
    });
  });

  it("increments the UTC day and minute keys with their TTLs", async () => {
    const redis = new InMemoryRedis();
    const store = new UpstashQuotaStore(redis, "cogni:test");
    await store.recordCall("gemini-flash-lite", NOW);
    await store.recordCall("gemini-flash-lite", NOW);

    const day = "cogni:test:ai:quota:gemini-flash-lite:2026-10-03";
    const minute = "cogni:test:ai:quota:gemini-flash-lite:2026-10-03-14-05";
    expect(redis.values.get(day)).toBe(2);
    expect(redis.values.get(minute)).toBe(2);
    expect(redis.ttls.get(day)).toBe(48 * 3600);
    expect(redis.ttls.get(minute)).toBe(120);
    expect(await store.readUsage("gemini-flash-lite", NOW)).toEqual({
      day: 2,
      minute: 2,
    });
  });

  it("uses UTC even near a day boundary", async () => {
    const redis = new InMemoryRedis();
    const store = new UpstashQuotaStore(redis, "p");
    await store.recordCall("x", new Date("2026-12-31T23:59:59Z"));
    expect([...redis.values.keys()]).toEqual([
      "p:ai:quota:x:2026-12-31",
      "p:ai:quota:x:2026-12-31-23-59",
    ]);
  });

  it("keeps providers and minutes separate", async () => {
    const store = new UpstashQuotaStore(new InMemoryRedis(), "p");
    await store.recordCall("a", NOW);
    expect(await store.readUsage("b", NOW)).toEqual({ day: 0, minute: 0 });
    const later = new Date("2026-10-03T14:06:00Z");
    expect(await store.readUsage("a", later)).toEqual({ day: 1, minute: 0 });
  });
});
