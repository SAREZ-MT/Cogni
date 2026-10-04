// The subset of the Upstash `Redis` client the ai adapters use. Adapters
// depend on this shape, so unit tests inject an in-memory double and the
// real `Redis` from `@upstash/redis` satisfies it structurally.
export interface RedisPipelineLike {
  incr(key: string): unknown;
  expire(key: string, seconds: number): unknown;
  exec(): Promise<unknown>;
}

export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  pipeline(): RedisPipelineLike;
}
