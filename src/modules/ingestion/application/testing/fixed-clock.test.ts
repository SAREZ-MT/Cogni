import { describe, expect, it } from "vitest";
import { FixedClock } from "./fixed-clock";

describe("FixedClock", () => {
  it("returns the initial instant until advanced", () => {
    const now = new Date("2026-09-23T10:00:00.000Z");
    const clock = new FixedClock(now);

    expect(clock.now()).toBe(now);
  });

  it("advances now() by the given number of milliseconds", () => {
    const clock = new FixedClock(new Date("2026-09-23T10:00:00.000Z"));

    clock.advanceMs(90_000);

    expect(clock.now()).toEqual(new Date("2026-09-23T10:01:30.000Z"));
  });
});
