"use client";

import { useInView, useReducedMotion } from "motion/react";
import type { RefObject } from "react";

// The landing's micro-demos play once, the first time 40% of their visual
// is on screen, and never loop. With reduced motion they render their final
// state straight away.
export function usePlayOnce(ref: RefObject<HTMLElement | null>) {
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduceMotion = useReducedMotion();
  return inView || Boolean(reduceMotion);
}
