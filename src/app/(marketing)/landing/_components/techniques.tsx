"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Check, CornerDownRight } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { AsciiTexture } from "./ascii-texture";
import { type HeadlineImage, HeadlineObject } from "./headline-object";
import { Reveal } from "./reveal";
import { TechniqueArt, type TechniqueKey } from "./technique-art";
import { activeTechnique, trackShift } from "./techniques-scroll";

type Tone = "yellow" | "mint" | "red" | "violet";

type Technique = {
  key: TechniqueKey;
  name: string;
  benefit: string;
  // Short points taken from the copy and the example screens, no new claims.
  points: { title?: string; text: string }[];
  // A line that ties the panel to the ones before it.
  lead?: string;
  // Platform technique colour: flashcards yellow, recall mint, exams red,
  // the AI review violet.
  tone: Tone;
};

// Approved v2 copy (docs/landing/propuesta-contenido.md §9). Each idea has
// one home on the page: "only from your page" lives in the FAQ, spaced
// repetition in pillar 02, the session summary in the companion.
export const TECHNIQUES: readonly Technique[] = [
  {
    key: "flashcards",
    name: "Flashcards",
    benefit:
      "Las tarjetas ya vienen hechas desde tu apunte. Tú solo las respondes.",
    points: [
      { text: "De 3 a 20 tarjetas por generación." },
      { text: "Calificas con Otra vez, Difícil, Bien o Fácil." },
      {
        text: "Puedes sumar las tuyas a mano o archivar las que no te sirvan.",
      },
    ],
    tone: "yellow",
  },
  {
    key: "recall",
    name: "Recuperación activa",
    benefit:
      "Explicas una idea con tus palabras y ves qué conceptos clave incluiste y cuáles conviene sumar.",
    points: [
      { text: "Cada pregunta trae una rúbrica con los conceptos clave." },
      {
        text: "Tu autoevaluación y la de la IA se combinan: ninguna nota manda sola.",
      },
      {
        text: "Si te sentiste más seguro de lo que mostraste, Cogni te lo señala.",
      },
    ],
    tone: "mint",
  },
  {
    key: "exams",
    name: "Exámenes",
    benefit:
      "Un examen que nunca se repite igual: lo que fallaste vuelve con otra redacción, para que practiques la idea y no la pregunta.",
    points: [
      { text: "De 10 a 30 preguntas de opción múltiple." },
      { text: "Con menos de 70 %, la página queda para repetir." },
      {
        text: "Antes de repetir, «Repasar contenido» te lleva a los conceptos que conviene reforzar.",
      },
    ],
    tone: "red",
  },
  {
    // Moved here from the former pillar 04: after any technique, the
    // companion closes the session. Violet, Cogni's own colour: it is Cogni
    // speaking about every technique at once, so it takes none of theirs.
    key: "companion",
    name: "Tu acompañante de estudio",
    lead: "Cada sesión cierra con un siguiente paso.",
    benefit:
      "Al terminar un mazo o un examen, sabes en qué vas bien y qué reforzar.",
    points: [
      {
        title: "Primero, tus fortalezas",
        text: "Lo que ya dominas, dicho con claridad.",
      },
      {
        title: "Luego, oportunidades de mejora",
        text: "Qué repasar y en qué parte de tu página, sin juicios ni etiquetas.",
      },
      {
        title: "En el examen, cada concepto explicado",
        text: "Lo que conviene reforzar, explicado con el texto de tu página.",
      },
    ],
    tone: "violet",
  },
];

const COUNT = TECHNIQUES.length;
// Width of the intro frame, in frames: narrower than the screen so the
// first technique already shows beside the headline. Mirrors --lp-hintro
// in landing.css, which sizes the rail and its frames.
const INTRO = 0.66;

const step = (index: number) => String(index + 1).padStart(2, "0");

