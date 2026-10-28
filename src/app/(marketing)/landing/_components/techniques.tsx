"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Check } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
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
  points: string[];
  // Platform technique colour: flashcards yellow, recall mint, exams red,
  // the AI review violet.
  tone: Tone;
};

export const TECHNIQUES: readonly Technique[] = [
  {
    key: "flashcards",
    name: "Flashcards",
    benefit:
      "Una pregunta de un lado, la respuesta del otro. Repasas justo las tarjetas que más te cuestan.",
    points: [
      "Pregunta en el anverso, respuesta en el reverso.",
      "Calificas cada tarjeta: No la sé, Difícil, Bien o Fácil.",
      "Tu respuesta decide cuándo vuelve la tarjeta.",
    ],
    tone: "yellow",
  },
  {
    key: "recall",
    name: "Recuperación activa",
    benefit:
      "Explicas una idea con tus palabras, sin mirar el apunte. Así sabes qué entendiste de verdad.",
    points: [
      "Una pregunta abierta sobre el concepto clave.",
      "Respondes con tus palabras, sin mirar tu apunte.",
      "La envías cuando terminas de explicarla.",
    ],
    tone: "mint",
  },
  {
    key: "exams",
    name: "Exámenes",
    benefit:
      "Preguntas de opción múltiple sobre tus páginas, para comprobar lo que dominas antes de la prueba.",
    points: [
      "Opción múltiple sobre tus propias páginas.",
      "Avanzas pregunta a pregunta, con tu progreso a la vista.",
    ],
    tone: "red",
  },
  {
    key: "ai",
    name: "La IA prepara, tú decides",
    benefit:
      "Cogni prepara el material desde tu apunte. Tú lo revisas, lo editas y decides qué se queda.",
    points: [
      "La IA deja un borrador listo desde tu apunte.",
      "Editas lo que quieras cambiar.",
      "Apruebas lo que se queda.",
    ],
    tone: "violet",
  },
];

const COUNT = TECHNIQUES.length;
// The intro frame plus one frame per technique (.lp-hrail is 500% wide).
const PANELS = COUNT + 1;

const step = (index: number) => String(index + 1).padStart(2, "0");

// "Una técnica para cada momento", a lilac zone after the cream paper and
// the page's one horizontal scene. On desktop the section is five screens
// tall and pins a full-screen frame; scrolling down slides a track of five
// frames to the left, linearly (translateX only, one motion value): the
// intro, then one central panel per technique with its illustration and its
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
  const x = useTransform(scrollYProgress, (value) => trackShift(value, PANELS));
  // React only hears about the nearest technique changing, never a frame.
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, "change", (value) =>
    setActive(activeTechnique(value, COUNT)),
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
            <div className="lp-hpanel flex items-center px-5 pt-28 pb-16 md:px-10 md:pb-24 xl:px-20">
              <div className="mx-auto w-full max-w-[1280px]">
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
                  className="mt-8 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between"
                >
                  <p className="max-w-[34ch] text-(--lp-ink-2) text-[18px] leading-[1.55] md:text-[20px]">
                    Todas salen de tus propias páginas y comparten un mismo plan
                    de repaso.
                  </p>
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
                  className="lp-hpanel flex items-center px-5 py-16 md:px-10 md:pt-28 md:pb-24 xl:px-20"
                >
                  <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 md:grid-cols-2 md:gap-16 xl:gap-24">
                    <div
                      className={`mx-auto w-full max-w-[min(560px,62vh)] ${
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
                      <h3
                        id={headingId}
                        className="mt-5 font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[clamp(40px,4.6vw,68px)] leading-[0.98] tracking-[-0.035em] text-balance"
                      >
                        {technique.name}
                      </h3>
                      <p className="mt-6 max-w-[36ch] text-(--lp-ink-2) text-[18px] leading-[1.55] md:text-[20px]">
                        {technique.benefit}
                      </p>
                      <ul className="mt-8 flex max-w-[44ch] flex-col">
                        {technique.points.map((point) => (
                          <li
                            key={point}
                            className="lp-tech-point flex items-start gap-3 py-3.5 text-(--lp-ink) text-[16px] leading-[1.45] md:text-[17px]"
                          >
                            <span
                              aria-hidden="true"
                              className="lp-tech-check mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                            >
                              <Check strokeWidth={2.5} className="size-3" />
                            </span>
                            {point}
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
