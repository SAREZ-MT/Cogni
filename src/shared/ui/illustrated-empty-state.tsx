"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { TechniqueTheme } from "@/shared/ui/technique-theme";
import { cn } from "@/shared/ui/utils";

// The art above the title: a decorative illustration (rendered with
// alt="" on the violet blob) or, since Phase 8 H4-T3, any decorative node
// such as `NotebookFan`. Exactly one of the two.
type IllustratedEmptyStateArt =
  | { image: { src: string; width: number; height: number }; art?: never }
  | { art: ReactNode; image?: never };

export type IllustratedEmptyStateProps = IllustratedEmptyStateArt & {
  title: string;
  description: string;
  // A quiet follow-up link under the message (e.g. the next review).
  action?: ReactNode;
  // Short numbered steps under the message, as an ordered list of pills.
  steps?: readonly string[];
  // "cascade" (Phase 8 H4-T2): art, title, message, each step and the
  // action rise in turn instead of the whole block at once.
  entrance?: "block" | "cascade";
  // Phase 8 H4-T2: a dotted notebook-paper field behind the block.
  paper?: boolean;
  // Phase 8 H11: a technique hub's theme — the glow, the dotted paper, the
  // headline gradient and a `tone="technique"` CTA take the technique
  // colours (globals.css `[data-technique-theme]`), and the headline gets
  // the approved mock's bold 30px weight and spacing.
  technique?: TechniqueTheme;
  className?: string;
};

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
// "how it works" between message and action; `entrance` and `paper`
// (H4-T2) give the hub a cascade entrance and the dotted-paper field, and
// `art` (H4-T3) its CSS notebook fan, while the calendar keeps the
// illustration and the defaults.
export function IllustratedEmptyState({
  image,
  art,
  title,
  description,
  action,
  steps,
  entrance = "block",
  paper = false,
  technique,
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
      data-technique-theme={technique}
      className={cn(
        "empty-state-glow",
        paper && "dotted-paper",
        "flex flex-col items-center px-6 pt-8 pb-14 text-center md:pt-10",
        className,
      )}
      {...block}
    >
      {image ? (
        <motion.div
          data-part="art"
          className="illustration-backdrop relative w-full max-w-[480px]"
          {...enter(0)}
        >
          <Image
            src={image.src}
            alt=""
            width={image.width}
            height={image.height}
            sizes="(min-width: 768px) 480px, 90vw"
            className="relative h-auto w-full"
          />
        </motion.div>
      ) : (
        <motion.div data-part="art" className="w-full" {...enter(0)}>
          {art}
        </motion.div>
      )}
      <motion.h3
        className={cn(
          image ? "-mt-2" : technique ? "mt-7" : "mt-4",
          "text-balance text-2xl text-gradient-brand leading-tight md:text-3xl",
          technique ? "font-bold tracking-[-0.015em]" : "font-semibold",
        )}
        {...enter(0.08)}
      >
        {title}
      </motion.h3>
      <motion.p
        className={cn(
          "max-w-md text-pretty text-[15px]",
          technique ? "mt-2.5 text-fg-secondary" : "mt-3 text-fg-muted",
        )}
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
