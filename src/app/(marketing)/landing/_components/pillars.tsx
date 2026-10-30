import { CalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockClockwise } from "@phosphor-icons/react/dist/ssr/ClockClockwise";
import { FileArrowUp } from "@phosphor-icons/react/dist/ssr/FileArrowUp";
import { Fire } from "@phosphor-icons/react/dist/ssr/Fire";
import { Gauge } from "@phosphor-icons/react/dist/ssr/Gauge";
import { GlobeHemisphereWest } from "@phosphor-icons/react/dist/ssr/GlobeHemisphereWest";
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { Notebook } from "@phosphor-icons/react/dist/ssr/Notebook";
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr/PencilSimpleLine";
import { StackSimple } from "@phosphor-icons/react/dist/ssr/StackSimple";
import { TrendDown } from "@phosphor-icons/react/dist/ssr/TrendDown";
import type { ReactNode } from "react";
import { type BandTone, PillarBand } from "./pillar-band";
import {
  type IconTone,
  PillarBlock,
  type PillarPoint,
  PillarVisual,
} from "./pillar-block";
import { CurveDemo, ImportDemo, ProgressDemo, TodayDemo } from "./pillar-demos";
import { PixelTileDefs } from "./pixel-tile";

type Pillar = {
  id: string;
  number: string;
  eyebrow: string;
  statement: string;
  // The italic half of the band statement.
  emphasis: string;
  tone: BandTone;
  heading: string;
  points: readonly PillarPoint[];
  // The pillar's hue for its point tiles.
  iconTone: IconTone;
  visual: ReactNode;
};

const INK_BAND = {
  text: "text-(--lp-ink)",
  emphasis: "text-(--lp-ink)",
} as const;

// Approved v2 copy (docs/landing/propuesta-contenido.md §9). Review
// intervals follow the engine (sm2.ts): 1 day, 6 days, then round(I·EF).
export const PILLARS: readonly Pillar[] = [
  {
    id: "pilar-apuntes",
    number: "01",
    eyebrow: "Pilar 01 · Tus apuntes",
    statement: "Todo en un",
    emphasis: "solo lugar.",
    tone: {
      ...INK_BAND,
      ground: "bg-(--lp-yellow)",
      eyebrow: "text-(--lp-ink)",
      number: "text-(--lp-ink)",
    },
    heading: "Tus apuntes viven en cuadernos, como en clase.",
    points: [
      {
        icon: FileArrowUp,
        title: "Importa lo que ya tienes",
        text: "PDF, Word y PowerPoint se convierten en páginas que puedes editar.",
      },
      {
        icon: PencilSimpleLine,
        title: "Un editor de bloques",
        text: "Escribe / para insertar títulos, listas, tablas o código, sin pensar en el formato.",
      },
      {
        icon: Notebook,
        title: "Un cuaderno por materia",
        text: "Y una página por tema. Así encuentras todo donde lo dejaste.",
      },
    ],
    iconTone: "yellow",
    visual: <ImportDemo />,
  },
  {
    id: "pilar-repeticion",
    number: "02",
    eyebrow: "Pilar 02 · Repetición espaciada",
    statement: "Lo que repasas a tiempo,",
    emphasis: "se queda.",
    tone: {
      ground: "bg-(--lp-violet)",
      eyebrow: "text-(--lp-yellow)",
      text: "text-(--lp-paper)",
      emphasis: "text-(--lp-yellow)",
      number: "text-(--lp-yellow)",
    },
    heading: "La curva del olvido, puesta de tu lado.",
    points: [
      {
        icon: TrendDown,
        title: "Sin repasar, la memoria cae",
        text: "Lo nuevo se olvida sobre todo en los primeros días si no vuelves a verlo.",
      },
      {
        icon: ClockClockwise,
        title: "Cada acierto aleja el repaso",
        text: "Si respondes bien, vuelve mañana, en 6 días y en unas dos semanas. Si te cuesta, vuelve pronto.",
      },
      {
        icon: StackSimple,
        title: "Un solo motor para todo",
        text: "Flashcards, recuperación activa y exámenes usan la misma repetición espaciada, y Cogni junta sus repasos en un solo plan.",
      },
    ],
    iconTone: "violet",
    visual: <CurveDemo />,
  },
  {
    id: "pilar-hoy",
    number: "03",
    eyebrow: "Pilar 03 · Cronograma y vista Hoy",
    statement: "Abre Cogni y sabes",
    emphasis: "qué toca hoy.",
    tone: {
      ...INK_BAND,
      ground: "bg-(--lp-mint)",
      eyebrow: "text-(--lp-mint-800)",
      number: "text-(--lp-mint-800)",
    },
    heading: "Tu cronograma se arma solo.",
    points: [
      {
        icon: CalendarCheck,
        title: "Días de repaso, ya marcados",
        text: "Cada repaso ya tiene su día. Tú no creas ningún evento.",
      },
      {
        icon: ListChecks,
        title: "La vista Hoy",
        text: "Una sola lista con lo que vence, primero lo que más esperó.",
      },
      {
        icon: GlobeHemisphereWest,
        title: "Tu calendario, siempre al día",
        text: "En las vistas Semana y Mes ves cuándo vuelve cada página, así llegas a tiempo a cada repaso.",
      },
    ],
    iconTone: "mint",
    visual: <TodayDemo />,
  },
  {
    id: "pilar-progreso",
    number: "04",
    eyebrow: "Pilar 04 · Tu progreso",
    statement: "Mira crecer",
    emphasis: "lo que dominas.",
    // The rose band the study companion had as pillar 04 (user, 2026-10-28).
    tone: {
      ...INK_BAND,
      ground: "bg-(--lp-rose)",
      eyebrow: "text-(--lp-rose-950)",
      number: "text-(--lp-rose-950)",
    },
    heading: "Tu progreso, medido en lo que recuerdas.",
    points: [
      {
        icon: CheckCircle,
        title: "Repasos completados",
        text: "Mira cuántos repasos completaste esta semana y compáralo con la anterior.",
      },
      {
        icon: Fire,
        title: "Tu racha",
        text: "Son los días seguidos en que repasas al menos una vez. Verla crecer te ayuda a mantener el hábito.",
      },
      {
        icon: Gauge,
        title: "Dominio por página",
        text: "Mira cuánto has avanzado en cada página con tus repasos y cuáles ya están listas.",
      },
    ],
    iconTone: "rose",
    visual: <ProgressDemo />,
  },
];

// Pillars 01–04: a colour band with one short statement, then the feature
// block. Visuals alternate sides, starting on the right. The study
// companion, once pillar 04, now closes the Técnicas scroll.
export function Pillars() {
  return (
    <div id="pilares" className="lp-on-paper scroll-mt-16 bg-(--lp-paper)">
      <PixelTileDefs />
      {PILLARS.map((pillar, index) => (
        <section
          key={pillar.id}
          id={pillar.id}
          aria-labelledby={`${pillar.id}-title`}
          className="scroll-mt-16"
        >
          <PillarBand
            number={pillar.number}
            eyebrow={pillar.eyebrow}
            titleId={`${pillar.id}-title`}
            tone={pillar.tone}
          >
            {pillar.statement}{" "}
            <em className={pillar.tone.emphasis}>{pillar.emphasis}</em>
          </PillarBand>
          <PillarBlock
            heading={pillar.heading}
            points={pillar.points}
            iconTone={pillar.iconTone}
            visualSide={index % 2 === 0 ? "right" : "left"}
            visual={<PillarVisual>{pillar.visual}</PillarVisual>}
          />
        </section>
      ))}
    </div>
  );
}
