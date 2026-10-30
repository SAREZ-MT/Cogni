// Character texture for the landing's paper and night grounds: a grid of
// tiny glyphs whose density follows a ground-specific curve, thresholded
// through an ordered (Bayer) dither mixed with a per-cell hash, so it thins
// out in a pattern rather than as random noise. Pure, so the same cell
// always draws the same glyph (no shimmer between redraws).

export type AsciiVariant = "dissolve" | "field";

export const ASCII_GLYPHS = "abcdefghijklmnopqrstuvwxyzñáéíóú" as const;

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in (0, 1) for a cell. */
export function bayerThreshold(col: number, row: number) {
  return ((BAYER_4[(row % 4) * 4 + (col % 4)] ?? 0) + 0.5) / 16;
}

/** Deterministic 0..1 hash of a cell (integer mix, no Math.random). */
export function cellHash(col: number, row: number, seed: number) {
  let h = (col * 374761393 + row * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Share of cells that carry a glyph at (u, v), both 0..1 across the field.
 * "dissolve": v runs from the night edge (0) to the paper edge (1). It
 * fades in from the seam, so the band never starts on a hard line, peaks
 * in the night and thins out to nothing on the paper. "field": sparse, and thinner in the middle where the
 * content sits.
 */
export function cellDensity(variant: AsciiVariant, u: number, v: number) {
  if (variant === "dissolve")
    return 0.42 * smoothstep(0, 0.16, v) * (1 - smoothstep(0.14, 0.8, v));
  const dx = (u - 0.5) / 0.5;
  const dy = (v - 0.5) / 0.5;
  const edge = Math.min(1, Math.sqrt(dx * dx + dy * dy));
  return 0.1 + 0.3 * edge * edge;
}

/** The glyph at a cell, or null when the dither leaves it empty. */
export function asciiGlyph(
  variant: AsciiVariant,
  col: number,
  row: number,
  u: number,
  v: number,
  seed: number,
) {
  const threshold =
    0.6 * bayerThreshold(col, row) + 0.4 * cellHash(col, row, seed);
  if (threshold >= cellDensity(variant, u, v)) return null;
  const pick = Math.floor(cellHash(row, col, seed + 1) * ASCII_GLYPHS.length);
  return ASCII_GLYPHS[pick] ?? ".";
}
