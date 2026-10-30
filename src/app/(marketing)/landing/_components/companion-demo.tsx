"use client";

import { CircleCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { usePlayOnce } from "./play-once";

// The study companion's session summary (moved from the former pillar 04
// into the last Técnicas panel): strengths first, then improvement
// opportunities, then the mastery gain. Example content stays generic and
// never tells the student they are wrong. Decorative: the panel copy next
// to it carries the meaning.

const STRENGTHS = [
  "Dominas las definiciones de Tu apunte.",
  "Respondiste con seguridad las preguntas de relación entre ideas.",
] as const;
const NEXT_STEPS = [
  "Vuelve a la sección del concepto clave antes del próximo repaso.",
  "Prueba explicarlo con tus palabras: Cogni ya te dejó la pregunta lista.",
] as const;

const POP = { type: "spring", visualDuration: 0.4, bounce: 0.25 } as const;
const WORD_STEP = 0.04;
const WORDS_TOTAL = [...STRENGTHS, ...NEXT_STEPS].join(" ").split(" ").length;

// The feedback writes itself word by word, then the mastery gain pops in.
export function CompanionDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);
  let wordIndex = 0;

  const words = (sentence: string) =>
    sentence.split(" ").map((word) => {
      const delay = 0.2 + wordIndex * WORD_STEP;
      wordIndex += 1;
      return (
        <motion.span
          key={`${word}-${delay}`}
          className="inline-block"
          initial={{ opacity: 0 }}
          animate={play ? { opacity: 1 } : undefined}
          transition={{ duration: 0.2, delay }}
        >
          {word}&nbsp;
        </motion.span>
      );
    });

  const list = (items: readonly string[], dot: string) => (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2 text-(--lp-ink-2) text-[13px] leading-normal md:text-sm"
        >
          <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{words(item)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="lp-companion relative flex w-full flex-col gap-3.5 rounded-[22px] bg-white p-5 md:gap-4 md:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--lp-violet) text-white">
          <Sparkles className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[17px] tracking-[-0.01em]">
            Así te fue en esta sesión
          </span>
          <span className="font-(family-name:--lp-font-mono) text-(--lp-ink-3) text-[11px] uppercase tracking-[0.1em]">
            Examen · Tu apunte · 10 preguntas
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-(--lp-mint-50) p-3.5 md:p-4">
        <span className="flex items-center gap-1.5 font-semibold text-(--lp-green-700) text-sm">
          <CircleCheck className="size-4" />
          Fortalezas
        </span>
        {list(STRENGTHS, "bg-(--lp-green-500)")}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-(--lp-yellow-100) p-3.5 md:p-4">
        <span className="flex items-center gap-1.5 font-semibold text-(--lp-amber-800) text-sm">
          <Sparkles className="size-4" />
          Oportunidades de mejora
        </span>
        {list(NEXT_STEPS, "bg-(--lp-amber-500)")}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-(--lp-ink) text-[13px]">
            Dominio de Tu apunte
          </span>
          <span className="flex items-center gap-2 text-[13px]">
            <span className="text-(--lp-ink-3)">52 %</span>
            <span className="font-semibold text-(--lp-violet-deep) text-[15px]">
              68 %
            </span>
            <motion.span
              className="rounded-full bg-(--lp-mint-100) px-2 py-0.5 font-semibold text-(--lp-green-700) text-[12px]"
              initial={{ opacity: 0, transform: "scale(0.8)" }}
              animate={play ? { opacity: 1, transform: "scale(1)" } : undefined}
              transition={{ ...POP, delay: 0.3 + WORDS_TOTAL * WORD_STEP }}
            >
              +16
            </motion.span>
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-(--lp-violet-100)">
          <span className="absolute inset-y-0 left-0 w-[68%] rounded-full bg-(--lp-violet-300)" />
          <span className="absolute inset-y-0 left-0 w-[52%] rounded-full bg-(--lp-violet)" />
        </div>
      </div>
    </div>
  );
}
