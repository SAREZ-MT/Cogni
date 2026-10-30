"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  TECHNIQUE_ACCENT_TEXT_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { TechniqueStatusPill } from "@/shared/ui/technique-status-pill";
import { cn } from "@/shared/ui/utils";

export interface TechniqueRingProps {
  tone: TechniqueTone;
  // Technique name, shown in the status pill.
  label: string;
  done: number;
  total: number;
  className?: string;
}

const SIZE = 46;
const STROKE = 5;

// One technique's week progress (Phase 8 H3-T2, Semana metric card option
// 1, user decision 2026-10-19): a 46px ring whose arc, in the technique's
// accent, reads done / total clockwise from 12 o'clock with the share in
// the centre, over its TechniqueStatusPill (sm). A technique with nothing
// this week shows the bare track and a dash. The arc draws in once with
// Motion; under prefers-reduced-motion only the transition changes
// (duration 0), never `initial`, so the server markup and hydration match.
// One sr-only sentence speaks it; the drawing and digits are aria-hidden.
export function TechniqueRing({
  tone,
  label,
  done,
  total,
  className,
}: TechniqueRingProps) {
  const reduce = useReducedMotion() ?? false;
  const percent =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((done / total) * 100)))
      : 0;
  const center = SIZE / 2;
  const radius = center - STROKE / 2;
  return (
    <span
      data-slot="technique-ring"
      data-tone={tone}
      className={cn("flex min-w-0 flex-col items-center gap-1", className)}
    >
      <span className="sr-only">
        {total > 0
          ? `${label}: ${done} de ${total} ${total === 1 ? "repaso" : "repasos"} (${percent}%)`
          : `${label}: sin repasos esta semana`}
      </span>
      <span
        aria-hidden="true"
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
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
            strokeWidth={STROKE}
            className="text-neutral-150"
          />
          {percent > 0 && (
            <motion.circle
              data-part="indicator"
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              className={TECHNIQUE_ACCENT_TEXT_CLASS[tone]}
              initial={{ strokeDasharray: "0 100" }}
              animate={{ strokeDasharray: `${percent} 100` }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", bounce: 0, visualDuration: 0.7 }
              }
            />
          )}
        </svg>
        <span
          data-part="value"
          className="relative font-bold text-[11px] text-fg tabular-nums"
        >
          {total > 0 ? `${percent}%` : "—"}
        </span>
      </span>
      <TechniqueStatusPill tone={tone} size="sm" className="max-w-full">
        {label}
      </TechniqueStatusPill>
    </span>
  );
}