// "Una técnica para cada momento", a lilac zone after the cream paper and
// the page's one horizontal scene. On desktop the section pins a
// full-screen frame for about 70vh of scroll per frame travelled; scrolling
// slides the rail to the left, linearly (translateX only, one motion
// value): a compact intro with the first technique already peeking in,
// then one full panel per technique with its illustration and its
// explanation on alternating sides. Native vertical scroll drives it, so
// nothing is hijacked: the keyboard and wheel scroll as always, and the
// frame clips (overflow: clip) so focus or a screen reader can never shift
// the track sideways. On phones and under reduced motion there is no pin:
// the frames stack and read top to bottom (landing.css).
//
// "momento" is the italic keyword: it is where the sentence lands and the
// promise of the whole section (the right technique at the right time),
// the same closing role "repaso" plays in "Así funciona".
export function Techniques({
  image,
  art = {},
}: {
  image?: HeadlineImage;
  art?: Partial<Record<TechniqueKey, HeadlineImage>>;
}) {
  const baseId = useId();
  const track = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, (value) =>
    trackShift(value, INTRO, COUNT),
  );
  // React only hears about the nearest technique changing, never a frame.
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, "change", (value) =>
    setActive(activeTechnique(value, INTRO, COUNT)),
  );

  return (
    <>
      <section
        ref={track}
        id="tecnicas"
        aria-labelledby="tecnicas-title"
        data-nav-theme="light"
        className="lp-tech lp-htrack lp-on-paper relative text-(--lp-ink)"
      >
        <div className="lp-hframe">
          <div aria-hidden="true" className="lp-hfield">
            <AsciiTexture
              variant="field"
              seed={17}
              className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
            />
          </div>

          <motion.div className="lp-hrail" style={{ x }}>
            <div className="lp-hpanel lp-hintro flex items-center px-5 pt-16 pb-6 md:pt-20 md:pr-0 md:pb-16 md:pl-[5vw]">
              <div className="w-full">
                <Reveal>
                  <p className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-deep) text-[16px] uppercase tracking-[0.14em] md:text-[20px]">
                    <span
                      aria-hidden="true"
                      className="size-2 bg-(--lp-violet) md:size-2.5"
                    />
                    Las técnicas
                  </p>
                </Reveal>
                <Reveal delay={0.08}>
                  <h2
                    id="tecnicas-title"
                    className="lp-headline mt-6 text-(--lp-ink) md:mt-8"
                  >
                    Una{" "}
                    <span className="whitespace-nowrap">
                      técnica{" "}
                      <HeadlineObject image={image} glyph="cards" tone="mint" />
                    </span>{" "}
                    para <br className="hidden md:inline" />
                    cada <em className="lp-headline-accent">momento</em>.
                  </h2>
                </Reveal>
                <Reveal
                  delay={0.14}
                  className="mt-6 flex flex-col gap-8 md:mt-10 md:flex-row md:items-end md:justify-between"
                >
                  <div className="flex max-w-[40ch] flex-col items-start gap-4">
                    <p className="text-(--lp-ink-2) text-[18px] leading-[1.55] md:text-[20px]">
                      Reconocer, recordar y explicar: tres formas de ponerte a
                      prueba, de menos a más exigente.
                    </p>
                    <Link
                      href="/ciencia"
                      className="lp-link inline-flex items-center gap-2 rounded-md font-(family-name:--lp-font-head) font-medium text-(--lp-violet-deep) text-[16px] md:text-[17px]"
                    >
                      La ciencia detrás de cada técnica
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                  <span
                    aria-hidden="true"
                    className="lp-hcue hidden size-14 items-center justify-center rounded-full md:flex"
                  >
                    <ArrowRight className="size-5" />
                  </span>
                </Reveal>
              </div>
            </div>

            {TECHNIQUES.map((technique, index) => {
              const headingId = `${baseId}-technique-${index}`;
              const visual = index % 2 === 0 ? "left" : "right";
              return (
                <section
                  key={technique.key}
                  aria-labelledby={headingId}
                  data-tone={technique.tone}
                  data-visual={visual}
                  className="lp-hpanel flex items-center px-5 py-10 md:px-[4vw] md:pt-20 md:pb-16"
                >
                  <div
                    className={`grid w-full items-center gap-8 md:gap-[5vw] ${
                      visual === "right"
                        ? "md:grid-cols-[1fr_1.15fr]"
                        : "md:grid-cols-[1.15fr_1fr]"
                    }`}
                  >
                    <div
                      className={`mx-auto w-full max-w-[min(680px,70vh)] ${
                        visual === "right" ? "md:order-2" : ""
                      }`}
                    >
                      <TechniqueArt
                        technique={technique.key}
                        image={art[technique.key]}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="lp-tech-step flex items-center gap-2.5 font-(family-name:--lp-font-mono) text-[13px] tracking-[0.1em]">
                        <span aria-hidden="true" className="lp-tech-dot" />
                        {step(index)} / {step(COUNT - 1)}
                      </span>
                      {technique.lead ? (
                        <p className="lp-tech-lead mt-5 flex items-center gap-2 font-medium text-[15px] md:text-[17px]">
                          <CornerDownRight
                            aria-hidden="true"
                            className="size-4 shrink-0"
                          />
                          {technique.lead}
                        </p>
                      ) : null}
                      <h3
                        id={headingId}
                        className={`${technique.lead ? "mt-3" : "mt-5"} font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[clamp(40px,5vw,76px)] leading-[0.98] tracking-[-0.035em] text-balance`}
                      >
                        {technique.name}
                      </h3>
                      <p className="mt-5 max-w-[40ch] text-(--lp-ink-2) text-[18px] leading-[1.55] md:text-[21px]">
                        {technique.benefit}
                      </p>
                      <ul className="mt-7 flex max-w-[46ch] flex-col">
                        {technique.points.map((point) => (
                          <li
                            key={point.text}
                            className="lp-tech-point flex items-start gap-3 py-3.5 text-(--lp-ink) text-[16px] leading-[1.45] md:text-[17px]"
                          >
                            <span
                              aria-hidden="true"
                              className="lp-tech-check mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                            >
                              <Check strokeWidth={2.5} className="size-3" />
                            </span>
                            {point.title ? (
                              <span className="flex flex-col gap-0.5">
                                <span className="font-semibold">
                                  {point.title}
                                </span>
                                <span className="text-(--lp-ink-2) text-[15px] md:text-[16px]">
                                  {point.text}
                                </span>
                              </span>
                            ) : (
                              point.text
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              );
            })}
          </motion.div>

          <div
            aria-hidden="true"
            data-part="tech-progress"
            className="lp-hprogress"
          >
            {TECHNIQUES.map((technique, index) => (
              <span
                key={technique.key}
                data-tone={technique.tone}
                data-active={index === active ? "" : undefined}
                className="lp-hprogress-step"
              >
                <span
                  data-step
                  className="font-(family-name:--lp-font-mono) text-[12px] tracking-[0.08em]"
                >
                  {step(index)}
                </span>
                <span className="lp-hprogress-line" />
              </span>
            ))}
          </div>
        </div>
      </section>
      <div aria-hidden="true" data-nav-theme="light" className="lp-tech-out" />
    </>
  );
}
