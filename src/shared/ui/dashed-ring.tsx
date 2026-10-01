import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface DashedRingProps {
  value: number; // 0-100
  icon: ReactNode;
  label: string;
  // A CSS color value, `var(--color-<token>)` (no new hex — reference an
  // existing Cogni token directly).
  colorVar?: string;
  size?: number;
  className?: string;
}

// Dashboard v2 "Tasa de acierto" ring (adapted from the deleted
// `radial-progress.tsx`): a plain SVG arc instead of a Recharts
// `RadialBarChart`, so the track itself can be a genuinely DASHED circle
// (`stroke-dasharray`) like the reference screenshot's ring, not a solid
// `neutral-100` background arc. The progress arc is still a real `<circle>`
// with `stroke-dasharray`/`stroke-dashoffset` sized to `value`, rotated
// -90deg so it starts at 12 o'clock and reads clockwise — no Recharts
// dependency needed for a single static ring, which also makes this atom
// server-renderable. Centered content: an icon tile, the value (22/700)
// and an 10px uppercase caption, matching the chart spec's "gauge = number
// beside/within the ring, not color alone" guidance.
export function DashedRing({
  value,
  icon,
  label,
  colorVar = "var(--color-primary-600)",
  size = 160,
  className,
}: DashedRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const strokeWidth = 8;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progressLength = (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        role="img"
        aria-label={`${label}: ${Math.round(clamped)}%`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-neutral-300)"
          strokeWidth={strokeWidth}
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorVar}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        {icon}
        <span className="font-bold text-[22px] text-fg tabular-nums">
          {Math.round(clamped)}%
        </span>
        <span className="text-[10px] text-fg-muted uppercase tracking-wide">
          {label}
        </span>
      </div>
    </div>
  );
}
