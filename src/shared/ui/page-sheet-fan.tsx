"use client";

import { motion, useReducedMotion } from "motion/react";
import type { NotebookCoverTone } from "@/shared/ui/notebook-cover-card";
import { PageSheet } from "@/shared/ui/page-sheet";
import {
  type FanShape,
  fanPose,
  fanStack,
  fanTransition,
} from "@/shared/ui/technique-fan";
import { cn } from "@/shared/ui/utils";

// Outer sheets ±7deg and 104px out, 8px lower; the front one upright and
// raised 4px, like a few loose pages fanned on a desk.
const SHEET_SHAPE: FanShape = {
  tiltDeg: 7,
  spreadPx: 104,
  outerDropPx: 8,
  middleLiftPx: -4,
};

// Painted left, right, then front, so the front sheet sits on top.
const SHEETS = [
  { slot: "left", poseIndex: 0, front: false },
  { slot: "right", poseIndex: 2, front: false },
  { slot: "front", poseIndex: 1, front: true },
] as const;

export interface PageSheetFanProps {
  // The notebook's pastel colour on every sheet; null falls back to violet.
  tone?: NotebookCoverTone | null;
  className?: string;
}

// Decorative hero of an empty notebook (Phase 8 H5-T4, user request
// 2026-10-29), the pages' sibling of the hub's `NotebookFan`: three
// `PageSheet`s in the notebook's colour fanned out, the front one with
// "Tu primera página" written on its first rule and a caret that blinks
// as if waiting for you to type. On mount the sheets settle once from a
// squared stack with the shared `TechniqueFan` spring; under reduced motion
// only the transition changes (never `initial`, so hydration matches) and
// the caret stays still. The 400×196 stage scales down in steps with its
// own column (container queries: the sidebar may eat the width), so it
// never overflows. Hidden from assistive technology.
export function PageSheetFan({ tone, className }: PageSheetFanProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      aria-hidden="true"
      data-slot="page-sheet-fan"
      className={cn("@container w-full", className)}
    >
      <div className="relative mx-auto h-[49px] max-w-[400px] @[180px]:h-[88px] @[220px]:h-[118px] @[300px]:h-[157px] @[400px]:h-[196px]">
        <div className="absolute top-0 left-1/2 h-[196px] w-[400px] origin-top -translate-x-1/2 scale-[0.25] @[180px]:scale-[0.45] @[220px]:scale-[0.6] @[300px]:scale-[0.8] @[400px]:scale-100">
          {SHEETS.map((sheet, order) => (
            <motion.div
              key={sheet.slot}
              data-part="fan-sheet"
              data-sheet={sheet.slot}
              initial={fanStack(SHEET_SHAPE)}
              animate={fanPose(sheet.poseIndex, SHEETS.length, SHEET_SHAPE)}
              transition={fanTransition(reduce, order)}
              className={cn(
                "absolute top-1/2 left-1/2",
                sheet.front
                  ? "z-10 -mt-[94px] -ml-[75px] h-[188px] w-[150px]"
                  : "-mt-[84px] -ml-[67px] h-[168px] w-[134px]",
              )}
            >
              <PageSheet tone={tone} />
              {sheet.front ? (
                <span className="absolute top-[18px] left-6 flex items-center gap-0.5 font-semibold text-[12px] text-fg leading-[18px]">
                  Tu primera página
                  <span
                    data-part="caret"
                    className="ml-0.5 inline-block h-4 w-[2px] rounded-full bg-primary-500 motion-safe:animate-pulse"
                  />
                </span>
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
