"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/ui/utils";

// A number that settles in with a gentle pop once (Phase 8 H2-T5 Home
// counts): it always renders its final value, so the server markup, tests
// and screen readers never see an intermediate count. Under
// prefers-reduced-motion only the transition changes (zero duration),
// never `initial`, so hydration matches.
export function PopNumber({
  value,
  delay = 0,
  className,
}: {
  value: number | string;
  // Seconds, to follow a surrounding stagger.
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.span
      data-slot="pop-number"
      className={cn("inline-block", className)}
      initial={{ opacity: 0, scale: 0.82, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", bounce: 0.3, visualDuration: 0.4, delay }
      }
    >
      {value}
    </motion.span>
  );
}
