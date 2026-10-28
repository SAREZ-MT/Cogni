import {
  CalendarCheck,
  CalendarClock,
  Flame,
  Gauge,
  Globe,
  Layers,
  ListChecks,
  ListTodo,
  NotebookTabs,
  SquarePen,
  TrendingDown,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { type BandTone, PillarBand } from "./pillar-band";
import { PillarBlock, type PillarPoint, PillarVisual } from "./pillar-block";
import { CurveDemo, ImportDemo, ProgressDemo, TodayDemo } from "./pillar-demos";

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
  iconTone: string;
  visual: ReactNode;
};

const INK_BAND = {
  text: "text-(--lp-ink)",
  emphasis: "text-(--lp-ink)",
} as const;

const PILLARS: readonly Pillar[] = [
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
        icon: Upload,
        title: "Importa lo que ya tienes",
        text: "PDF, Word y PowerPoint se convierten en páginas que puedes editar.",
      },
      {
        icon: SquarePen,
        title: "Un editor tipo Notion",
        text: "Escribe con / para insertar bloques, resalta y arrastra sin pensar en el formato.",
      },
      {
        icon: NotebookTabs,
        title: "Un cuaderno por materia",
        text: "Y una página por tema. Así encuentras todo donde lo dejaste.",
      },
    ],
    iconTone: "bg-(--lp-violet-100) text-(--lp-violet-deep)",
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
        icon: TrendingDown,
        title: "Sin repasar, la memoria cae",
        text: "Más de la mitad de lo nuevo se pierde en pocos días si no vuelves a verlo.",
      },
      {
        icon: CalendarClock,
        title: "Repasas justo antes de olvidar",
        text: "Cogni programa cada repaso en +1, +3, +7 y +16 días, y ajusta según tus respuestas.",
      },
      {
        icon: Layers,
        title: "Un solo motor para todo",
        text: "Flashcards, recuperación activa y exámenes alimentan el mismo plan.",
      },
    ],
    iconTone: "bg-(--lp-violet-100) text-(--lp-violet-deep)",
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
        text: "Cada técnica cae en su día según la repetición espaciada.",
      },
      {
        icon: ListChecks,
        title: "La vista Hoy",
        text: "Una sola lista con lo que te toca. Ni más, ni menos.",
      },
      {
        icon: Globe,
        title: "En tu zona horaria",
        text: "Tu día empieza y termina cuando empieza y termina para ti.",
      },
    ],
    iconTone: "bg-(--lp-mint-100) text-(--lp-green-700)",
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
    heading: "Tu progreso, en tres números que importan.",
    points: [
      {
        icon: ListTodo,
        title: "Repasos completados",
        text: "Cuenta lo que hiciste, comparado con la semana pasada.",
      },
      {
        icon: Flame,
        title: "Tu racha",
        text: "Los días seguidos en que cumpliste tu vista Hoy.",
      },
      {
        icon: Gauge,
        title: "Dominio por técnica",
        text: "Cuánto dominas tus páginas en flashcards, recuperación activa y exámenes.",
      },
    ],
    iconTone: "bg-(--lp-rose-100) text-(--lp-rose-700)",
    visual: <ProgressDemo />,
  },
];

// Pillars 01–04: a colour band with one short statement, then the feature
// block. Visuals alternate sides, starting on the right. The study
// companion, once pillar 04, now closes the Técnicas scroll.
export function Pillars() {
  return (
    <div className="lp-on-paper bg-(--lp-paper)">
      {PILLARS.map((pillar, index) => (
        <section
          key={pillar.id}
          id={pillar.id}
          aria-labelledby={`${pillar.id}-title`}
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
