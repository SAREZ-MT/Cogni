"use client";

import { CalendarCheck, Check, Sparkles } from "lucide-react";
import { motion, stagger, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";

// Four glass fragments that hint at the real product: what Cogni's AI does
// (one capability per technique), a flashcard flipping
// question -> answer, today's review chip split by technique, and a passed
// practice exam. Decorative only (the parent showcase is aria-hidden).

const FLIP_EVERY_MS = 3800;
// Same token families as the app's RatingButton (shared/ui/rating-button):
// again=error, hard=warning, good=success, easy=primary — the pastel tint
// reworked for the dark glass (light *-100 text stays AA on the tint).
const RATINGS: ReadonlyArray<{
  label: string;
  className: string;
  selected?: boolean;
}> = [
  {
    label: "Otra vez",
    className: "border-error-500/35 bg-error-500/15 text-error-100",
  },
  {
    label: "Difícil",
    className: "border-warning-500/35 bg-warning-500/15 text-warning-100",
  },
  {
    label: "Bien",
    className: "border-success-500/50 bg-success-500/25 text-success-100",
    selected: true,
  },
  {
    label: "Fácil",
    className: "border-primary-400/40 bg-primary-400/20 text-primary-100",
  },
];

// What the AI really does in Cogni: one capability per technique.
const AI_BENEFITS = [
  { label: "Genera flashcards de cada página", dot: "bg-warning-500" },
  { label: "Te hace preguntas para recordar sin mirar", dot: "bg-success-500" },
  { label: "Arma exámenes de práctica para medirte", dot: "bg-rose-400" },
] as const;

const benefitListVariants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(0.12, { startDelay: 1.1 }) } },
};

const benefitVariants = {
  hidden: { opacity: 0, x: -4 },
  shown: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
} as const;

const stackVariants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(0.16, { startDelay: 0.35 }) } },
};

const fragmentVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.96, filter: "blur(6px)" },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", bounce: 0, visualDuration: 0.7 },
  },
} as const;

