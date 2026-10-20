"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface IllustratedEmptyStateProps {
  // A decorative illustration (rendered with alt="").
  image: { src: string; width: number; height: number };
  title: string;
  description: string;
  // A quiet follow-up link under the message (e.g. the next review).
  action?: ReactNode;
  // Short numbered steps under the message, as an ordered list of pills.
  steps?: readonly string[];
  // "sm" (Phase 8 H4-T2, user decision 2026-10-20): a 400px art instead of
  // 480px, so title, steps and action stay above the fold.
  artSize?: "md" | "sm";
  // "cascade" (Phase 8 H4-T2): art, title, message, each step and the
  // action rise in turn instead of the whole block at once.
  entrance?: "block" | "cascade";
  // Phase 8 H4-T2: a dotted notebook-paper field behind the block.
  paper?: boolean;
  className?: string;
}

const ART_CLASS = { md: "max-w-[480px]", sm: "max-w-[400px]" } as const;
const ART_SIZES = {
  md: "(min-width: 768px) 480px, 90vw",
  sm: "(min-width: 768px) 400px, 90vw",
} as const;

// Natural deceleration for the cascade (Phase 8 H4-T2).
const CASCADE_EASE = [0.16, 1, 0.3, 1] as const;
const CASCADE_DURATION = 0.32;
const CASCADE_STEP_START = 0.18;
const CASCADE_STEP_GAP = 0.06;

// Illustrated empty state (Phase 8 H3, the calendar's "Hoy"; user decision
// 2026-10-19): a decorative illustration with a transparent background
// (people and feet stay whole) on a soft, blurred violet gradient blob
// (`illustration-backdrop`), over a big gradient title,
// a muted message and an optional quiet action, all centred on a calm
// violet glow (`empty-state-glow`). The block fades and rises in once with
// Motion; under prefers-reduced-motion only the transition changes
// (duration 0), never `initial`, so the server markup and hydration match.
// `steps` (Phase 8 H4, notebooks hub) adds the numbered pills of a short
// "how it works" between message and action; `artSize`, `entrance` and
// `paper` (H4-T2) give the hub a smaller art, a cascade entrance and the
// dotted-paper field, while the calendar keeps the defaults.
export function IllustratedEmptyState({
  image,
  title,
  description,
  action,
  steps,
  artSize = "md",
  entrance = "block",
  paper = false,
  className,
}: IllustratedEmptyStateProps) {
  const reduce = useReducedMotion() ?? false;
  const cascade = entrance === "cascade";
  const hasSteps = Boolean(steps && steps.length > 0);
  const stepCount = steps?.length ?? 0;
  // Each part fades and rises 10px; under reduced motion only the
  // transition changes (duration 0), never `initial`. Block mode animates
  // the root only, so its parts get no motion props at all.
  const enter = (delay: number) =>
    cascade
      ? {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: reduce
            ? { duration: 0 }
            : { duration: CASCADE_DURATION, ease: CASCADE_EASE, delay },
        }
      : {};
  const block = cascade
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: reduce
          ? { duration: 0 }
          : { type: "spring" as const, bounce: 0, visualDuration: 0.5 },
      };

  return (
    <motion.div
      data-slot="illustrated-empty-state"
      data-entrance={entrance}
      data-surface={paper ? "paper" : undefined}
      className={cn(
        "empty-state-glow",
        paper && "dotted-paper",
        "flex flex-col items-center px-6 pt-8 pb-14 text-center md:pt-10",
        className,
      )}
      {...block}
    >
      <motion.div
        data-part="art"
        className={cn(
          "illustration-backdrop relative w-full",
          ART_CLASS[artSize],
        )}
        {...enter(0)}
      >
        <Image
          src={image.src}
          alt=""
          width={image.width}
          height={image.height}
          sizes={ART_SIZES[artSize]}
          className="relative h-auto w-full"
        />
      </motion.div>
      <motion.h3
        className="-mt-2 text-balance font-semibold text-2xl text-gradient-brand leading-tight md:text-3xl"
        {...enter(0.08)}
      >
        {title}
      </motion.h3>
      <motion.p
        className="mt-3 max-w-md text-pretty text-[15px] text-fg-muted"
        {...enter(0.13)}
      >
        {description}
      </motion.p>
      {hasSteps && (
        <ol
          data-part="steps"
          className="mt-5 flex flex-wrap justify-center gap-2.5"
        >
          {steps?.map((step, index) => (
            <motion.li
              key={step}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-white px-3.5 py-1.5 text-[13px] text-fg-secondary"
              {...enter(CASCADE_STEP_START + index * CASCADE_STEP_GAP)}
            >
              <span className="font-bold text-primary-600">{index + 1}</span>
              {step}
            </motion.li>
          ))}
        </ol>
      )}
      {action && (
        <motion.div
          data-part="action"
          className={cn(hasSteps ? "mt-7" : "mt-5", "text-sm")}
          {...enter(CASCADE_STEP_START + stepCount * CASCADE_STEP_GAP)}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
