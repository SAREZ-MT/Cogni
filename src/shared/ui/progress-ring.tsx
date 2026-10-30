import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface ProgressRingProps {
  // 0–100; clamped, and NaN reads as 0.
  value: number;
  // Outer diameter in px.
  size?: number;
  strokeWidth?: number;
  // Colour of the arc as a text-* token class (the arc strokes currentColor).
  indicatorClassName?: string;
  // Colour of the track as a text-* token class.
  trackClassName?: string;
  className?: string;
  // Centred inside the ring: a short percentage, an icon or a dash.
  children?: ReactNode;
}

// Small circular progress (Phase 8 H2-T5f Home technique cards): a static
// SVG track and arc, server-renderable, starting at 12 o'clock and reading
// clockwise. `pathLength={100}` lets the arc be drawn straight from the
// percentage. Decorative: the surrounding control carries the full
// accessible name, so the ring is aria-hidden. No arc is drawn at 0 (a
// round cap would leave a dot).
export function ProgressRing({
  value,
  size = 46,
  strokeWidth = 4,
  indicatorClassName,
  trackClassName = "text-neutral-150",
  className,
  children,
}: ProgressRingProps) {
  const clamped = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  const center = size / 2;
  const radius = center - strokeWidth / 2;

  return (
    <span
      aria-hidden="true"
      data-slot="progress-ring"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 absolute inset-0"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        {clamped > 0 ? (
          <circle
            data-slot="progress-ring-indicator"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} 100`}
            className={indicatorClassName}
          />
        ) : null}
      </svg>
      {children ? (
        <span className="relative flex items-center justify-center">
          {children}
        </span>
      ) : null}
    </span>
  );
}
