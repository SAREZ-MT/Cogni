import { describe, expect, it } from "vitest";
import {
  ASCII_GLYPHS,
  asciiGlyph,
  bayerThreshold,
  cellDensity,
} from "./ascii-field";

function filled(v: number) {
  let count = 0;
  for (let col = 0; col < 64; col++) {
    for (let row = 0; row < 8; row++) {
      if (asciiGlyph("dissolve", col, row, col / 64, v, 7)) count++;
    }
  }
  return count;
}

describe("ascii field", () => {
  it("fades in from the seam, peaks in the night and is gone on the paper", () => {
    expect(filled(0.2)).toBeGreaterThan(filled(0.01));
    expect(filled(0.2)).toBeGreaterThan(filled(0.6));
    expect(filled(0.6)).toBeGreaterThan(0);
    expect(filled(1)).toBe(0);
  });

  it("keeps the middle of a field thinner than its edges", () => {
    expect(cellDensity("field", 0.5, 0.5)).toBeLessThan(
      cellDensity("field", 0, 0),
    );
  });

  it("draws the same glyph for the same cell every time", () => {
    const a = asciiGlyph("field", 3, 9, 0.1, 0.1, 2);
    expect(asciiGlyph("field", 3, 9, 0.1, 0.1, 2)).toBe(a);
    if (a) expect(ASCII_GLYPHS).toContain(a);
  });

  it("spreads ordered-dither thresholds evenly over a 4×4 tile", () => {
    const values = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) values.push(bayerThreshold(c, r));
    expect(new Set(values).size).toBe(16);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});
