import { describe, expect, it } from "vitest";
import { createFixedClock, systemClock } from "./clock";

describe("clock", () => {
  it("systemClock.now() returns the current time", () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it("createFixedClock() always returns the same fixed instant", () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const clock = createFixedClock(fixed);

    expect(clock.now().getTime()).toBe(fixed.getTime());
    expect(clock.now().getTime()).toBe(fixed.getTime());
  });

  it("createFixedClock() with a different instant returns a different time", () => {
    const other = new Date("2030-06-15T12:30:00.000Z");
    const clock = createFixedClock(other);

    expect(clock.now().getTime()).toBe(other.getTime());
  });
});
