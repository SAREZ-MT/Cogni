"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { type ReactNode, useRef } from "react";
import { Reveal } from "./reveal";

export type BandTone = {
  // Band background, eyebrow, statement, emphasis and big number colours.
  ground: string;
  eyebrow: string;
  text: string;
  emphasis: string;
  number: string;
};

// The full-width colour band that opens each pillar (Knowt's "Ace your test"
// band). Its background grows from the bottom as it scrolls in, scroll-
// linked and transform-only; the statement uses the shared reveal. Reduced
// motion pins it full size in landing.css, so server and client render the
// same style attribute (no hydration mismatch).
export function PillarBand({
  number,
  eyebrow,
  titleId,
  tone,
  children,
}: {
  number: string;
  eyebrow: string;
  titleId: string;
  tone: BandTone;
  children: ReactNode;
}) {
  const band = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: band,
    offset: ["start end", "start 40%"],
  });
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    ["scaleY(0.6)", "scaleY(1)"],
  );

  return (
    <div ref={band} className="relative">
      <motion.div
        aria-hidden="true"
        className={`lp-band-ground absolute inset-0 origin-bottom ${tone.ground}`}
        style={{ transform }}
      />
      <Reveal className="relative mx-auto flex max-w-[1440px] items-end justify-between gap-6 px-4 py-12 md:px-10 md:py-16 xl:px-20">
        <div className="flex flex-col gap-3">
          <p
            className={`font-extrabold text-[13px] uppercase tracking-[0.15em] ${tone.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h2
            id={titleId}
            className={`font-(family-name:--lp-font-display) text-[clamp(44px,6vw,84px)] leading-none tracking-[-0.02em] ${tone.text}`}
          >
            {children}
          </h2>
        </div>
        <span
          aria-hidden="true"
          className={`hidden font-(family-name:--lp-font-display) text-[clamp(72px,8vw,120px)] italic leading-[0.8] sm:block ${tone.number}`}
        >
          {number}
        </span>
      </Reveal>
    </div>
  );
}
