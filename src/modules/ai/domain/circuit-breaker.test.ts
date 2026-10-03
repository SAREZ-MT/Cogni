import { describe, expect, it } from "vitest";
import {
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_OPEN_MS,
  type BreakerState,
  initialBreakerState,
  isOpen,
  recordFailure,
  recordSuccess,
} from "./circuit-breaker";

const t0 = new Date("2026-10-03T10:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

function failTimes(state: BreakerState, n: number, now: Date): BreakerState {
  let s = state;
  for (let i = 0; i < n; i++) s = recordFailure(s, now);
  return s;
}

describe("circuit breaker", () => {
  it("exposes the documented constants", () => {
    expect(BREAKER_FAILURE_THRESHOLD).toBe(3);
    expect(BREAKER_OPEN_MS).toBe(10 * 60 * 1000);
  });

  it("starts closed", () => {
    expect(isOpen(initialBreakerState, t0)).toBe(false);
  });

  it("stays closed after two failures", () => {
    const state = failTimes(initialBreakerState, 2, t0);
    expect(state.consecutiveFailures).toBe(2);
    expect(isOpen(state, t0)).toBe(false);
  });

  it("opens on the third consecutive failure", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    expect(state.openedAt).toEqual(t0);
    expect(isOpen(state, t0)).toBe(true);
  });

  it("stays open for 9 minutes 59 seconds", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    expect(isOpen(state, at(BREAKER_OPEN_MS - 1000))).toBe(true);
  });

  it("is half-open (closed for selection) at exactly 10 minutes", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    expect(isOpen(state, at(BREAKER_OPEN_MS))).toBe(false);
  });

  it("reopens on the first failure after half-open", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    const later = at(BREAKER_OPEN_MS);
    const reopened = recordFailure(state, later);
    expect(reopened.openedAt).toEqual(later);
    expect(isOpen(reopened, later)).toBe(true);
  });

  it("does not extend an open window with further failures", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    const again = recordFailure(state, at(60_000));
    expect(again.openedAt).toEqual(t0);
  });

  it("a success resets the counter and closes the breaker", () => {
    const state = failTimes(initialBreakerState, 3, t0);
    expect(recordSuccess()).toEqual(initialBreakerState);
    expect(isOpen(recordSuccess(), t0)).toBe(false);
    expect(state.consecutiveFailures).toBe(3);
  });

  it("a success between failures restarts the count", () => {
    const s1 = failTimes(initialBreakerState, 2, t0);
    const s2 = recordFailure(recordSuccess(), t0);
    expect(s1.consecutiveFailures).toBe(2);
    expect(s2.consecutiveFailures).toBe(1);
    expect(isOpen(s2, t0)).toBe(false);
  });
});
