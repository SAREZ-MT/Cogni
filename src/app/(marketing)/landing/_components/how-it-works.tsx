"use client";

import { Clapperboard, Play } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Reveal } from "./reveal";

const STEPS = [
  "Sube tu apunte",
  "Cogni prepara tus técnicas",
  "Repasa cuando toca",
] as const;

// "Así funciona Cogni": the slot the product video will fill later. Until
// then it says so plainly; nothing here imitates real footage.
export function HowItWorks() {
  const slot = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: slot,
    offset: ["start end", "center center"],
  });
  // Scroll-linked growth, transform only (radius stays fixed: animating it
  // would repaint the large slot on every scroll frame). Reduced motion is
  // held in CSS (.lp-video-grow), so server and client render the same style.
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    ["scale(0.9)", "scale(1)"],
  );

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="lp-on-paper scroll-mt-20 bg-(--lp-paper) px-4 py-24 md:px-10 xl:px-40 xl:py-[120px]"
    >
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-12">
        <Reveal className="flex flex-col items-center gap-3.5 text-center">
          <p className="font-extrabold text-(--lp-violet) text-[13px] uppercase tracking-[0.15em]">
            Así funciona Cogni
          </p>
          <h2
            id="como-funciona-title"
            className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[clamp(44px,5vw,68px)] leading-[1.05] tracking-[-0.02em]"
          >
            Del apunte al repaso,{" "}
            <em className="text-(--lp-violet)">en un minuto.</em>
          </h2>
        </Reveal>

        <motion.div
          ref={slot}
          role="img"
          aria-label="Video de Cogni, próximamente"
          className="lp-video-slot lp-video-grow flex aspect-video w-full flex-col items-center justify-center gap-[22px] rounded-[20px] border border-(--lp-violet) md:rounded-[32px]"
          style={{ transform }}
        >
          <span className="flex size-20 items-center justify-center rounded-full border border-white/20 bg-(--lp-paper) md:size-28">
            <Play className="ml-1 size-8 fill-(--lp-violet) text-(--lp-violet) md:size-10" />
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-(--lp-yellow) px-4 py-[9px] font-extrabold text-(--lp-ink) text-sm">
            <Clapperboard className="size-4" />
            Video próximamente
          </span>
        </motion.div>

        <Reveal>
          <ol className="flex flex-col items-center gap-4 md:flex-row md:gap-10">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2.5">
                <span className="font-(family-name:--lp-font-display) text-(--lp-violet) text-2xl">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-bold text-(--lp-ink-2) text-base">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
