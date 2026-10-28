import { describe, expect, it } from "vitest";
import { activeTechnique, trackShift } from "./techniques-scroll";

describe("trackShift", () => {
  it("moves the track linearly by whole frames, intro first", () => {
    expect(trackShift(0, 5)).toBe("0%");
    expect(trackShift(0.5, 5)).toBe("-40%");
    expect(trackShift(1, 5)).toBe("-80%");
  });

  it("clamps progress outside 0..1", () => {
    expect(trackShift(-0.2, 5)).toBe("0%");
    expect(trackShift(1.4, 5)).toBe("-80%");
  });
});

describe("activeTechnique", () => {
  it("is none while the intro panel is the nearest", () => {
    expect(activeTechnique(0, 4)).toBe(-1);
    expect(activeTechnique(0.12, 4)).toBe(-1);
  });

  it("picks the technique whose panel is nearest the centre", () => {
    expect(activeTechnique(0.25, 4)).toBe(0);
    expect(activeTechnique(0.37, 4)).toBe(0);
    expect(activeTechnique(0.38, 4)).toBe(1);
    expect(activeTechnique(0.5, 4)).toBe(1);
    expect(activeTechnique(0.75, 4)).toBe(2);
    expect(activeTechnique(1, 4)).toBe(3);
  });

  it("clamps progress outside 0..1", () => {
    expect(activeTechnique(-1, 4)).toBe(-1);
    expect(activeTechnique(2, 4)).toBe(3);
  });
});
