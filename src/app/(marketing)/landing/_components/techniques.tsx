"use client";

import {
  motion,
  type TargetAndTransition,
  useInView,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Reveal } from "./reveal";
import {
  AiReviewMock,
  ExamMock,
  FlashcardMock,
  RecallMock,
} from "./technique-mocks";

type Technique = {
  name: string;
  benefit: string;
  // Swatch, kicker and the colour face a card shows while it waits behind.
  swatch: string;
  face: string;
  Mock: () => ReactNode;
};

const TECHNIQUES: readonly Technique[] = [
  {
    name: "Flashcards",
    benefit:
      "Una pregunta de un lado, la respuesta del otro. Repasas justo las tarjetas que más te cuestan.",
    swatch: "bg-(--lp-yellow)",
    face: "bg-(--lp-yellow)",
    Mock: FlashcardMock,
  },
  {
    name: "Recuperación activa",
    benefit:
      "Explicas una idea con tus palabras, sin mirar el apunte. Así sabes qué entendiste de verdad.",
    swatch: "bg-(--lp-mint)",
    face: "bg-(--lp-mint)",
    Mock: RecallMock,
  },
  {
    name: "Exámenes",
    benefit:
      "Preguntas de opción múltiple sobre tus páginas, para comprobar lo que dominas antes de la prueba.",
    swatch: "bg-(--lp-rose)",
    face: "bg-(--lp-rose)",
    Mock: ExamMock,
  },
  {
    name: "La IA prepara, tú decides",
    benefit:
      "Cogni prepara el material desde tu apunte. Tú lo revisas, lo editas y decides qué se queda.",
    swatch: "bg-(--lp-violet-400)",
    face: "bg-(--lp-violet-400)",
    Mock: AiReviewMock,
  },
];

const COUNT = TECHNIQUES.length;
const AUTOPLAY_MS = 5000;
const SPRING = { type: "spring", visualDuration: 0.45, bounce: 0.15 } as const;
const EXIT = { duration: 0.7, ease: [0.22, 1, 0.36, 1] } as const;
const OUT_LEFT =
  "translateX(-110%) translateY(0px) scale(1) rotate(-8deg)" as const;

// Card-stack recipe (Motion UI defaults): each step back drops 16px,
// shrinks 5% and fans 4°; cards more than two steps back are hidden.
function place(depth: number) {
  return {
    transform: `translateX(0%) translateY(${depth * 16}px) scale(${1 - 0.05 * depth}) rotate(${depth * 4}deg)`,
    opacity: depth > 2 ? 0 : 1,
    zIndex: 10 - depth,
  };
}

type Move = { from: number; to: number; dir: 1 | -1 };

// The leaving front card (forward) or the arriving one (backward) swings
// out to the left before settling; every other card just springs to its
// new slot. zIndex flips halfway so the swinging card passes over or under
// the stack at the right moment.
function target(index: number, move: Move): TargetAndTransition {
  const depth = (index - move.to + COUNT) % COUNT;
  const end = place(depth);
  if (move.from === move.to) return { ...end, transition: SPRING };

  if (move.dir === 1 && index === move.from) {
    const start = place(0);
    return {
      transform: [start.transform, OUT_LEFT, end.transform],
      opacity: [1, 1, end.opacity],
      zIndex: [20, 20, end.zIndex, end.zIndex],
      transition: {
        transform: { ...EXIT, times: [0, 0.45, 1] },
        opacity: { ...EXIT, times: [0, 0.45, 1] },
        zIndex: { duration: EXIT.duration, times: [0, 0.45, 0.46, 1] },
      },
    };
  }
  if (move.dir === -1 && index === move.to) {
    const start = place((index - move.from + COUNT) % COUNT);
    return {
      transform: [start.transform, OUT_LEFT, end.transform],
      opacity: [start.opacity, 1, 1],
      zIndex: [start.zIndex, start.zIndex, 20, 20],
      transition: {
        transform: { ...EXIT, times: [0, 0.45, 1] },
        opacity: { ...EXIT, times: [0, 0.45, 1] },
        zIndex: { duration: EXIT.duration, times: [0, 0.45, 0.46, 1] },
      },
    };
  }
  return { ...end, transition: SPRING };
}

