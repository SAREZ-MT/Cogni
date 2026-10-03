// Per-provider circuit breaker as pure transitions (documento-maestro §8.2):
// 3 consecutive failures mark the provider unhealthy for 10 minutes. After
// that window it is half-open: selectable again, and the next failure
// reopens it immediately because the failure count was never reset.

export const BREAKER_FAILURE_THRESHOLD = 3;
export const BREAKER_OPEN_MS = 10 * 60 * 1000;

export interface BreakerState {
  readonly consecutiveFailures: number;
  readonly openedAt: Date | null;
}

export const initialBreakerState: BreakerState = {
  consecutiveFailures: 0,
  openedAt: null,
};

export function isOpen(state: BreakerState, now: Date): boolean {
  if (state.openedAt === null) return false;
  return now.getTime() - state.openedAt.getTime() < BREAKER_OPEN_MS;
}

export function recordFailure(state: BreakerState, now: Date): BreakerState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  if (consecutiveFailures < BREAKER_FAILURE_THRESHOLD) {
    return { consecutiveFailures, openedAt: state.openedAt };
  }
  // An open window is never extended by failures recorded while it runs.
  const openedAt = isOpen(state, now) ? state.openedAt : now;
  return { consecutiveFailures, openedAt };
}

export function recordSuccess(): BreakerState {
  return initialBreakerState;
}
