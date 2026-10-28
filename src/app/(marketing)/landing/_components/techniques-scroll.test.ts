import { describe, expect, it } from "vitest";
import { activeTechnique, trackShift } from "./techniques-scroll";

// intro: width of the intro frame in frames; count: technique frames.
describe("trackShift", () => {
  it("moves the track linearly by whole frames with a full-width intro", () => {
    expect(trackShift(0, 1, 4)).toBe("0%");
    expect(trackShift(0.5, 1, 4)).toBe("-40%");
    expect(trackShift(1, 1, 4)).toBe("-80%");
  });

  it("ends with the last technique in view after a narrower intro", () => {
    // Rail 4.5 frames wide, travels 3.5 of them.
    expect(trackShift(1, 0.5, 4)).toBe("-77.78%");
    expect(trackShift(0.5, 0.5, 4)).toBe("-38.89%");
  });

  it("clamps progress outside 0..1", () => {
    expect(trackShift(-0.2, 0.5, 4)).toBe("0%");
    expect(trackShift(1.4, 0.5, 4)).toBe("-77.78%");
  });
});

describe("activeTechnique", () => {
  it("is none while the intro still leads", () => {
    expect(activeTechnique(0, 0.5, 4)).toBe(-1);
    // 0.2 frames travelled, less than half the intro.
    expect(activeTechnique(0.2 / 3.5, 0.5, 4)).toBe(-1);
  });

  it("picks the technique whose frame is nearest to filling the screen", () => {
    expect(activeTechnique(0.5 / 3.5, 0.5, 4)).toBe(0);
    expect(activeTechnique(0.95 / 3.5, 0.5, 4)).toBe(0);
    expect(activeTechnique(1.05 / 3.5, 0.5, 4)).toBe(1);
    expect(activeTechnique(2.5 / 3.5, 0.5, 4)).toBe(2);
    expect(activeTechnique(1, 0.5, 4)).toBe(3);
  });

  it("clamps progress outside 0..1", () => {
    expect(activeTechnique(-1, 0.5, 4)).toBe(-1);
    expect(activeTechnique(2, 0.5, 4)).toBe(3);
  });
});