function Glass({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[rgb(41_37_36/0.95)] shadow-[0_16px_48px_rgb(0_0_0/0.4)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Slow idle float; each fragment gets its own period so they never sync.
function Float({
  period,
  distance = 6,
  children,
}: {
  period: number;
  distance?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration: period, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

function TechniqueDot({ className }: { className: string }) {
  return <span className={cn("size-1.5 rounded-full", className)} />;
}

function FlashcardFragment() {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setFlipped((value) => !value);
    }, FLIP_EVERY_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const face =
    "absolute inset-0 flex flex-col justify-between p-5 [backface-visibility:hidden]";
  return (
    <div className="h-[168px] w-[292px] [perspective:1100px]">
      <motion.div
        className="relative size-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", bounce: 0, visualDuration: 0.5 }}
      >
        <Glass className={face}>
          <span className="flex items-center gap-2 text-[11px] text-neutral-300">
            <TechniqueDot className="bg-warning-500" />
            Flashcard · Historia
          </span>
          <p className="text-balance font-medium text-[15px] text-neutral-0 leading-snug">
            ¿En qué año llegó el ser humano a la Luna?
          </p>
          <span className="text-[11px] text-neutral-400">Ver respuesta</span>
        </Glass>
        <Glass className={cn(face, "[transform:rotateY(180deg)]")}>
          <span className="flex items-center gap-2 text-[11px] text-neutral-300">
            <TechniqueDot className="bg-warning-500" />
            Respuesta
          </span>
          <p className="text-balance font-medium text-[15px] text-neutral-0 leading-snug">
            En 1969, con la misión Apolo 11.
          </p>
          <span className="flex gap-1.5 text-[11px]">
            {RATINGS.map((rating) => (
              <span
                key={rating.label}
                data-selected={rating.selected || undefined}
                className={cn(
                  "rounded-md border px-2 py-0.5 font-medium",
                  rating.className,
                  rating.selected && "ring-1 ring-success-500/60",
                )}
              >
                {rating.label}
              </span>
            ))}
          </span>
        </Glass>
      </motion.div>
    </div>
  );
}

function DueTodayFragment() {
  return (
    <Glass className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-400/20 text-primary-200">
        <CalendarCheck className="size-4" strokeWidth={1.75} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-medium text-[13px] text-neutral-0">
          Repaso de hoy
        </span>
        <span className="flex items-center gap-2.5 text-[11px] text-neutral-300 tabular-nums">
          <span className="flex items-center gap-1">
            <TechniqueDot className="bg-warning-500" />6
          </span>
          <span className="flex items-center gap-1">
            <TechniqueDot className="bg-success-500" />4
          </span>
          <span className="flex items-center gap-1">
            <TechniqueDot className="bg-rose-400" />2
          </span>
        </span>
      </span>
      <span className="ml-1 rounded-full bg-neutral-0 px-2 py-0.5 font-semibold text-[11px] text-neutral-900 tabular-nums">
        12
      </span>
    </Glass>
  );
}

// Describes the AI's job in Cogni; its three lines ease in once after the
// card arrives (opacity only under reduced motion, via MotionConfig).
function AiFragment() {
  return (
    <Glass className="flex w-[276px] flex-col gap-2.5 px-4 py-3.5">
      <span className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary-400/20 text-primary-200">
          <Sparkles className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="font-medium text-[13px] text-neutral-0">
          IA de Cogni
        </span>
      </span>
      <p className="text-pretty text-[12px] text-neutral-300 leading-snug">
        Lee tus apuntes y crea el material de estudio por ti.
      </p>
      <motion.ul
        className="flex flex-col gap-1.5"
        variants={benefitListVariants}
        initial="hidden"
        animate="shown"
      >
        {AI_BENEFITS.map((benefit) => (
          <motion.li
            key={benefit.label}
            variants={benefitVariants}
            className="flex items-center gap-2 whitespace-nowrap text-[11px] text-neutral-200 leading-tight"
          >
            <TechniqueDot className={cn("shrink-0", benefit.dot)} />
            {benefit.label}
          </motion.li>
        ))}
      </motion.ul>
    </Glass>
  );
}

function ExamResultFragment() {
  return (
    <Glass className="flex w-[176px] flex-col gap-2 px-4 py-3.5">
      <span className="flex items-center gap-2 text-[11px] text-neutral-300">
        <TechniqueDot className="bg-rose-400" />
        Examen de práctica
      </span>
      <span className="flex items-center justify-between">
        <span className="font-semibold text-[22px] text-neutral-0 tabular-nums leading-none">
          9/10
        </span>
        <span className="flex items-center gap-1 rounded-full bg-success-500/15 px-2 py-0.5 font-medium text-[11px] text-success-100">
          <Check className="size-3" strokeWidth={2.25} />
          Aprobado
        </span>
      </span>
    </Glass>
  );
}

export function ProductFragments({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("relative h-[440px] w-[460px]", className)}
      variants={stackVariants}
      initial="hidden"
      animate="shown"
    >
      <motion.div
        variants={fragmentVariants}
        className="absolute top-[56px] left-[64px]"
      >
        <Float period={7}>
          <FlashcardFragment />
        </Float>
      </motion.div>
      <motion.div
        variants={fragmentVariants}
        className="absolute top-0 right-0"
      >
        <Float period={8.5} distance={5}>
          <DueTodayFragment />
        </Float>
      </motion.div>
      <motion.div
        variants={fragmentVariants}
        className="absolute top-[236px] right-0"
      >
        <Float period={9.5} distance={4}>
          <ExamResultFragment />
        </Float>
      </motion.div>
      <motion.div
        variants={fragmentVariants}
        className="absolute bottom-0 left-0"
      >
        <Float period={8} distance={5}>
          <AiFragment />
        </Float>
      </motion.div>
    </motion.div>
  );
}
