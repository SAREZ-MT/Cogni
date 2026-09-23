import type { Clock } from "@/shared/kernel/clock";

// A Clock whose `now()` can be advanced mid-test, unlike
// `createFixedClock` in shared/kernel (frozen at construction). Ingestion
// use cases derive an upload grant's age and a job's processing budget
// from elapsed clock time, so tests need to move time forward without
// racing real timers. Reused by T6's budget/timeout scenarios.
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
