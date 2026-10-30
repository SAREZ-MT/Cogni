"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { FileText, Scale, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { type HeadlineImage, HeadlineObject } from "./headline-object";
import { Reveal } from "./reveal";

type Tone = "violet" | "yellow" | "mint" | "companion" | "rose";

type RouteStep = {
  title: string;
  text: string;
  // The mechanism behind the step, shown as a chip.
  mechanism: string;
  // The section that explains it in full: the step connects, never re-explains.
  ref: { href: string; label: string };
  tone: Tone;
};

// Approved v2 copy (docs/landing/propuesta-contenido.md §9, "Comparación
// honesta"). Each step names one mechanism and points back to its home.
export const PAINS = [
  "Releer y subrayar, y sentir que ya lo sabes.",
  "Estudiar todo la noche antes.",
  "Copiar tarjetas a mano, una por una.",
  "No saber qué repasar ni cuándo.",
] as const;

export const ROUTE: readonly RouteStep[] = [
  {
    title: "Importas tu apunte",
    text: "Queda en su cuaderno y su página, listo para estudiar.",
    mechanism: "PDF · Word · PowerPoint",
    ref: { href: "#pilar-apuntes", label: "Pilar 01" },
    tone: "violet",
  },
  {
    title: "Generas tus técnicas",
    text: "Flashcards, recuperación activa o examen, desde esa página.",
    mechanism: "Solo tu página",
    ref: { href: "#tecnicas", label: "Técnicas" },
    tone: "yellow",
  },
  {
    title: "Repasas lo que vence hoy",
    text: "Sin elegir qué ni cuándo: la lista ya está hecha.",
    mechanism: "SM-2 · Vista Hoy",
    ref: { href: "#pilar-repeticion", label: "Pilares 02 y 03" },
    tone: "mint",
  },
  {
    title: "Cierras con un siguiente paso",
    text: "Fortalezas y oportunidades de mejora al terminar.",
    mechanism: "Resumen de sesión",
    ref: { href: "#tecnicas", label: "Tu acompañante" },
    tone: "companion",
  },
  {
    title: "Llegas sabiendo qué dominas",
    text: "Ves qué páginas están listas antes del examen.",
    mechanism: "Dominio por página",
    ref: { href: "#pilar-progreso", label: "Pilar 04" },
    tone: "rose",
  },
];

