// A per-key counter over a time window, shared by modules that need to
// throttle a user action (document-import T9b: import starts and upload
// grants). `consume` counts one attempt and says whether it is allowed.
export interface RateLimitDecision {
  allowed: boolean;
  resetAt: Date;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitDecision>;
}

export interface RateLimitRule {
  // Separates the counters of different actions (also the Redis key part).
  name: string;
  limit: number;
  windowMs: number;
}
