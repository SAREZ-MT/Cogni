"use client";

import {
  CircleCheck,
  GraduationCap,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Reveal } from "../../landing/_components/reveal";

type Tone = "yellow" | "violet" | "mint" | "rose" | "companion" | "green";

// One APA 7 reference: `italic` is the part APA sets in italics (the
// journal and volume, or the book title); `before` and `after` surround it.
// No DOIs or URLs: only fields checked against the publisher or an index.
export type Reference = {
  readonly before: string;
  readonly italic: string;
  readonly after: string;
};

export const referenceText = (reference: Reference) =>
  `${reference.before}${reference.italic}${reference.after}`;

export type Concept = {
  id: string;
  name: string;
  // The research term, after the step number.
  term: string;
  idea: string;
  inCogni: string;
  references: readonly Reference[];
  tone: Tone;
  visual: ReactNode;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// A bar that fills from the left once it is on screen (transform only;
// under reduced motion Motion jumps to the filled state).
function Bar({ value, fill }: { value: number; fill: string }) {
  return (
    <span className="block h-3.5 overflow-hidden rounded-full bg-(--lp-soft)">
      <motion.span
        className={`block h-full origin-left rounded-full ${fill}`}
        style={{ width: `${value}%` }}
        initial={{ transform: "scaleX(0)" }}
        whileInView={{ transform: "scaleX(1)" }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 }}
      />
    </span>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="lp-shadow-card flex w-full max-w-[520px] flex-col gap-4 rounded-[20px] bg-white p-6 md:p-7"
    >
      {children}
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="font-(family-name:--lp-font-mono) text-(--lp-muted) text-[11px] uppercase tracking-[0.1em]">
      {children}
    </span>
  );
}

function Measure({
  label,
  value,
  fill,
  showValue = true,
}: {
  label: string;
  value: number;
  fill: string;
  showValue?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-end justify-between gap-4">
        <span className="font-semibold text-(--lp-ink) text-[14px]">
          {label}
        </span>
        {showValue ? (
          <span className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[30px] leading-none">
            {value} %
          </span>
        ) : null}
      </span>
      <Bar value={value} fill={fill} />
    </div>
  );
}

function TestingVisual() {
  return (
    <Card>
      <Kicker>Recuerdo una semana después</Kicker>
      <Measure
        label="Se pusieron a prueba 3 veces"
        value={61}
        fill="bg-(--lp-amber-500)"
      />
      <Measure
        label="Leyeron el texto 4 veces"
        value={40}
        fill="bg-(--lp-grid-strong)"
      />
    </Card>
  );
}

const SPACING = ["Hoy", "Mañana", "6 días", "~2 semanas"] as const;

function SpacingVisual() {
  return (
    <Card>
      <Kicker>Si respondes bien</Kicker>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SPACING.map((day, index) => (
          <motion.li
            key={day}
            className={`rounded-xl px-3 py-3 text-center font-(family-name:--lp-font-head) font-semibold text-[14px] ${
              index === 0
                ? "bg-(--lp-violet-100) text-(--lp-violet-deep)"
                : "bg-(--lp-sidebar) text-(--lp-ink)"
            }`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.12 }}
          >
            {day}
          </motion.li>
        ))}
      </ol>
      <span className="text-(--lp-ink-3) text-[13px]">
        Cada acierto aleja el siguiente repaso.
      </span>
    </Card>
  );
}

