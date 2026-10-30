import type { CSSProperties } from "react";
import { cn } from "@/shared/ui/utils";

// Static decorative background for a sparse screen (Phase 8 Home empty
// state): notebook graph paper that gives the whole content card body
// without competing with the hero (user decision 2026-10-17: grid only, no
// colour). The lines are strongest in the centre and fade towards the
// edges, and a few cells are filled with light gray. Inert, no animation.
// Place it first inside a `relative` parent and give the content after it
// `relative`.

const CELL = 28;

// Filled cells, as (column, row) offsets from the centre cell. Fixed so the
// pattern is the same on every render.
const FILLED_CELLS: [number, number][] = [
  [-13, -4],
  [-11, 1],
  [-9, -6],
  [-8, 7],
  [-12, -3],
  [-6, 4],
  [-3, -8],
  [-2, 9],
  [2, -10],
  [4, -7],
  [5, 8],
  [7, 3],
  [10, -6],
  [10, -1],
  [11, 5],
  [13, 2],
];

const FADE: CSSProperties = {
  maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)",
};

export function StudyBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-slot="study-backdrop"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div data-part="grid" className="absolute inset-0" style={FADE}>
        <svg className="size-full" role="presentation">
          <defs>
            {/* x/y at 50% put a grid line through the centre of the card,
                so the filled cells below line up with the lines. */}
            <pattern
              id="study-backdrop-grid"
              width={CELL}
              height={CELL}
              x="50%"
              y="50%"
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
                fill="none"
                className="stroke-ink-placeholder/55"
              />
            </pattern>
          </defs>
          <svg x="50%" y="50%" overflow="visible" role="presentation">
            {FILLED_CELLS.map(([column, row]) => (
              <rect
                key={`${column}:${row}`}
                data-part="grid-cell"
                x={column * CELL + 1}
                y={row * CELL + 1}
                width={CELL - 1}
                height={CELL - 1}
                className="fill-neutral-150"
              />
            ))}
          </svg>
          <rect width="100%" height="100%" fill="url(#study-backdrop-grid)" />
        </svg>
      </div>
    </div>
  );
}
