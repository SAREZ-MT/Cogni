import type { Icon } from "@phosphor-icons/react/dist/lib/types";
import { bayerThreshold } from "./ascii-field";

// Pillar point icons: a square tile in the pillar hue, filled with a coarse
// Bayer dither (the HeadlineObject family), under a crisp vector Phosphor
// glyph. The dither is static SVG rendered on the server with crisp edges;
// the glyph stays antialiased. Colours come from landing.css (.lp-ptile
// tones). The dither is the same for every tile, so it is drawn once as a
// <symbol> (PixelTileDefs) and each tile only references it.

export type PixelTone = "yellow" | "violet" | "mint" | "rose";

// The tile is GRID × GRID cells; at 56 CSS px a cell is 2 px.
const GRID = 28;

const DITHER_ID = "lp-ptile-dither";

type Cell = (col: number, row: number) => boolean;

/** Rectangle path of every run of lit cells, merged per row. */
export function runsToPath(cols: number, rows: number, lit: Cell) {
  let d = "";
  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < cols) {
      if (!lit(col, row)) {
        col++;
        continue;
      }
      const start = col;
      while (col < cols && lit(col, row)) col++;
      d += `M${start} ${row}h${col - start}v1h${start - col}z`;
    }
  }
  return d;
}

/** Dither step of a cell: 0 dark, 1 mid, 2 light (light in the top left). */
export function ditherLevel(col: number, row: number) {
  const u = col / (GRID - 1) - 0.3;
  const v = row / (GRID - 1) - 0.26;
  const light = Math.max(0, 1 - Math.sqrt(u * u + v * v) / 1.05);
  const level = Math.round(light * 1.55 + bayerThreshold(col, row) - 0.5);
  return Math.max(0, Math.min(2, level));
}

const DITHER_DARK = runsToPath(GRID, GRID, (c, r) => ditherLevel(c, r) === 0);
const DITHER_LIGHT = runsToPath(GRID, GRID, (c, r) => ditherLevel(c, r) === 2);

/** The shared dither, rendered once per page before the tiles that use it. */
export function PixelTileDefs() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      className="absolute size-0 overflow-hidden"
    >
      <symbol
        id={DITHER_ID}
        viewBox={`0 0 ${GRID} ${GRID}`}
        shapeRendering="crispEdges"
      >
        <rect width={GRID} height={GRID} fill="var(--pt-mid)" />
        <path d={DITHER_DARK} fill="var(--pt-dark)" />
        <path d={DITHER_LIGHT} fill="var(--pt-light)" />
      </symbol>
    </svg>
  );
}

export function PixelTile({
  tone,
  icon: Glyph,
  className = "",
}: {
  tone: PixelTone;
  icon: Icon;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`lp-ptile relative ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${GRID} ${GRID}`}
        shapeRendering="crispEdges"
        className="lp-ptile-dither absolute inset-0 block size-full"
      >
        <use href={`#${DITHER_ID}`} width={GRID} height={GRID} />
      </svg>
      <Glyph weight="bold" className="lp-ptile-glyph" />
    </span>
  );
}