// Generic file names for the scattered "usual way" pile, set at fixed
// spots and tilts (decorative).
const PILE = [
  { name: "apuntes_final_v3.pdf", spot: "left-[2%] top-[10%] -rotate-3" },
  { name: "clase (2).docx", spot: "left-[52%] top-0 rotate-2" },
  { name: "tema_nuevo.pptx", spot: "left-[9%] top-[38%] rotate-1" },
  { name: "resumen_copia.pdf", spot: "left-[49%] top-[32%] -rotate-2" },
  { name: "captura_pizarra.png", spot: "left-[4%] top-[72%] rotate-2" },
] as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// "Comparación honesta": two ways to reach the exam, side by side. The
// usual way is a pile (loose files, a sticky note) and four real pains;
// the Cogni way is one numbered route whose rail draws itself step by step
// as it enters, the section's one signature motion. Each step links back
// ("↑") to the section that explains it. "examen" is the italic keyword:
// it is the moment both roads lead to.
export function Comparison({ image }: { image?: HeadlineImage }) {
  return (
    <section
      id="comparacion"
      aria-labelledby="comparacion-title"
      data-nav-theme="light"
      className="lp-on-paper scroll-mt-16 bg-(--lp-paper) px-5 pt-20 pb-16 md:px-10 md:pt-[100px] md:pb-20 xl:px-20"
    >
      <div className="mx-auto max-w-[1280px]">
        <Reveal>
          <p className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-deep) text-[16px] uppercase tracking-[0.14em] md:text-[20px]">
            <span
              aria-hidden="true"
              className="size-2 bg-(--lp-violet) md:size-2.5"
            />
            Comparación honesta
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2
            id="comparacion-title"
            className="lp-headline mt-6 text-(--lp-ink) md:mt-8"
          >
            Dos formas de llegar al{" "}
            <span className="whitespace-nowrap">
              <HeadlineObject image={image} glyph="exam" tone="red" />{" "}
              <em className="lp-headline-accent">examen</em>.
            </span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[520fr_736fr]">
          <Reveal className="lp-way-usual flex flex-col rounded-[28px] p-6 md:p-10">
            <h3 className="font-(family-name:--lp-font-display) text-(--lp-ink-2) text-[36px] leading-[1.05] md:text-[44px]">
              El camino de siempre
            </h3>
            <p className="mt-4 text-(--lp-ink-3) text-[17px] leading-[1.5]">
              Archivos sueltos, resaltador y todo la noche antes.
            </p>
            <div
              aria-hidden="true"
              className="relative mt-8 min-h-[260px] w-full max-w-[440px] flex-1 md:min-h-[300px]"
            >
              {PILE.map((file) => (
                <span
                  key={file.name}
                  className={`lp-pile-file absolute flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 font-(family-name:--lp-font-mono) text-(--lp-ink-3) text-[12px] ${file.spot}`}
                >
                  <FileText className="size-3.5 text-(--lp-muted)" />
                  {file.name}
                </span>
              ))}
              <span className="lp-pile-note absolute right-0 bottom-[6%] w-[170px] rotate-3 p-4 font-(family-name:--lp-font-hand) text-[26px] leading-[1.05] md:w-[188px] md:text-[28px]">
                Releer todo la noche antes
              </span>
            </div>
            <ul className="flex flex-col gap-3 pt-10">
              {PAINS.map((pain) => (
                <li
                  key={pain}
                  className="flex items-start gap-2.5 text-(--lp-ink-2) text-[16px] leading-[1.45]"
                >
                  <X
                    aria-hidden="true"
                    strokeWidth={2.5}
                    className="mt-[3px] size-4 shrink-0 text-(--lp-rose-700)"
                  />
                  {pain}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            delay={0.1}
            className="lp-way-cogni rounded-[28px] bg-white p-6 md:p-10"
          >
            <h3 className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[36px] leading-[1.05] md:text-[44px]">
              El camino{" "}
              <em className="text-(--lp-violet) text-[1.09em]">Cogni</em>
            </h3>
            <p className="mt-2 text-(--lp-ink-3) text-[17px] leading-[1.5]">
              Un solo lugar y una ruta que se ordena sola.
            </p>
            <ol className="mt-8 flex flex-col">
              {ROUTE.map((step, index) => (
                <RouteItem
                  key={step.title}
                  step={step}
                  index={index}
                  last={index === ROUTE.length - 1}
                />
              ))}
            </ol>
          </Reveal>
        </div>

        <Reveal className="mt-8 flex flex-col gap-4 md:mt-10 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <p className="flex max-w-[78ch] items-start gap-3 text-(--lp-ink-2) text-[16px] leading-[1.55]">
            <Scale
              aria-hidden="true"
              className="mt-0.5 size-[18px] shrink-0 text-(--lp-violet-deep)"
            />
            Las apps de tarjetas y los asistentes de IA hacen muy bien su parte:
            unas programan repasos, otros explican tus documentos. Cogni une
            crear, repasar y saber cuándo.
          </p>
          <Link
            href="/ciencia"
            className="lp-link inline-flex shrink-0 items-center gap-2 rounded-md font-(family-name:--lp-font-head) font-medium text-(--lp-violet-deep) text-[16px]"
          >
            La ciencia detrás de Cogni
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function RouteItem({
  step,
  index,
  last,
}: {
  step: RouteStep;
  index: number;
  last: boolean;
}) {
  const delay = 0.15 + index * 0.12;
  return (
    <li data-tone={step.tone} className="lp-route-step flex gap-5">
      <div
        aria-hidden="true"
        className="flex w-10 shrink-0 flex-col items-center"
      >
        <motion.span
          className="lp-route-node flex size-10 items-center justify-center rounded-full font-(family-name:--lp-font-mono) text-[12px]"
          initial={{ opacity: 0, transform: "scale(0.9)" }}
          whileInView={{ opacity: 1, transform: "scale(1)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay }}
        >
          {String(index + 1).padStart(2, "0")}
        </motion.span>
        {last ? null : (
          <motion.span
            className="lp-route-line w-0.5 flex-1"
            initial={{ transform: "scaleY(0)" }}
            whileInView={{ transform: "scaleY(1)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.45, ease: EASE_OUT, delay: delay + 0.2 }}
          />
        )}
      </div>
      <div className={`min-w-0 pt-1.5 ${last ? "" : "pb-8"}`}>
        <h4 className="font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[19px] leading-[1.25] tracking-[-0.015em] md:text-[21px]">
          {step.title}
        </h4>
        <p className="mt-2 text-(--lp-ink-3) text-[16px] leading-[1.5]">
          {step.text}
        </p>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="lp-route-chip rounded-md px-2 py-1 font-(family-name:--lp-font-mono) text-[11px] uppercase tracking-[0.06em]">
            {step.mechanism}
          </span>
          <a
            href={step.ref.href}
            className="lp-link rounded-sm font-(family-name:--lp-font-mono) text-(--lp-muted) text-[11px] hover:text-(--lp-ink-2)"
          >
            <span aria-hidden="true">↑ </span>
            {step.ref.label}
          </a>
        </p>
      </div>
    </li>
  );
}
