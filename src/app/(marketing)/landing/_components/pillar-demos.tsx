"use client";

import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { Notebook } from "@phosphor-icons/react/dist/csr/Notebook";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Quotes } from "@phosphor-icons/react/dist/csr/Quotes";
import { TextHOne } from "@phosphor-icons/react/dist/csr/TextHOne";
import { Flame, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { FileBadge, type FileKind } from "./file-badge";
import { usePlayOnce } from "./play-once";

// One micro-demo per pillar. Each plays once (usePlayOnce), and with
// reduced motion renders its final state straight away. The mocks are
// decorative: the pillar copy next to them carries the meaning.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const POP = { type: "spring", visualDuration: 0.4, bounce: 0.25 } as const;

/* ------------------------------------------------------------------ 01 */

const PAGES = ["Tema 1 · Tu apunte", "Tema 2", "Tema 3", "Tema 4"] as const;
const SLASH = [
  { icon: TextHOne, label: "Encabezado" },
  { icon: ListBullets, label: "Lista" },
  { icon: Quotes, label: "Cita" },
] as const;
// The three importable formats, fanned like a hand of files.
const FORMATS: readonly { kind: FileKind; tilt: string }[] = [
  { kind: "pdf", tilt: "-rotate-6" },
  { kind: "docx", tilt: "rotate-0 -translate-y-1.5" },
  { kind: "pptx", tilt: "rotate-6" },
];

// Import: the notebook window, then the three file types drop into its
// corner one after another.
export function ImportDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);

  return (
    <div ref={root} aria-hidden="true" data-ui="" className="relative pb-12">
      <div className="lp-shadow-window flex h-[440px] flex-col overflow-hidden rounded-[22px] border border-(--lp-line) bg-white">
        <div className="flex h-11 shrink-0 items-center gap-2 border-(--lp-line) border-b px-4 text-[13px]">
          <span className="flex gap-1.5 pr-2">
            <span className="size-2.5 rounded-full bg-(--lp-grid-strong)" />
            <span className="size-2.5 rounded-full bg-(--lp-grid-strong)" />
            <span className="size-2.5 rounded-full bg-(--lp-grid-strong)" />
          </span>
          <Notebook weight="duotone" className="size-4 text-(--lp-violet)" />
          <span className="text-(--lp-ink-3)">Tu cuaderno</span>
          <CaretRight weight="bold" className="size-3 text-(--lp-muted)" />
          <span className="font-bold text-(--lp-ink)">Tu apunte</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-[210px] shrink-0 flex-col gap-1 border-(--lp-line) border-r bg-(--lp-sidebar) p-3 sm:flex">
            <p className="px-2 pt-1.5 pb-2 font-bold text-(--lp-muted) text-[11px] uppercase tracking-[0.12em]">
              Tu cuaderno
            </p>
            {PAGES.map((page, index) => (
              <span
                key={page}
                className={`relative flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13px] ${
                  index === 0
                    ? "lp-shadow-card bg-white font-bold text-(--lp-ink)"
                    : "text-(--lp-ink-3)"
                }`}
              >
                <FileText
                  weight={index === 0 ? "duotone" : "regular"}
                  className={`size-4 shrink-0 ${index === 0 ? "text-(--lp-violet)" : ""}`}
                />
                {page}
              </span>
            ))}
            <span className="flex items-center gap-2 px-2.5 py-2 text-(--lp-muted) text-[13px]">
              <Plus weight="bold" className="size-3.5" />
              Nueva página
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3.5 p-7 sm:p-9">
            <span className="flex items-center gap-3">
              <FileBadge kind="pdf" size="sm" />
              <span className="font-extrabold text-(--lp-ink) text-[26px] tracking-[-0.01em]">
                Tu apunte
              </span>
            </span>
            <span className="mt-1 h-2 w-[82%] rounded-full bg-(--lp-editor-line)" />
            <span className="h-2 w-[68%] rounded-full bg-(--lp-editor-line)" />
            <span className="h-2 w-[74%] rounded-full bg-(--lp-editor-line)" />
            <span className="flex w-[62%] items-center gap-2">
              <span className="h-2 flex-[2] rounded-full bg-(--lp-editor-line)" />
              <span className="h-2 flex-[1.4] rounded-full bg-(--lp-yellow-200)" />
              <span className="h-2 flex-1 rounded-full bg-(--lp-editor-line)" />
            </span>
            <div className="lp-shadow-card mt-3 flex w-[248px] flex-col gap-0.5 rounded-[14px] border border-(--lp-line) bg-white p-1.5">
              <p className="px-2 py-1.5 font-(family-name:--lp-font-mono) text-(--lp-muted) text-[12px]">
                / insertar bloque
              </p>
              {SLASH.map(({ icon: Icon, label }, index) => (
                <span
                  key={label}
                  className={`flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-(--lp-ink) text-[13px] ${
                    index === 0 ? "bg-(--lp-soft) font-bold" : ""
                  }`}
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg border border-(--lp-line) bg-white ${
                      index === 0
                        ? "text-(--lp-violet-deep)"
                        : "text-(--lp-ink-3)"
                    }`}
                  >
                    <Icon weight="bold" className="size-4" />
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lp-shadow-window absolute right-4 bottom-0 flex items-end gap-3 rounded-[18px] border border-(--lp-line) bg-white px-5 pt-4 pb-3.5 sm:right-8">
        {FORMATS.map(({ kind, tilt }, index) => (
          <motion.span
            key={kind}
            className={`block ${tilt}`}
            initial={{ opacity: 0, transform: "translateY(-28px) scale(0.92)" }}
            animate={
              play
                ? { opacity: 1, transform: "translateY(0px) scale(1)" }
                : undefined
            }
            transition={{ ...POP, delay: 0.25 + index * 0.1 }}
          >
            <FileBadge kind={kind} size="lg" />
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 02 */

const W = 700;
const H = 260;
const DAYS = 20;
// Days of the reviews SM-2 sets when every answer is "Bien" (sm2.ts):
// tomorrow, +6, then about two weeks.
const REVIEWS = [1, 6, 15] as const;
// Stability grows with each review, so every drop is gentler than the last.
const STABILITY = [1.5, 3.5, 8, 18, 40] as const;

const xAt = (day: number) => (day / DAYS) * W;
const yAt = (recall: number) => H - recall * H;

function curve(points: [number, number][]) {
  return points
    .map(
      ([day, recall], i) =>
        `${i === 0 ? "M" : "L"}${xAt(day).toFixed(1)} ${yAt(recall).toFixed(1)}`,
    )
    .join(" ");
}

function forgetting() {
  const points: [number, number][] = [];
  for (let day = 0; day <= DAYS; day += 0.25) {
    points.push([day, 1 / (1 + 0.9 * day)]);
  }
  return curve(points);
}

function withReviews() {
  const bounds = [0, ...REVIEWS, DAYS];
  const points: [number, number][] = [];
  bounds.slice(0, -1).forEach((start, segment) => {
    const end = bounds[segment + 1];
    for (let day = start; day <= end; day += 0.25) {
      points.push([day, Math.exp(-(day - start) / STABILITY[segment])]);
    }
    if (end !== DAYS) points.push([end, 1]);
  });
  return curve(points);
}

const FORGETTING_D = forgetting();
const REVIEWS_D = withReviews();

// Spaced repetition: both curves draw themselves once, then the review
// markers appear on the Cogni curve.
export function CurveDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);
  const draw = (delay: number) => ({
    initial: { pathLength: 0 },
    animate: play ? { pathLength: 1 } : undefined,
    transition: { duration: 1.2, ease: EASE_OUT, delay },
  });

  return (
    <div
      ref={root}
      className="lp-shadow-window flex flex-col gap-5 rounded-[28px] border border-(--lp-line) bg-white px-5 pt-6 pb-6 sm:px-8 sm:pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-extrabold text-(--lp-ink) text-lg">
          Cuánto recuerdas de Tu apunte
        </p>
        <div
          aria-hidden="true"
          className="flex gap-4 text-(--lp-ink-3) text-[13px]"
        >
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-(--lp-curve-off)" />
            Sin repasar
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-(--lp-violet)" />
            Con Cogni
          </span>
        </div>
      </div>

      <svg
        viewBox={`-44 -14 ${W + 58} ${H + 62}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Sin repasar, el recuerdo cae sobre todo en los primeros días. Con repasos en los días 1, 6 y 15, vuelve al máximo cada vez y cae cada vez más despacio."
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={0}
              x2={W}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className={
                tick === 0 ? "stroke-(--lp-grid-strong)" : "stroke-(--lp-grid)"
              }
            />
            <text
              x={-12}
              y={yAt(tick) + 4}
              textAnchor="end"
              className="fill-(--lp-muted) font-semibold text-[11px]"
            >
              {tick * 100}%
            </text>
          </g>
        ))}
        {REVIEWS.map((day) => (
          <g key={day}>
            <line
              x1={xAt(day)}
              x2={xAt(day)}
              y1={0}
              y2={H}
              strokeDasharray="4 5"
              className="stroke-(--lp-violet)/30"
            />
            <rect
              x={xAt(day) - 22}
              y={H + 14}
              width={44}
              height={22}
              rx={11}
              className="fill-(--lp-violet)"
            />
            <text
              x={xAt(day)}
              y={H + 29}
              textAnchor="middle"
              className="fill-(--lp-paper) font-bold text-[12px]"
            >
              +{day} d
            </text>
          </g>
        ))}
        <text
          x={-8}
          y={H + 29}
          textAnchor="end"
          className="fill-(--lp-muted) font-semibold text-[12px]"
        >
          Hoy
        </text>

        <motion.path
          d={FORGETTING_D}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="stroke-(--lp-curve-off)"
          {...draw(0)}
        />
        <motion.path
          d={REVIEWS_D}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-(--lp-violet)"
          {...draw(0.25)}
        />
        {REVIEWS.map((day, index) => (
          <motion.circle
            key={day}
            cx={xAt(day)}
            cy={yAt(1)}
            r={6}
            strokeWidth={3}
            className="fill-white stroke-(--lp-violet)"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : undefined}
            transition={{ duration: 0.3, delay: 1.35 + index * 0.08 }}
          />
        ))}
      </svg>

      <div
        aria-hidden="true"
        className="flex flex-wrap gap-2.5 text-[12px] sm:-mt-2"
      >
        <span className="rounded-full bg-(--lp-soft) px-3 py-1.5 font-semibold text-(--lp-ink-3)">
          Sin repasar, se olvida en días
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-violet) px-3 py-1.5 font-bold text-white">
          <Sparkles className="size-3.5" />
          Cada repaso llega justo a tiempo
        </span>
      </div>
      <p className="text-(--lp-muted) text-[12px] leading-normal">
        Curva ilustrativa: marca los repasos que calcula el motor cuando
        respondes «Bien».
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ 03 */

