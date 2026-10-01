"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/shared/ui/utils";

export type SparklineTone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

// Tone → stroke/gradient colour. References existing Cogni tokens only (no
// new hex, chart spec setup note "reference existing tokens via
// var(--color-primary-600) in ChartConfig") — a Sparkline is too small to
// need a ChartConfig/legend, so it reads the CSS var directly instead of
// going through ChartContainer.
const TONE_COLOR: Record<SparklineTone, string> = {
  primary: "var(--color-primary-500)",
  success: "var(--color-success-500)",
  warning: "var(--color-warning-500)",
  error: "var(--color-error-500)",
  info: "var(--color-info-500)",
};

export interface SparklineProps {
  data: readonly number[];
  tone?: SparklineTone;
  // Overrides `tone`'s token with any CSS colour value, `var(--color-
  // <token>)` (visual review addition: notebook-progress.tsx needs each
  // row's sparkline to match that notebook's own chart colour, not one of
  // the 5 fixed tones).
  colorVar?: string;
  height?: number;
  className?: string;
}

// KPI/trend sparkline (chart spec §Widgets A/D): a decorative area chart
// with no axes, no tooltip, no grid — `aria-hidden` since the KpiCard/
// notebook-progress row it sits in already states the trend in words.
export function Sparkline({
  data,
  tone = "primary",
  colorVar,
  height = 40,
  className,
}: SparklineProps) {
  const id = useId().replace(/:/g, "");
  const color = colorVar ?? TONE_COLOR[tone];
  const points = data.map((value, index) => ({ index, value }));

  return (
    <div
      aria-hidden="true"
      className={cn("w-full", className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 2, right: 1, bottom: 1, left: 1 }}
        >
          <defs>
            <linearGradient id={`sparkline-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#sparkline-${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
