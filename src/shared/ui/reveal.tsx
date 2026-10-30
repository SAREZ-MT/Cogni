"use client";

import { motion, stagger, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Staggered entrance for a screen's blocks (Phase 8 Home empty state; same
// feel as the auth pages' AuthStack): each RevealItem rises 8px and fades in,
// one after another, without overshoot. Opacity/translate only, each item
// under 400 ms. Under prefers-reduced-motion nothing animates: the variants
// switch to zero-duration transitions. Only transitions change, never
// `initial`, so the server markup is the same either way and hydration
// matches. Items end at `transform: none`, so a tour highlight that measures
// them afterwards sees their real position.
export function revealVariants(reduce: boolean) {
  return {
    group: {
      hidden: {},
      shown: {
        transition: reduce
          ? { delayChildren: 0 }
          : { delayChildren: stagger(0.06, { startDelay: 0.04 }) },
      },
    },
    item: {
      hidden: { opacity: 0, y: 8 },
      shown: {
        opacity: 1,
        y: 0,
        transition: reduce
          ? { duration: 0 }
          : { type: "spring" as const, bounce: 0, visualDuration: 0.34 },
      },
    },
  } as const;
}

export function RevealGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { group } = revealVariants(useReducedMotion() ?? false);
  return (
    <motion.div
      className={className}
      variants={group}
      initial="hidden"
      animate="shown"
    >
      {children}
    </motion.div>
  );
}

// Must render under a RevealGroup (any depth): it inherits the group's
// hidden/shown state and joins its stagger in render order.
export function RevealItem({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { item } = revealVariants(useReducedMotion() ?? false);
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
