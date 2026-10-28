"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// reducedMotion="user": with prefers-reduced-motion, Motion drops transform
// and layout animations and keeps opacity ones, so every reveal falls back to
// a plain fade. No nonce is needed: style-src allows inline styles
// (src/shared/config/security-headers.ts).
export function LandingMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