type Technique = "flashcards" | "recall" | "exam";

// One week of the app's calendar (calendario, week view): each review is a
// chip with a bar in its technique's colour, as the real CalendarGrid draws.
const WEEK: readonly {
  day: string;
  date: number;
  today?: boolean;
  events: readonly { page: string; technique: Technique }[];
}[] = [
  {
    day: "Lun",
    date: 13,
    today: true,
    events: [
      { page: "Tu apunte", technique: "flashcards" },
      { page: "Tema 2", technique: "recall" },
      { page: "Tema 1", technique: "exam" },
    ],
  },
  { day: "Mar", date: 14, events: [] },
  {
    day: "Mié",
    date: 15,
    events: [
      { page: "Tema 3", technique: "flashcards" },
      { page: "Tu apunte", technique: "recall" },
    ],
  },
  { day: "Jue", date: 16, events: [] },
  { day: "Vie", date: 17, events: [{ page: "Tema 2", technique: "exam" }] },
  { day: "Sáb", date: 18, events: [] },
  {
    day: "Dom",
    date: 19,
    events: [
      { page: "Tu apunte", technique: "flashcards" },
      { page: "Tema 4", technique: "recall" },
    ],
  },
];

const ACCENT: Record<Technique, string> = {
  flashcards: "bg-(--lp-yellow)",
  recall: "bg-(--lp-mint)",
  exam: "bg-(--lp-rose)",
};