// "Una técnica para cada momento": tabs over a fanned deck. Changing tab
// brings that card to the front; the deck also advances on its own while
// the section is on screen, unless the visitor is pointing at it, has
// focus inside it, or prefers reduced motion.
export function Techniques() {
  const baseId = useId();
  const section = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [move, setMove] = useState<Move>({ from: 0, to: 0, dir: 1 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const inView = useInView(section, { amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const active = move.to;

  const go = (to: number, dir: 1 | -1) => {
    setMove((current) =>
      current.to === to ? current : { from: current.to, to, dir },
    );
  };

  const autoplay = inView && !hovered && !focused && !reduceMotion;
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(
      () => setMove({ from: active, to: (active + 1) % COUNT, dir: 1 }),
      AUTOPLAY_MS,
    );
    return () => clearTimeout(timer);
  }, [autoplay, active]);

  // Focus anywhere in the section (tabs or the front card) pauses autoplay.
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null)) {
        setFocused(false);
      }
    };
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("focusout", onFocusOut);
    return () => {
      node.removeEventListener("focusin", onFocusIn);
      node.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const select = (to: number, dir: 1 | -1) => {
    go(to, dir);
    tabRefs.current[to]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => select((active + 1) % COUNT, 1),
      ArrowLeft: () => select((active - 1 + COUNT) % COUNT, -1),
      Home: () => select(0, -1),
      End: () => select(COUNT - 1, 1),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = (index: number) => `${baseId}-panel-${index}`;

  return (
    <section
      ref={section}
      id="tecnicas"
      aria-labelledby="tecnicas-title"
      className="scroll-mt-20 overflow-x-clip bg-(--lp-ground-deep) px-4 py-24 md:px-10 xl:px-20 xl:py-[120px]"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12">
        <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-3.5">
            <p className="font-extrabold text-(--lp-violet-300) text-[13px] uppercase tracking-[0.15em]">
              Las técnicas
            </p>
            <h2
              id="tecnicas-title"
              className="font-(family-name:--lp-font-display) text-(--lp-paper) text-[clamp(44px,5vw,68px)] leading-[1.05] tracking-[-0.02em]"
            >
              Una técnica para cada{" "}
              <em className="text-(--lp-yellow)">momento.</em>
            </h2>
          </div>
          <p className="max-w-[340px] text-(--lp-on-dark-side) text-base leading-relaxed">
            Todas salen de tus propias páginas y comparten un mismo plan de
            repaso.
          </p>
        </Reveal>

        <div
          className="flex flex-col items-center gap-10 md:gap-14"
          data-testid="technique-deck"
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <div className="lp-scroll-x -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4">
            <div
              role="tablist"
              aria-label="Técnicas de estudio"
              onKeyDown={onKeyDown}
              className="flex w-max gap-1 rounded-full border border-white/12 bg-white/6 p-1.5"
            >
              {TECHNIQUES.map((technique, index) => {
                const selected = index === active;
                return (
                  <button
                    key={technique.name}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={tabId(index)}
                    aria-selected={selected}
                    aria-controls={panelId(index)}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => go(index, index > active ? 1 : -1)}
                    className={`relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-full px-5 py-3 font-bold text-[15px] transition-colors duration-200 ${
                      selected
                        ? "text-(--lp-ink)"
                        : "text-(--lp-on-dark-tab) hover:text-(--lp-paper)"
                    }`}
                  >
                    {selected ? (
                      <motion.span
                        layoutId={`${baseId}-pill`}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-(--lp-paper)"
                        transition={{
                          type: "spring",
                          visualDuration: 0.35,
                          bounce: 0.15,
                        }}
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={`relative size-2.5 rounded-full ${technique.swatch}`}
                    />
                    <span className="relative">{technique.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid w-full max-w-[860px] pb-12 md:pb-16">
            {TECHNIQUES.map((technique, index) => {
              const front = index === active;
              const { Mock } = technique;
              return (
                <motion.div
                  key={technique.name}
                  role="tabpanel"
                  id={panelId(index)}
                  aria-labelledby={tabId(index)}
                  data-part="technique-card"
                  inert={!front}
                  tabIndex={front ? 0 : -1}
                  initial={false}
                  animate={target(index, move)}
                  style={{ transformOrigin: "50% 100%" }}
                  className="lp-shadow-deck relative col-start-1 row-start-1 overflow-hidden rounded-[28px] bg-(--lp-paper)"
                >
                  <div className="flex flex-col gap-8 p-7 md:flex-row md:items-center md:justify-between md:gap-10 md:p-11">
                    <div className="flex max-w-[320px] flex-col gap-5">
                      <span
                        aria-hidden="true"
                        className={`w-fit rounded-full px-3.5 py-1.5 font-extrabold text-(--lp-ink) text-[12px] uppercase tracking-[0.12em] ${technique.face}`}
                      >
                        {technique.name}
                      </span>
                      <h3 className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[clamp(40px,4.5vw,56px)] leading-none tracking-[-0.02em]">
                        {technique.name}
                      </h3>
                      <p className="text-(--lp-editor-text) text-[17px] leading-[1.55]">
                        {technique.benefit}
                      </p>
                    </div>
                    <div aria-hidden="true" className="flex md:justify-end">
                      <Mock />
                    </div>
                  </div>
                  {/* Solid colour face shown while the card waits behind. */}
                  <motion.div
                    aria-hidden="true"
                    initial={false}
                    animate={{ opacity: front ? 0 : 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`pointer-events-none absolute inset-0 ${technique.face}`}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
