"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/shared/ui/utils";

// Days the curve spans from left (just edited) to right.
const SPAN_HOURS = 24 * 7;
// Ebbinghaus-style retention R(t) = e^(-t/S), with S in hours: a page left
// alone for about two days has lost most of what was fresh.
const STABILITY_HOURS = 40;
// Vertical band the curve uses inside its 100 x 100 box: it starts at TOP,
// near the card's top-left corner (the card nudges its title right to
// clear it), and settles towards BOTTOM.
const TOP = 8;
const BOTTOM = 95;
// "Now" stays this far from the card's sides so its halo is never clipped.
const MARKER_INSET = 5;
const STEPS = 48;

export interface CurvePoint {
  x: number;
  y: number;
}

function yAt(hours: number): number {
  const retention = Math.exp(-hours / STABILITY_HOURS);
  return TOP + (BOTTOM - TOP) * (1 - retention);
}

// The curve as points in a 100 x 100 box, plus "now": where a page edited
// `elapsedHours` ago sits on it, clamped to the curve's span and kept
// MARKER_INSET away from the sides.
export function forgettingCurve(elapsedHours: number): {
  points: CurvePoint[];
  marker: CurvePoint;
} {
  const points: CurvePoint[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const hours = (SPAN_HOURS * i) / STEPS;
    points.push({ x: (100 * i) / STEPS, y: yAt(hours) });
  }
  const clamped = Math.min(Math.max(elapsedHours, 0), SPAN_HOURS);
  const span = 100 - 2 * MARKER_INSET;
  const hours = (clamped / SPAN_HOURS) * span;
  const x = MARKER_INSET + hours;
  return {
    points,
    marker: { x, y: yAt((x / 100) * SPAN_HOURS) },
  };
}

function toPath(points: CurvePoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

// Decorative backdrop for Home's "Continúa donde lo dejaste" cards (Phase 8
// H2-T5r, user 2026-10-18): the forgetting curve, the science behind spaced
// repetition, drawn in the Cogni violet with a soft fill under it and a
// marker for where the page sits today given how long ago it was edited.
// The curve reveals left to right once (0.6s, a clip-path wipe: pathLength
// dashes break with the non-scaling stroke) and the marker pops in after it; under
// prefers-reduced-motion only the transition changes, never `initial`, so
// hydration matches. aria-hidden: the card's link already names the page.
export function ForgettingCurve({
  elapsedHours,
  className,
}: {
  elapsedHours: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const gradientId = useId();
  const { points, marker } = forgettingCurve(elapsedHours);
  const line = toPath(points);
  const area = `${line} L100 100 L0 100 Z`;

  return (
    <div
      aria-hidden="true"
      data-slot="forgetting-curve"
      data-elapsed-hours={Math.round(elapsedHours)}
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
        }
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-primary-100)" />
            <stop
              offset="1"
              stopColor="var(--color-primary-100)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <motion.path
          data-part="area"
          d={area}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.1 }}
        />
        <motion.path
          data-part="curve"
          d={line}
          fill="none"
          stroke="var(--color-primary-500)"
          strokeOpacity={0.55}
          strokeWidth={2.25}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
      <motion.span
        data-part="now"
        className="-translate-x-1/2 -translate-y-1/2 absolute size-2.5 rounded-full bg-primary-500 ring-4 ring-primary-200/70"
        style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", bounce: 0.35, visualDuration: 0.35, delay: 0.5 }
        }
      />
    </div>
  );
}