// Only the shape matters (Ebbinghaus measured savings, not recall), so the
// curve has no scale: a fast early drop that flattens out.
const CURVE_W = 460;
const CURVE_H = 170;
const CURVE_D = Array.from({ length: 47 }, (_, step) => {
  const x = (step / 46) * CURVE_W;
  const y = CURVE_H - CURVE_H * (0.22 + 0.78 * Math.exp(-x / 70));
  return `${step === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(" ");

function ForgettingVisual() {
  return (
    <Card>
      <Kicker>Curva ilustrativa</Kicker>
      <svg
        aria-hidden="true"
        viewBox={`0 -4 ${CURVE_W} ${CURVE_H + 8}`}
        className="w-full overflow-visible"
      >
        <line
          x1={0}
          x2={CURVE_W}
          y1={CURVE_H}
          y2={CURVE_H}
          className="stroke-(--lp-grid-strong)"
        />
        <motion.path
          d={CURVE_D}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-(--lp-green-500)"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
        />
      </svg>
      <span className="flex justify-between text-(--lp-muted) text-[12px]">
        <span>Lo aprendes</span>
        <span>Días después</span>
      </span>
    </Card>
  );
}

function CalibrationVisual() {
  return (
    <Card>
      <Kicker>Una pregunta de tu apunte</Kicker>
      <Measure
        label="Cómo te sentiste"
        value={84}
        fill="bg-(--lp-rose)"
        showValue={false}
      />
      <Measure
        label="Lo que mostraste"
        value={58}
        fill="bg-(--lp-violet-400)"
        showValue={false}
      />
      <span className="w-fit rounded-full bg-(--lp-rose-100) px-3 py-1.5 text-(--lp-rose-700) text-[13px]">
        Te sentiste más seguro de lo que mostraste
      </span>
    </Card>
  );
}

function FeedbackVisual() {
  return (
    <Card>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-(--lp-mint-50) p-4">
        <span className="flex items-center gap-1.5 font-(family-name:--lp-font-head) font-semibold text-(--lp-green-700) text-[13px]">
          <CircleCheck className="size-4" />
          Fortalezas
        </span>
        <span className="text-(--lp-ink-2) text-[13px]">
          Dominas las definiciones de Tu apunte.
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-(--lp-yellow-100) p-4">
        <span className="flex items-center gap-1.5 font-(family-name:--lp-font-head) font-semibold text-(--lp-amber-800) text-[13px]">
          <Sparkles className="size-4" />
          Oportunidades de mejora
        </span>
        <span className="text-(--lp-ink-2) text-[13px]">
          Vuelve a la sección del concepto clave antes del próximo repaso.
        </span>
      </div>
    </Card>
  );
}

function ElaborationVisual() {
  return (
    <Card>
      <Kicker>Tu respuesta</Kicker>
      <p className="font-(family-name:--lp-font-display) text-(--lp-ink-2) text-[22px] leading-[1.3]">
        «Tu apunte explica que el concepto clave A se relaciona con el B
        porque…»
      </p>
      <span className="flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full bg-(--lp-mint-100) px-3 py-1.5 text-(--lp-green-700)">
          Concepto clave A
        </span>
        <span className="rounded-full bg-(--lp-mint-100) px-3 py-1.5 text-(--lp-green-700)">
          Concepto clave B
        </span>
        <span className="rounded-full bg-(--lp-yellow-100) px-3 py-1.5 text-(--lp-amber-800)">
          Concepto clave C · para sumar
        </span>
      </span>
    </Card>
  );
}

// The six ideas of /ciencia (docs/landing/propuesta-contenido.md §10.1 and
// the Pencil frame "Página · La ciencia detrás de Cogni"), in plain words,
// each with what Cogni does with it and the full references it rests on.
export const CONCEPTS: readonly Concept[] = [
  {
    id: "practicar-recordando",
    name: "Practicar recordando",
    term: "Efecto de la prueba",
    idea: "Intentar recordar fortalece la memoria más que volver a leer. En un experimento, una semana después, quienes se pusieron a prueba tres veces recordaron el 61 % del texto; quienes lo leyeron cuatro veces, el 40 %. Y quienes releyeron creían que recordarían mejor.",
    inCogni:
      "Las tres técnicas te piden recordar antes de ver la respuesta. Ninguna te pide releer.",
    references: [
      {
        before:
          "Roediger, H. L., III, y Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. ",
        italic: "Psychological Science, 17",
        after: "(3), 249–255.",
      },
    ],
    tone: "yellow",
    visual: <TestingVisual />,
  },
  {
    id: "espaciar-los-repasos",
    name: "Espaciar los repasos",
    term: "Práctica distribuida",
    idea: "Repartir el estudio en varios días retiene más que concentrarlo en uno. Y el mejor espacio entre repasos crece cuanto más lejos está la prueba.",
    inCogni:
      "El algoritmo SM-2 pone cada fecha: si respondes bien, vuelve mañana, en 6 días y en unas dos semanas. Si te cuesta, vuelve pronto.",
    references: [
      {
        before:
          "Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., y Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. ",
        italic: "Psychological Bulletin, 132",
        after: "(3), 354–380.",
      },
      {
        before:
          "Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., y Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. ",
        italic: "Psychological Science, 19",
        after: "(11), 1095–1102.",
      },
    ],
    tone: "violet",
    visual: <SpacingVisual />,
  },
  {
    id: "la-curva-del-olvido",
    name: "La curva del olvido",
    term: "Olvido",
    idea: "Sin repaso, lo nuevo se olvida rápido al principio y después más despacio. Ebbinghaus lo midió como el esfuerzo que ahorras al reaprender, no como un porcentaje recordado: por eso aquí solo importa la forma.",
    inCogni:
      "El primer repaso llega al día siguiente, justo donde la caída es más rápida.",
    references: [
      {
        before: "Ebbinghaus, H. (1885). ",
        italic:
          "Über das Gedächtnis: Untersuchungen zur experimentellen Psychologie",
        after: ". Duncker & Humblot.",
      },
      {
        before:
          "Murre, J. M. J., y Dros, J. (2015). Replication and analysis of Ebbinghaus' forgetting curve. ",
        italic: "PLOS ONE, 10",
        after: "(7), e0120644.",
      },
    ],
    tone: "mint",
    visual: <ForgettingVisual />,
  },
  {
    id: "saber-lo-que-sabes",
    name: "Saber lo que sabes",
    term: "Calibración",
    idea: "Quien cree saber más de lo que sabe deja de estudiar antes de tiempo. Comparar tu respuesta con las ideas clave de la respuesta correcta afina esa sensación.",
    inCogni:
      "En recuperación activa, tu autoevaluación se compara con la evaluación según la rúbrica, y Cogni te avisa si te sentiste más o menos seguro de lo que mostraste.",
    references: [
      {
        before:
          "Dunlosky, J., y Rawson, K. A. (2012). Overconfidence produces underachievement: Inaccurate self evaluations undermine students' learning and retention. ",
        italic: "Learning and Instruction, 22",
        after: "(4), 271–280.",
      },
    ],
    tone: "rose",
    visual: <CalibrationVisual />,
  },
  {
    id: "retroalimentacion",
    name: "Retroalimentación que dice qué sigue",
    term: "Retroalimentación",
    idea: "La retroalimentación ayuda más cuando dice dónde estás y qué sigue, no solo si acertaste. Y retiene mejor cuando llega después del intento.",
    inCogni:
      "Al cerrar un mazo o un examen ves primero tus fortalezas y luego oportunidades de mejora, con un siguiente paso.",
    references: [
      {
        before: "Hattie, J., y Timperley, H. (2007). The power of feedback. ",
        italic: "Review of Educational Research, 77",
        after: "(1), 81–112.",
      },
      {
        before:
          "Bjork, E. L., y Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. En M. A. Gernsbacher, R. W. Pew, L. M. Hough y J. R. Pomerantz (Eds.), ",
        italic:
          "Psychology and the real world: Essays illustrating fundamental contributions to society",
        after: " (pp. 56–64). Worth Publishers.",
      },
    ],
    tone: "companion",
    visual: <FeedbackVisual />,
  },
  {
    id: "explicarlo-con-tus-palabras",
    name: "Explicarlo con tus palabras",
    term: "Elaboración",
    idea: "Explicar una idea con tus propias palabras obliga a conectarla con lo que ya sabes, y eso mejora la comprensión.",
    inCogni:
      "Las preguntas abiertas traen una rúbrica: ves qué conceptos clave incluiste y cuáles conviene sumar.",
    references: [
      {
        before:
          "Chi, M. T. H., de Leeuw, N., Chiu, M.-H., y LaVancher, C. (1994). Eliciting self-explanations improves understanding. ",
        italic: "Cognitive Science, 18",
        after: "(3), 439–477.",
      },
      {
        before:
          "Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., y Willingham, D. T. (2013). Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology. ",
        italic: "Psychological Science in the Public Interest, 14",
        after: "(1), 4–58.",
      },
    ],
    tone: "green",
    visual: <ElaborationVisual />,
  },
];

const step = (index: number) => String(index + 1).padStart(2, "0");

// The index under the page headline: one pill per idea, each a jump link
// with the idea's colour dot.
export function ConceptIndex() {
  return (
    <nav aria-label="Las seis ideas" className="mt-10">
      <ol className="flex max-w-[780px] flex-wrap gap-2.5">
        {CONCEPTS.map((concept, index) => (
          <li key={concept.id} data-tone={concept.tone} className="lp-sci">
            <a
              href={`#${concept.id}`}
              className="lp-press flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-(family-name:--lp-font-head) font-medium text-(--lp-ink-2) text-[13px]"
            >
              <span aria-hidden="true" className="lp-sci-dot size-2" />
              {step(index)} · {concept.name}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const IN_COGNI_ICON: LucideIcon = GraduationCap;

// Six alternating blocks on paper and soft lilac: the visual on one side,
// the idea, an "Así lo usa Cogni" box and its APA 7 references on the other. The
// visuals' bars and curve fill in on view, the page's one signature motion.
export function ScienceConcepts() {
  return (
    <>
      {CONCEPTS.map((concept, index) => {
        const titleId = `${concept.id}-title`;
        const visualFirst = index % 2 === 0;
        return (
          <section
            key={concept.id}
            id={concept.id}
            aria-labelledby={titleId}
            data-nav-theme="light"
            data-tone={concept.tone}
            className={`lp-sci lp-on-paper scroll-mt-16 px-5 py-16 md:px-10 md:py-[88px] xl:px-20 ${
              index % 2 === 0 ? "bg-(--lp-paper)" : "bg-(--lp-lilac-soft)"
            }`}
          >
            <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-20">
              <Reveal
                className={`lp-sci-visual flex aspect-[3/2] items-center justify-center rounded-[28px] p-6 md:p-10 ${
                  visualFirst ? "" : "lg:order-2"
                }`}
              >
                {concept.visual}
              </Reveal>
              <Reveal delay={0.08} className="flex flex-col">
                <p className="lp-sci-step flex items-center gap-2.5 font-(family-name:--lp-font-mono) text-[13px] uppercase tracking-[0.08em]">
                  <span aria-hidden="true" className="lp-sci-dot size-2" />
                  {step(index)} / {step(CONCEPTS.length - 1)} · {concept.term}
                </p>
                <h2
                  id={titleId}
                  className="mt-4 font-(family-name:--lp-font-head) font-semibold text-(--lp-ink) text-[clamp(34px,3.8vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance"
                >
                  {concept.name}
                </h2>
                <p className="mt-5 max-w-[60ch] text-(--lp-ink-2) text-[17px] leading-[1.6] md:text-[18px]">
                  {concept.idea}
                </p>
                <ul
                  aria-label="Referencias"
                  className="lp-sci-refs mt-5 flex flex-col gap-2 max-w-[60ch] border-(--lp-grid-strong) border-l-2 pl-3"
                >
                  {concept.references.map((reference) => (
                    <li
                      key={referenceText(reference)}
                      className="text-(--lp-ink-3) text-[13px] leading-[1.5]"
                    >
                      {reference.before}
                      <i>{reference.italic}</i>
                      {reference.after}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex gap-3 rounded-2xl bg-white p-[18px]">
                  <IN_COGNI_ICON
                    aria-hidden="true"
                    className="lp-sci-ink mt-0.5 size-[18px] shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="lp-sci-ink font-(family-name:--lp-font-head) font-semibold text-[14px]">
                      Así lo usa Cogni
                    </span>
                    <span className="text-(--lp-ink) text-[16px] leading-[1.55]">
                      {concept.inCogni}
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}
    </>
  );
}
