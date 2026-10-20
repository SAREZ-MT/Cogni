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
export function IllustratedEmptyState({
  image,
  title,
  description,
  action,
  className,
}: IllustratedEmptyStateProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      data-slot="illustrated-empty-state"
      className={cn(
        "empty-state-glow flex flex-col items-center px-6 pt-8 pb-14 text-center md:pt-10",
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
        className="illustration-backdrop relative w-full max-w-[480px]"
      >
        <Image
          src={image.src}
          alt=""
          width={image.width}
          height={image.height}
          sizes="(min-width: 768px) 480px, 90vw"
          className="relative h-auto w-full"
        />
      </div>
      <h3 className="-mt-2 text-balance font-semibold text-2xl text-gradient-brand leading-tight md:text-3xl">
        {title}
      </h3>
      <p className="mt-3 max-w-md text-pretty text-[15px] text-fg-muted">
        {description}
      </p>
      {action && (
        <div data-part="action" className="mt-5 text-sm">
          {action}
        </div>
      )}
    </motion.div>
  );
}