const LEGEND = [
  { label: "Flashcards", tone: ACCENT.flashcards },
  { label: "Recuperación activa", tone: ACCENT.recall },
  { label: "Exámenes", tone: ACCENT.exam },
] as const;

const TODAY = [
  {
    title: "Repasar flashcards",
    meta: "Tu apunte · 12 tarjetas",
    tone: ACCENT.flashcards,
  },
  {
    title: "Explícalo con tus palabras",
    meta: "Tu cuaderno · Tema 2",
    tone: ACCENT.recall,
  },
  {
    title: "Examen corto",
    meta: "Tu cuaderno · Tema 1",
    tone: ACCENT.exam,
    done: true,
  },
] as const;

// Schedule and Hoy: a light week of the calendar whose review chips land
// day by day, then the Hoy rows slide in and the finished one gets its
// checkmark drawn.
export function TodayDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-ui=""
      className="relative flex flex-col gap-6 sm:pb-[200px]"
    >
      <div className="lp-shadow-window overflow-hidden rounded-[24px] border border-(--lp-line) bg-white sm:mr-16">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <span className="flex items-center gap-3">
            <span className="hidden overflow-hidden rounded-lg border border-(--lp-line) text-(--lp-ink-3) sm:flex">
              <span className="flex size-7 items-center justify-center border-(--lp-line) border-r">
                <CaretLeft weight="bold" className="size-3.5" />
              </span>
              <span className="flex size-7 items-center justify-center">
                <CaretRight weight="bold" className="size-3.5" />
              </span>
            </span>
            <span className="whitespace-nowrap font-extrabold text-(--lp-ink) text-lg">
              Esta semana
            </span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-(--lp-violet-100) px-2.5 py-1 font-bold text-(--lp-violet-deep) text-[12px]">
            <CalendarDots weight="duotone" className="size-4" />4 días de repaso
          </span>
        </div>
        <div className="grid grid-cols-7 border-(--lp-line) border-y bg-(--lp-sidebar)">
          {WEEK.map((cell) => (
            <span
              key={cell.day}
              className="flex flex-col items-center gap-1 py-2.5 sm:flex-row sm:justify-center sm:gap-1.5"
            >
              <span className="font-semibold text-(--lp-ink-3) text-[11px] sm:text-[12px]">
                {cell.day}
              </span>
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-bold text-[12px] tabular-nums ${
                  cell.today ? "bg-(--lp-violet) text-white" : "text-(--lp-ink)"
                }`}
              >
                {cell.date}
              </span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {WEEK.map((cell, column) => (
            <div
              key={cell.day}
              className={`flex min-h-[104px] min-w-0 flex-col gap-1.5 border-(--lp-line) p-1 sm:min-h-[196px] sm:p-1.5 ${
                column < WEEK.length - 1 ? "border-r" : ""
              } ${cell.today ? "bg-(--lp-lilac-soft)" : ""}`}
            >
              {cell.events.map((event, index) => (
                <motion.span
                  key={`${event.page}-${event.technique}`}
                  className="relative flex min-w-0 items-center rounded-[6px] border border-(--lp-line) bg-white py-1.5 pr-1.5 pl-3 max-sm:mx-auto max-sm:size-2.5 max-sm:rounded-full max-sm:border-0 max-sm:p-0"
                  data-technique={event.technique}
                  initial={{ opacity: 0, transform: "translateY(6px)" }}
                  animate={
                    play
                      ? { opacity: 1, transform: "translateY(0px)" }
                      : undefined
                  }
                  transition={{
                    duration: 0.35,
                    ease: EASE_OUT,
                    delay: 0.1 + column * 0.06 + index * 0.05,
                  }}
                >
                  <span
                    className={`absolute inset-y-1.5 left-1 w-[3px] rounded-full max-sm:inset-0 max-sm:w-auto ${ACCENT[event.technique]}`}
                  />
                  <span className="truncate font-semibold text-(--lp-ink) text-[11px] leading-snug max-sm:hidden lg:text-[12px]">
                    {event.page}
                  </span>
                </motion.span>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-(--lp-line) border-t px-5 py-3.5 sm:px-6">
          {LEGEND.map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 text-(--lp-ink-3) text-[12px]"
            >
              <span className={`size-2 rounded-full ${item.tone}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="lp-shadow-window flex w-full flex-col gap-3 rounded-[22px] border border-(--lp-line) bg-white p-5 sm:absolute sm:right-0 sm:bottom-0 sm:w-[340px] sm:rotate-[-2deg]">
        <div className="flex items-baseline justify-between">
          <p className="font-(family-name:--lp-font-display) text-(--lp-ink) text-[32px] leading-none">
            Hoy
          </p>
          <span className="font-bold text-(--lp-violet-deep) text-[12px]">
            3 repasos
          </span>
        </div>
        {TODAY.map((row, index) => (
          <motion.div
            key={row.title}
            className="flex items-center gap-3 rounded-xl border border-(--lp-line) px-3 py-2.5"
            initial={{ opacity: 0, transform: "translateX(12px)" }}
            animate={
              play ? { opacity: 1, transform: "translateX(0px)" } : undefined
            }
            transition={{
              duration: 0.4,
              ease: EASE_OUT,
              delay: 0.15 + index * 0.06,
            }}
          >
            <span className={`h-8 w-1 shrink-0 rounded-full ${row.tone}`} />
            <span className="flex flex-1 flex-col">
              <span
                className={`font-bold text-sm ${"done" in row ? "text-(--lp-muted)" : "text-(--lp-ink)"}`}
              >
                {row.title}
              </span>
              <span className="text-(--lp-card-kicker) text-[12px]">
                {row.meta}
              </span>
            </span>
            {"done" in row ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
                <circle
                  cx="12"
                  cy="12"
                  r="11"
                  className="fill-(--lp-green-500)"
                />
                <motion.path
                  d="M7 12.5l3.2 3.2L17 9"
                  fill="none"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-white"
                  initial={{ pathLength: 0 }}
                  animate={play ? { pathLength: 1 } : undefined}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.7 }}
                />
              </svg>
            ) : (
              <span className="size-6 rounded-full border-2 border-(--lp-grid-strong)" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 04 */

const WEEK_BARS = [
  { day: "L", value: 0.3 },
  { day: "M", value: 0.45 },
  { day: "M", value: 0.38 },
  { day: "J", value: 0.6 },
  { day: "V", value: 0.5 },
  { day: "S", value: 0.72 },
  { day: "D", value: 0.9 },
] as const;

const MASTERY = [
  { label: "Flashcards", value: 78, tone: "bg-(--lp-yellow)" },
  { label: "Recuperación activa", value: 61, tone: "bg-(--lp-mint)" },
  { label: "Exámenes", value: 70, tone: "bg-(--lp-rose)" },
] as const;

// Progress: the week's completed reviews grow from the baseline. Accents
// follow the pillar's rose band; today's bar stays yellow.
export function ProgressDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="grid gap-4 sm:grid-cols-[1.15fr_1fr]"
    >
      <div className="lp-shadow-float flex flex-col gap-4 rounded-[24px] bg-(--lp-rose-950) p-6">
        <p className="font-bold text-(--lp-rose-100) text-sm">
          Repasos completados
        </p>
        <p className="font-(family-name:--lp-font-display) text-(--lp-paper) text-[88px] leading-[0.85]">
          48
        </p>
        <span className="w-fit rounded-full bg-(--lp-mint)/15 px-3 py-1 font-bold text-(--lp-mint) text-[12px]">
          +12 frente a la semana pasada
        </span>
        <div className="mt-2 flex h-[130px] items-end gap-2.5">
          {WEEK_BARS.map((bar, index) => (
            <div
              // Day letters repeat (M, M), so the index keys the column.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
              key={index}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <motion.span
                className={`w-full origin-bottom rounded-md ${
                  index === WEEK_BARS.length - 1
                    ? "bg-(--lp-yellow)"
                    : "bg-(--lp-rose)"
                }`}
                style={{ height: `${bar.value * 100}%` }}
                initial={{ transform: "scaleY(0)" }}
                animate={play ? { transform: "scaleY(1)" } : undefined}
                transition={{
                  duration: 0.5,
                  ease: EASE_OUT,
                  delay: 0.1 + index * 0.05,
                }}
              />
              <span className="text-(--lp-rose-100)/75 text-[11px]">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="lp-shadow-window flex flex-col gap-3 rounded-[20px] border border-(--lp-line) bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-(--lp-ink-3) text-sm">Racha</span>
            <span className="flex items-center gap-1 font-extrabold text-(--lp-ink) text-xl">
              <Flame className="size-5 fill-(--lp-amber-500) text-(--lp-amber-500)" />
              6 días
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, day) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed week
                key={day}
                className={`h-5 rounded-md ${day < 6 ? "bg-(--lp-rose)" : "bg-(--lp-rose-100)"}`}
              />
            ))}
          </div>
        </div>
        <div className="lp-shadow-window flex flex-1 flex-col gap-3.5 rounded-[20px] border border-(--lp-line) bg-white p-5">
          <span className="text-(--lp-ink-3) text-sm">Acierto por técnica</span>
          {MASTERY.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <span className="flex justify-between font-bold text-(--lp-ink) text-[13px]">
                {item.label}
                <span>{item.value} %</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-(--lp-soft)">
                <span
                  className={`block h-full rounded-full ${item.tone}`}
                  style={{ width: `${item.value}%` }}
                />
              </span>
            </div>
          ))}
          <span className="mt-auto text-(--lp-muted) text-[11px]">
            Datos de ejemplo
          </span>
        </div>
      </div>
    </div>
  );
}
