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
  // false: the plain variant (Phase 8 H4, notebooks hub; user decision
  // 2026-10-20) for an illustration that keeps its own white background on
  // the white page: no glow, no backdrop blob, a wider art and message.
  backdrop?: boolean;
  // Short numbered steps under the message, as an ordered list of pills.
  steps?: readonly string[];
  className?: string;
}

// Illustrated empty state (Phase 8 H3, the calendar's "Hoy"; user decision
// 2026-10-19): a decorative illustration with a transparent background
// (people and feet stay whole) on a soft, blurred violet gradient blob
// (`illustration-backdrop`), over a big gradient title,
// a muted message and an optional quiet action, all centred on a calm
// violet glow (`empty-state-glow`). The block fades and rises in once with
// Motion; under prefers-reduced-motion only the transition changes
// (duration 0), never `initial`, so the server markup and hydration match.
// `backdrop={false}` (Phase 8 H4, notebooks hub) drops the glow and the blob
// for an illustration with its own white background, and `steps` adds the
// numbered pills of a short "how it works" between message and action.
export function IllustratedEmptyState({
  image,
  title,
  description,
  action,
  backdrop = true,
  steps,
  className,
}: IllustratedEmptyStateProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      data-slot="illustrated-empty-state"
      data-variant={backdrop ? "glow" : "plain"}
      className={cn(
        backdrop && "empty-state-glow",
        "flex flex-col items-center px-6 pt-8 pb-14 text-center md:pt-10",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", bounce: 0, visualDuration: 0.5 }
      }
    >
      <div
        data-part="art"
        className={
          backdrop
            ? "illustration-backdrop relative w-full max-w-[480px]"
            : "relative w-full max-w-[560px]"
        }
      >
        <Image
          src={image.src}
          alt=""
          width={image.width}
          height={image.height}
          sizes={
            backdrop
              ? "(min-width: 768px) 480px, 90vw"
              : "(min-width: 768px) 560px, 90vw"
          }
          className="relative h-auto w-full"
        />
      </div>
      <h3
        className={cn(
          backdrop ? "-mt-2" : "mt-3",
          "text-balance font-semibold text-2xl text-gradient-brand leading-tight md:text-3xl",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "mt-3",
          backdrop ? "max-w-md" : "max-w-[520px]",
          "text-pretty text-[15px] text-fg-muted",
        )}
      >
        {description}
      </p>
      {steps && steps.length > 0 && (
        <ol
          data-part="steps"
          className="mt-5 flex flex-wrap justify-center gap-2.5"
        >
          {steps.map((step, index) => (
            <li
              key={step}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-white px-3.5 py-1.5 text-[13px] text-fg-secondary"
            >
              <span className="font-bold text-primary-600">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {action && (
        <div
          data-part="action"
          className={cn(steps && steps.length > 0 ? "mt-7" : "mt-5", "text-sm")}
        >
          {action}
        </div>
      )}
    </motion.div>
  );
}
