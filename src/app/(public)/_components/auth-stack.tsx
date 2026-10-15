"use client";

import { MotionConfig, motion, stagger } from "motion/react";
import { Children, type ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

// Vertical stack for the auth pages: each direct child (heading, notices,
// form, divider, Google button, links) rises in with a short stagger. Fast
// and without overshoot so the form is usable almost immediately; reduced
// motion keeps only the fade (MotionConfig "user").
const listVariants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(0.05, { startDelay: 0.05 }) } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", bounce: 0, visualDuration: 0.35 },
  },
} as const;

export function AuthStack({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={cn("flex flex-col gap-6", className)}
        variants={listVariants}
        initial="hidden"
        animate="shown"
      >
        {Children.map(children, (child) =>
          child ? (
            <motion.div variants={itemVariants}>{child}</motion.div>
          ) : null,
        )}
      </motion.div>
    </MotionConfig>
  );
}
