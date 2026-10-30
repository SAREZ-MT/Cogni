"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { AsciiTexture } from "./ascii-texture";
import { Reveal } from "./reveal";

// Approved v2 copy (docs/landing/propuesta-contenido.md §9): five questions,
// only what the sections above do not already explain.
export const FAQ_ITEMS = [
  {
    question: "¿La IA se inventa cosas?",
    answer:
      "Tiene instrucciones de usar solo el texto de tu página y evalúa solo contra la rúbrica y tu apunte. Si un proveedor falla, Cogni te lo dice en vez de inventar un resultado. Y si algo no te convence, puedes editar o retirar preguntas de examen o marcar «No estoy de acuerdo» en una evaluación.",
  },
  {
    question: "¿Puedo importar cualquier archivo?",
    answer:
      "PDF, Word y PowerPoint de hasta 20 MB, sí. No se importan PDF escaneados, porque Cogni no hace OCR, ni los formatos antiguos .doc y .ppt. Siempre puedes escribir directo en el editor.",
  },
  {
    // TODO(legal): pending legal review; the final wording follows the
    // privacy policy (propuesta-contenido.md §8.1, "FAQ: privacidad").
    question: "¿Qué pasa con mis apuntes?",
    answer:
      "Tus cuadernos son solo tuyos. Para generar y evaluar, el texto pasa por proveedores de IA en su nivel gratuito, que pueden usarlo para mejorar sus servicios; por eso te pedimos no incluir datos sensibles. Puedes pedir que eliminemos tu cuenta y tus datos.",
  },
  {
    question: "¿Funciona en el celular?",
    answer:
      "Funciona en el navegador web, también en el del celular, pero está pensado sobre todo para usarlo en la computadora. No hay app nativa para celular.",
  },
  {
    question: "¿Por qué no muestran cuánto tiempo estudié?",
    answer:
      "Porque más horas no es lo mismo que recordar más. Cogni cuenta repasos completados y tu dominio por página.",
  },
] as const;

// "Preguntas frecuentes" on the lilac ground: the headline holds the left
// column over a faint field of letters, the questions are a disclosure
// accordion on the right (one button per question, aria-expanded and
// aria-controls). The first answer starts open. Answers open through a
// grid-row transition, held instant under reduced motion in landing.css.
// "frecuentes" is the italic keyword, on its own line as in the frame.
export function Faq() {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));

  const toggle = (index: number) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-title"
      data-nav-theme="light"
      className="lp-faq lp-on-paper relative scroll-mt-16 px-5 pt-20 pb-20 md:px-10 md:pt-[110px] md:pb-[110px] xl:px-20"
    >
      <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[440fr_760fr] lg:gap-[80px]">
        <div className="relative">
          <div aria-hidden="true" className="lp-faq-field">
            <AsciiTexture
              variant="field"
              seed={23}
              className="absolute inset-0 size-full font-(family-name:--lp-font-mono)"
            />
          </div>
          <div className="relative lg:sticky lg:top-28">
            <Reveal>
              <p className="flex items-center gap-3 font-(family-name:--lp-font-mono) text-(--lp-violet-deep) text-[16px] uppercase tracking-[0.14em] md:text-[20px]">
                <span
                  aria-hidden="true"
                  className="size-2 bg-(--lp-violet) md:size-2.5"
                />
                Preguntas
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2
                id="preguntas-title"
                className="lp-headline lp-headline-compact mt-6 text-(--lp-ink) md:mt-8"
              >
                Preguntas <br />
                <em className="lp-headline-accent">frecuentes</em>.
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-6 max-w-[34ch] text-(--lp-ink-2) text-[18px] leading-[1.55]">
                Lo que suelen preguntar antes de empezar.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.1}>
          <ul className="flex flex-col">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = open.has(index);
              const buttonId = `${baseId}-q-${index}`;
              const panelId = `${baseId}-a-${index}`;
              return (
                <li key={item.question} className="lp-faq-item">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(index)}
                      className="lp-faq-button flex w-full items-center justify-between gap-6 rounded-lg py-6 text-left"
                    >
                      <span className="font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[19px] leading-[1.3] tracking-[-0.015em] md:text-[21px]">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className="lp-faq-icon flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-(--lp-violet-deep)"
                      >
                        <Plus strokeWidth={2.25} className="size-4" />
                      </span>
                    </button>
                  </h3>
                  <section
                    id={panelId}
                    aria-labelledby={buttonId}
                    data-open={isOpen ? "" : undefined}
                    inert={!isOpen}
                    className="lp-faq-panel"
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[68ch] pb-6 pr-10 text-(--lp-ink-3) text-[16px] leading-[1.6]">
                        {item.answer}
                      </p>
                    </div>
                  </section>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
