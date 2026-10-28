"use client";

import { BellRing, CalendarDays, RotateCcw, Sparkles } from "lucide-react";
import {
  LayoutGroup,
  motion,
  stagger,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

type Tone = "flash" | "exam" | "recall";

// The note Cogni "reads". Generic example copy (docs/landing/descripcion.md):
// no real subject or topic. The three highlighted ideas become the cards.
const SEGMENTS: { text: string; tone?: Tone }[] = [
  { text: "Un " },
  { text: "concepto clave", tone: "flash" },
  { text: " se entiende mejor cuando lo conectas con una " },
  { text: "definición", tone: "exam" },
  { text: " clara y con la " },
  { text: "relación entre ideas", tone: "recall" },
  {
    text: ". Repasarlo a tiempo evita que se pierda. Este texto es un ejemplo de Tu apunte.",
  },
];

const CARDS: {
  tone: Tone;
  kicker: string;
  title: string;
  detail: string;
  date: string;
  position: string;
}[] = [
  {
    tone: "flash",
    kicker: "Tarjeta",
    title: "Tu apunte",
    detail: "Pregunta y respuesta",
    date: "Hoy",
    position: "md:left-[372px] md:top-[34px]",
  },
  {
    tone: "exam",
    kicker: "Examen",
    title: "Opción A · Opción B",
    detail: "Ponte a prueba",
    date: "En 3 días",
    position: "md:left-[340px] md:top-[162px]",
  },
  {
    tone: "recall",
    kicker: "Recuperación activa",
    title: "Explícalo con tus palabras",
    detail: "Sin mirar tus apuntes",
    date: "En 7 días",
    position: "md:left-[383px] md:top-[306px]",
  },
];

const TONE = {
  flash: { mark: "bg-(--lp-hl-flash)", edge: "border-(--lp-yellow)" },
  exam: { mark: "bg-(--lp-hl-exam)", edge: "border-(--lp-rose)" },
  recall: { mark: "bg-(--lp-hl-recall)", edge: "border-(--lp-mint)" },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const TYPE_STEP = 0.012;
const CARD_STAGGER_MS = 120;
const SETTLE_MS = 900;
const CARD_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

type Phase = "writing" | "cards" | "done";

export function HeroEditor() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("writing");
  // The replay control only exists once the sequence actually plays; it is
  // decided after hydration so server and client render the same tree.
  const [canReplay, setCanReplay] = useState(false);
  // How many highlighted words have already become cards.
  const [cardsShown, setCardsShown] = useState(0);
  const timers = useRef<number[]>([]);
  const run = useRef(0);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const showFinalState = useCallback(() => {
    clearTimers();
    setCardsShown(CARDS.length);
    setPhase("done");
  }, [clearTimers]);

  const play = useCallback(async () => {
    const current = ++run.current;
    clearTimers();
    setCardsShown(0);
    setPhase("writing");

    // Back to the blank page before typing again (a replay starts from a
    // fully written note).
    animate(".lp-ch", { opacity: 0 }, { duration: 0 });
    animate(".lp-mark", { transform: "scaleX(0)" }, { duration: 0 });
    animate(".lp-ai-chip", { opacity: 0 }, { duration: 0 });

    await animate([
      [
        ".lp-ch",
        { opacity: [0, 1] },
        { duration: 0.01, delay: stagger(TYPE_STEP) },
      ],
      [
        ".lp-mark",
        { transform: ["scaleX(0)", "scaleX(1)"] },
        { duration: 0.35, ease: EASE_OUT, delay: stagger(0.15), at: "+0.25" },
      ],
      [
        ".lp-ai-chip",
        { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] },
        { duration: 0.3, ease: EASE_OUT, at: "+0.1" },
      ],
    ]);
    if (current !== run.current) return;

    setPhase("cards");
    CARDS.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(
          () => setCardsShown(index + 1),
          index * CARD_STAGGER_MS,
        ),
      );
    });
    timers.current.push(
      window.setTimeout(
        () => setPhase("done"),
        CARDS.length * CARD_STAGGER_MS + SETTLE_MS,
      ),
    );
  }, [animate, clearTimers]);

  useEffect(() => {
    if (reduceMotion) {
      setCanReplay(false);
      showFinalState();
      return;
    }
    setCanReplay(true);
    let frame = 0;
    // Start after the fonts settle and the first paint, so the typed text
    // never reflows mid-sequence.
    document.fonts.ready.then(() => {
      frame = window.requestAnimationFrame(() => void play());
    });
    return () => {
      window.cancelAnimationFrame(frame);
      run.current++;
      clearTimers();
    };
  }, [reduceMotion, play, showFinalState, clearTimers]);

  let cardIndex = -1;

  return (
    <div className="flex w-full flex-col gap-4 md:mx-auto md:w-[680px] md:shrink-0 xl:mx-0">
      <p className="sr-only">
        Animación de ejemplo: Cogni lee tu apunte, resalta tres ideas clave y
        las convierte en una tarjeta para hoy, un examen en 3 días y una
        pregunta de recuperación activa en 7 días.
      </p>
      <LayoutGroup id="hero">
        <div
          ref={scope}
          aria-hidden="true"
          className="relative flex flex-col gap-4 md:block md:h-[560px]"
        >
          <div className="lp-shadow-float flex flex-col overflow-hidden rounded-[20px] bg-(--lp-editor) md:absolute md:top-[30px] md:left-0 md:h-[470px] md:w-[470px]">
            <div className="flex h-[50px] shrink-0 items-center gap-[7px] border-(--lp-editor-line) border-b px-[18px]">
              <span className="size-[9px] rounded-full bg-(--lp-editor-dot)" />
              <span className="size-[9px] rounded-full bg-(--lp-editor-dot)" />
              <span className="size-[9px] rounded-full bg-(--lp-editor-dot)" />
              <span className="ml-2 rounded-md bg-(--lp-editor-tab) px-2.5 py-[5px] font-bold text-(--lp-ink) text-xs">
                Tu cuaderno / Tu apunte
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-4 px-6 pt-[30px] pb-7 md:px-9">
              <p className="font-extrabold text-(--lp-ink) text-[30px] tracking-[-0.03em]">
                Tu apunte
              </p>
              <p className="text-(--lp-editor-text) text-base leading-9 md:max-w-[300px]">
                {SEGMENTS.map((segment) => {
                  const chars = [...segment.text].map((char, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: characters of a fixed string never reorder.
                    <span key={index} className="lp-ch">
                      {char}
                    </span>
                  ));
                  if (!segment.tone) {
                    return <Fragment key={segment.text}>{chars}</Fragment>;
                  }
                  cardIndex += 1;
                  return (
                    <span
                      key={segment.text}
                      className="relative isolate whitespace-nowrap font-bold text-(--lp-ink)"
                    >
                      <span
                        className={`lp-mark absolute -inset-x-[5px] inset-y-0 -z-10 rounded ${TONE[segment.tone].mark}`}
                      />
                      {cardsShown <= cardIndex && (
                        <motion.span
                          layoutId={`hero-card-${cardIndex}`}
                          className="absolute -inset-x-[5px] inset-y-0 rounded opacity-0"
                        />
                      )}
                      {chars}
                    </span>
                  );
                })}
              </p>
              <p className="lp-ai-chip mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-(--lp-violet) px-[11px] py-[5px] font-bold text-white text-xs">
                <Sparkles className="size-[13px]" />
                Cogni encontró 3 ideas
              </p>
            </div>
          </div>

          <motion.p
            className="font-extrabold text-(--lp-violet-300) text-[11px] uppercase tracking-[0.11em] md:absolute md:top-0 md:left-[360px]"
            initial={false}
            animate={{ opacity: phase === "writing" ? 0 : 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            Creado por Cogni · con fecha de repaso
          </motion.p>

          <div className="flex min-h-[345px] flex-col gap-3 md:block md:min-h-0">
            {CARDS.map((card, index) =>
              index < cardsShown ? (
                <motion.div
                  key={card.kicker}
                  layoutId={`hero-card-${index}`}
                  className={`lp-shadow-card relative overflow-hidden border-[1.5px] bg-white px-4 py-3.5 md:absolute md:w-[292px] ${card.position} ${TONE[card.tone].edge}`}
                  style={{ borderRadius: 12 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    opacity: { duration: 0.15 },
                    layout: CARD_SPRING,
                  }}
                >
                  <motion.span
                    className={`absolute inset-0 ${TONE[card.tone].mark}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.25, ease: EASE_OUT }}
                  />
                  <motion.div
                    className="relative flex flex-col gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.35, ease: EASE_OUT }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-extrabold text-(--lp-card-kicker) text-[10px] uppercase tracking-[0.1em]">
                        {card.kicker}
                      </span>
                      <motion.span
                        className={`inline-flex items-center gap-[5px] rounded-full px-[9px] py-1 font-extrabold text-[11px] ${
                          index === 0
                            ? "bg-(--lp-violet) text-white"
                            : "bg-(--lp-violet-100) text-(--lp-violet-deep)"
                        }`}
                        initial={{ opacity: 0, transform: "translateY(8px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        transition={{
                          duration: 0.35,
                          delay: 0.6,
                          ease: EASE_OUT,
                        }}
                      >
                        <CalendarDays className="size-3" />
                        {card.date}
                      </motion.span>
                    </div>
                    <span className="font-extrabold text-(--lp-ink) text-base">
                      {card.title}
                    </span>
                    <span className="text-(--lp-card-kicker) text-xs">
                      {card.detail}
                    </span>
                  </motion.div>
                </motion.div>
              ) : null,
            )}
          </div>

          <motion.p
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-[9px] font-bold text-(--lp-on-dark) text-sm md:absolute md:top-[518px] md:left-[360px]"
            initial={false}
            animate={
              phase === "done"
                ? { opacity: 1, transform: "translateY(0px)" }
                : { opacity: 0, transform: "translateY(8px)" }
            }
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <BellRing className="size-[15px] text-(--lp-yellow)" />
            Cogni te avisa cuándo repasar
          </motion.p>
        </div>
      </LayoutGroup>

      {canReplay && (
        <motion.button
          type="button"
          onClick={() => void play()}
          disabled={phase !== "done"}
          className="lp-press inline-flex w-fit items-center gap-1.5 self-start rounded-full px-2 py-1 font-semibold text-(--lp-on-dark-3) text-sm hover:text-(--lp-on-dark) md:self-end"
          initial={false}
          animate={{ opacity: phase === "done" ? 1 : 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Repetir animación
        </motion.button>
      )}
    </div>
  );
}
