import type { RedisLike } from "../redis-like";

// Minimal in-memory double of the Upstash `Redis` commands the ai adapters
// call: get, set (with `ex`), pipeline (incr, expire, exec). It records TTLs
// so tests can assert them; it never expires keys on its own.
export class InMemoryRedis implements RedisLike {
  readonly values = new Map<string, unknown>();
  readonly ttls = new Map<string, number>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number },
  ): Promise<unknown> {
    this.values.set(key, value);
    if (options?.ex !== undefined) this.ttls.set(key, options.ex);
    return "OK";
  }

  pipeline() {
    const ops: (() => unknown)[] = [];
    const pipeline = {
      incr: (key: string) => {
        ops.push(() => {
          const next = Number(this.values.get(key) ?? 0) + 1;
          this.values.set(key, next);
          return next;
        });
        return pipeline;
      },
      expire: (key: string, seconds: number) => {
        ops.push(() => {
          this.ttls.set(key, seconds);
          return 1;
        });
        return pipeline;
      },
      exec: async () => ops.map((op) => op()),
    };
    return pipeline;
  }
}
