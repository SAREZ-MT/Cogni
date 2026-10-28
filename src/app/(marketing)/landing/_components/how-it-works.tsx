"use client";

import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { AsciiTexture } from "./ascii-texture";
import { type HeadlineImage, HeadlineObject } from "./headline-object";

// Approved v2 copy (docs/landing/propuesta-contenido.md §9): each step
// only connects to the section that explains it in full.
export const HOW_IT_WORKS_STEPS = [
  {
    title: "Sube tu apunte",
    text: "Importa tu documento o escribe directo en el editor.",
  },
  {
    title: "Cogni prepara tus técnicas",
    text: "Tú eliges qué técnica generar, y sale solo de lo que dice tu página.",
  },
  {
    title: "Repasa cuando toca",
    text: "Cada respuesta fija tu próximo repaso. Tú solo abres Hoy.",
  },
] as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const RISE = {
  initial: { opacity: 0, transform: "translateY(24px)" },
  whileInView: { opacity: 1, transform: "translateY(0px)" },
  viewport: { once: true, amount: 0.4 },
} as const;

// "Así funciona Cogni", the first paper section. A tall dusk band carries
// the hero's violet night down into the paper (a gradient plus a character
// texture that dithers away), so the page reads as one continuous scene.
// Then a huge sans headline with one serif italic keyword and a 3D object
// set between its words, the slot the product video will fill (it says so
// plainly; nothing imitates real footage), and the three steps.
//
// "repaso" is the italic keyword: it is where the sentence lands and what
// Cogni is for, the same role "estudias." plays in the hero.
export function HowItWorks({ image }: { image?: HeadlineImage }) {
  const slot = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: slot,
    offset: ["start end", "center center"],
  });
  // Scroll-linked growth, transform only (the radius stays fixed: animating
  // it would repaint the large slot every frame). Reduced motion is held in
  // CSS (.lp-video-grow), so server and client render the same style.
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    ["scale(0.9)", "scale(1)"],
  );

  return (
    <>
      <div aria-hidden="true" className="lp-dusk relative">
        <span
          data-nav-theme="dark"
          className="absolute inset-x-0 top-0 h-1/2"
        />
        <span
          data-nav-theme="light"
          className="absolute inset-x-0 bottom-0 h-1/2"
        />
        <AsciiTexture
          variant="dissolve"
          seed={3}
          className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
        />
      </div>

      <section
        id="como-funciona"
        aria-labelledby="como-funciona-title"
        data-nav-theme="light"
        className="lp-on-paper relative scroll-mt-20 bg-(--lp-paper) px-5 pt-2 pb-10 md:px-10 md:pb-12 xl:px-20 xl:pb-14"
      >
        <div className="mx-auto max-w-[1280px]">
          <motion.p
            {...RISE}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-deep) text-[16px] uppercase tracking-[0.14em] md:text-[20px]"
          >
            <span
              aria-hidden="true"
              className="size-2 bg-(--lp-violet) md:size-2.5"
            />
            Así funciona Cogni
          </motion.p>
          <motion.h2
            {...RISE}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.08 }}
            id="como-funciona-title"
            className="lp-headline mt-6 text-(--lp-ink) md:mt-8"
          >
            Del{" "}
            <span className="whitespace-nowrap">
              apunte <HeadlineObject image={image} tone="yellow" />
            </span>{" "}
            al <em className="lp-headline-accent">repaso</em>,{" "}
            <br className="hidden md:inline" />
            sin armar nada a mano.
          </motion.h2>

          <motion.div
            ref={slot}
            role="img"
            aria-label="Video de Cogni, próximamente"
            className="lp-video-slot lp-video-grow relative mt-14 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[20px] sm:aspect-video md:mt-20 md:rounded-[28px]"
            style={{ transform }}
          >
            <AsciiTexture
              variant="field"
              seed={11}
              className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
            />
            <span className="lp-video-play relative flex size-20 items-center justify-center rounded-full md:size-[104px]">
              <Play weight="fill" className="ml-1 size-7 md:size-9" />
            </span>
            <span className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 font-(family-name:--lp-font-mono) text-(--lp-on-dark-2) text-[11px] uppercase tracking-[0.16em] md:bottom-8 md:text-[12px]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-(--lp-violet-400)"
              />
              Video próximamente
            </span>
          </motion.div>

          <ol className="mt-14 grid gap-9 md:mt-20 md:grid-cols-3 md:gap-10">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                {...RISE}
                transition={{
                  duration: 0.5,
                  ease: EASE_OUT,
                  delay: 0.08 * index,
                }}
                className="lp-step relative pt-5"
              >
                <span className="font-(family-name:--lp-font-mono) text-(--lp-violet) text-[13px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-3 block font-(family-name:--lp-font-head) font-medium text-(--lp-ink) text-[22px] leading-[1.2] tracking-[-0.02em] md:text-[26px]">
                  {step.title}
                </span>
                <p className="mt-3 max-w-[34ch] text-(--lp-ink-2) text-[16px] leading-[1.55] md:text-[17px]">
                  {step.text}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <div aria-hidden="true" className="lp-dusk-out relative">
        <span
          data-nav-theme="light"
          className="absolute inset-x-0 top-0 h-1/2"
        />
        <span
          data-nav-theme="dark"
          className="absolute inset-x-0 bottom-0 h-1/2"
        />
        <AsciiTexture
          variant="dissolve"
          flip
          seed={5}
          className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
        />
      </div>
    </>
  );
}
