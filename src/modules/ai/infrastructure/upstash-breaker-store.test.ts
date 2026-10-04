import { describe, expect, it } from "vitest";
import { initialBreakerState } from "../domain";
import { InMemoryRedis } from "./testing/in-memory-redis";
import { UpstashBreakerStore } from "./upstash-breaker-store";

describe("UpstashBreakerStore", () => {
  it("returns the closed state when nothing is stored", async () => {
    const store = new UpstashBreakerStore(new InMemoryRedis(), "p");
    expect(await store.read("gemini")).toEqual(initialBreakerState);
  });

  it("round-trips an open state under the prefixed key with a 1 h TTL", async () => {
    const redis = new InMemoryRedis();
    const store = new UpstashBreakerStore(redis, "cogni:test");
    const state = {
      consecutiveFailures: 3,
      openedAt: new Date("2026-10-03T14:00:00Z"),
    };
    await store.write("gemini", state);

    expect(redis.ttls.get("cogni:test:ai:breaker:gemini")).toBe(3600);
    expect(await store.read("gemini")).toEqual(state);
  });

  it("reads a value Upstash already deserialized into an object", async () => {
    const redis = new InMemoryRedis();
    redis.values.set("p:ai:breaker:g", {
      consecutiveFailures: 1,
      openedAt: null,
    });
    const store = new UpstashBreakerStore(redis, "p");
    expect(await store.read("g")).toEqual({
      consecutiveFailures: 1,
      openedAt: null,
    });
  });

  it("falls back to closed on a corrupted value", async () => {
    const redis = new InMemoryRedis();
    redis.values.set("p:ai:breaker:g", "not json");
    const store = new UpstashBreakerStore(redis, "p");
    expect(await store.read("g")).toEqual(initialBreakerState);
  });
});
