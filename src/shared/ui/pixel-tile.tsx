import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/ui/utils";

// Pixel tile (Phase 8 H9-T3, user 2026-10-29): the landing's pixel motif
// (landing/_components/pixel-tile.tsx), app-side — a square in the
// technique colour filled with a coarse Bayer dither, light in the top
// left, under a crisp vector Lucide glyph. The dither is static SVG with
// crisp edges at 2 CSS px per cell; the glyph stays antialiased. Colours
// come from globals.css `.pixel-tile[data-tone]`. Ported rather than
// imported so the app never depends on src/app/(marketing).

export type PixelTileTone = "yellow" | "green" | "rose";

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function bayerThreshold(col: number, row: number) {
  return ((BAYER_4[(row % 4) * 4 + (col % 4)] ?? 0) + 0.5) / 16;
}

/** Dither step of a cell in a grid×grid tile: 0 dark, 1 mid, 2 light. */
export function ditherLevel(grid: number, col: number, row: number) {
  const u = col / (grid - 1) - 0.3;
  const v = row / (grid - 1) - 0.26;
  const light = Math.max(0, 1 - Math.sqrt(u * u + v * v) / 1.05);
  const level = Math.round(light * 1.55 + bayerThreshold(col, row) - 0.5);
  return Math.max(0, Math.min(2, level));
}

/** Rectangle path of every run of lit cells, merged per row. */
function runsToPath(grid: number, lit: (col: number, row: number) => boolean) {
  let d = "";
  for (let row = 0; row < grid; row++) {
    let col = 0;
    while (col < grid) {
      if (!lit(col, row)) {
        col++;
        continue;
      }
      const start = col;
      while (col < grid && lit(col, row)) col++;
      d += `M${start} ${row}h${col - start}v1h${start - col}z`;
    }
  }
  return d;
}

export type PixelTileSize = 36 | 48;

const SIZE: Record<PixelTileSize, { radius: string; glyph: number }> = {
  36: { radius: "rounded-[9px]", glyph: 19 },
  48: { radius: "rounded-lg", glyph: 24 },
};

// The dither only depends on the grid, so each size is computed once.
const DITHER = new Map<number, { dark: string; light: string }>();
function dither(grid: number) {
  let paths = DITHER.get(grid);
  if (!paths) {
    paths = {
      dark: runsToPath(grid, (c, r) => ditherLevel(grid, c, r) === 0),
      light: runsToPath(grid, (c, r) => ditherLevel(grid, c, r) === 2),
    };
    DITHER.set(grid, paths);
  }
  return paths;
}

export interface PixelTileProps {
  tone: PixelTileTone;
  icon: LucideIcon;
  size: PixelTileSize;
  // Native tooltip (the collapsed techniques rail).
  title?: string;
  className?: string;
  "data-part"?: string;
}

export function PixelTile({
  tone,
  icon: Icon,
  size,
  title,
  className,
  "data-part": dataPart,
}: PixelTileProps) {
  const grid = size / 2;
  const { dark, light } = dither(grid);
  return (
    <span
      aria-hidden="true"
      title={title}
      data-slot="pixel-tile"
      data-tone={tone}
      data-part={dataPart}
      style={{ width: size, height: size }}
      className={cn(
        "pixel-tile relative block shrink-0 overflow-hidden",
        SIZE[size].radius,
        className,
      )}
    >
      <svg
        aria-hidden="true"
        data-part="dither"
        viewBox={`0 0 ${grid} ${grid}`}
        shapeRendering="crispEdges"
        className="absolute inset-0 block size-full"
      >
        <rect width={grid} height={grid} fill="var(--pt-mid)" />
        <path d={dark} fill="var(--pt-dark)" />
        <path d={light} fill="var(--pt-light)" />
      </svg>
      <Icon
        aria-hidden="true"
        size={SIZE[size].glyph}
        strokeWidth={2.1}
        className="pixel-tile-glyph absolute inset-0 m-auto"
      />
    </span>
  );
}
