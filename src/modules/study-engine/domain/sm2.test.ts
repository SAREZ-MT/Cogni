import { describe, expect, it } from "vitest";
import { STUDY_ENGINE_ERROR } from "./errors";
import { applySm2 } from "./sm2";
import { INITIAL_EASINESS, MIN_EASINESS, type Sm2State } from "./study-item";

const DAY_MS = 86_400_000;
const T0 = new Date("2026-01-01T00:00:00.000Z");

function fresh(): Sm2State {
  return {
    easiness: INITIAL_EASINESS,
    intervalDays: 0,
    repetitions: 0,
    dueAt: T0,
    lastQuality: null,
    lastReviewedAt: null,
    lapses: 0,
  };
}

function unwrap(state: Sm2State, quality: number, now: Date): Sm2State {
  const result = applySm2(state, quality as 0 | 1 | 2 | 3 | 4 | 5, now);
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("applySm2 (§7.1)", () => {
  it("first review with q=4: I=1, n=1, EF unchanged", () => {
    const next = unwrap(fresh(), 4, T0);

    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
    expect(next.easiness).toBe(2.5);
    expect(next.dueAt).toEqual(new Date(T0.getTime() + DAY_MS));
    expect(next.lapses).toBe(0);
    expect(next.lastQuality).toBe(4);
    expect(next.lastReviewedAt).toEqual(T0);
  });

  it("second review with q=4: I=6, n=2", () => {
    const first = unwrap(fresh(), 4, T0);
    const t1 = new Date(T0.getTime() + DAY_MS);
    const second = unwrap(first, 4, t1);

    expect(second.intervalDays).toBe(6);
    expect(second.repetitions).toBe(2);
    expect(second.easiness).toBe(2.5);
    expect(second.dueAt).toEqual(new Date(t1.getTime() + 6 * DAY_MS));
  });

  it("third review with q=4: I=round(6*EF)=15, n=3", () => {
    const first = unwrap(fresh(), 4, T0);
    const second = unwrap(first, 4, T0);
    const third = unwrap(second, 4, T0);

    expect(third.intervalDays).toBe(Math.round(6 * 2.5));
    expect(third.intervalDays).toBe(15);
    expect(third.repetitions).toBe(3);
  });

  it("uses the easiness before the update to grow the interval", () => {
    // Two successes, then q=5 raises EF to 2.6 but the interval must use 2.5.
    const second = unwrap(unwrap(fresh(), 4, T0), 4, T0);
    const third = unwrap(second, 5, T0);

    expect(third.intervalDays).toBe(15);
    expect(third.easiness).toBeCloseTo(2.6, 10);
  });

  it("failure after success (q=1): n=0, I=1, lapses+1, EF drops", () => {
    const second = unwrap(unwrap(fresh(), 4, T0), 4, T0);
    const failed = unwrap(second, 1, T0);

    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(1);
    expect(failed.lapses).toBe(1);
    expect(failed.easiness).toBeCloseTo(2.5 - 0.54, 10);
    expect(failed.dueAt).toEqual(new Date(T0.getTime() + DAY_MS));
    expect(failed.lastQuality).toBe(1);
  });

  it("q=2 counts as a failure too", () => {
    const failed = unwrap(unwrap(fresh(), 4, T0), 2, T0);
    expect(failed.repetitions).toBe(0);
    expect(failed.lapses).toBe(1);
  });

  it("never lets easiness fall below the 1.3 floor (repeated q=0)", () => {
    let state = fresh();
    for (let i = 0; i < 5; i += 1) {
      state = unwrap(state, 0, T0);
      expect(state.easiness).toBeGreaterThanOrEqual(MIN_EASINESS);
    }
    expect(state.easiness).toBe(MIN_EASINESS);
    expect(state.lapses).toBe(5);
    expect(state.repetitions).toBe(0);
    expect(state.intervalDays).toBe(1);
  });

  it("q=0 extreme on a fresh item: EF 2.5 -> 1.7, I=1, lapse", () => {
    const next = unwrap(fresh(), 0, T0);
    expect(next.easiness).toBeCloseTo(1.7, 10);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(0);
    expect(next.lapses).toBe(1);
    expect(next.lastQuality).toBe(0);
  });

  it("q=5 extreme on a fresh item: EF 2.5 -> 2.6, I=1, n=1", () => {
    const next = unwrap(fresh(), 5, T0);
    expect(next.easiness).toBeCloseTo(2.6, 10);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
    expect(next.lapses).toBe(0);
  });

  it("q=3 lowers easiness by 0.14 while keeping the success path", () => {
    const next = unwrap(fresh(), 3, T0);
    expect(next.easiness).toBeCloseTo(2.36, 10);
    expect(next.repetitions).toBe(1);
  });

  it("does not mutate the input state", () => {
    const before = fresh();
    const snapshot = { ...before };
    unwrap(before, 4, T0);
    expect(before).toEqual(snapshot);
  });

  it.each([
    -1,
    6,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects invalid quality %p", (quality) => {
    const result = applySm2(fresh(), quality as 0, T0);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.INVALID_QUALITY,
    );
  });

  it("replays 3 simulated days with exact due dates", () => {
    // Day 0, day 1 and day 2 reviews; the student answers "Bien" (4), then
    // "Fácil" (5), then "Difícil" (3). Expected per §7.1 with EF_prev for I.
    const table: Array<{
      day: number;
      quality: 0 | 1 | 2 | 3 | 4 | 5;
      intervalDays: number;
      repetitions: number;
      easiness: number;
      dueAt: string;
    }> = [
      {
        day: 0,
        quality: 4,
        intervalDays: 1,
        repetitions: 1,
        easiness: 2.5,
        dueAt: "2026-01-02T00:00:00.000Z",
      },
      {
        day: 1,
        quality: 5,
        intervalDays: 6,
        repetitions: 2,
        easiness: 2.6,
        dueAt: "2026-01-08T00:00:00.000Z",
      },
      {
        day: 2,
        quality: 3,
        intervalDays: 16, // round(6 * 2.6) = round(15.6)
        repetitions: 3,
        easiness: 2.46, // 2.6 - 0.14
        dueAt: "2026-01-19T00:00:00.000Z",
      },
    ];

    let state = fresh();
    for (const row of table) {
      const now = new Date(T0.getTime() + row.day * DAY_MS);
      state = unwrap(state, row.quality, now);
      expect(state.intervalDays).toBe(row.intervalDays);
      expect(state.repetitions).toBe(row.repetitions);
      expect(state.easiness).toBeCloseTo(row.easiness, 10);
      expect(state.dueAt.toISOString()).toBe(row.dueAt);
      expect(state.lastReviewedAt).toEqual(now);
      expect(state.lastQuality).toBe(row.quality);
    }
    expect(state.lapses).toBe(0);
  });
});
