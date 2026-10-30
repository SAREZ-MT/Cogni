"use client";

import {
  CalendarDays,
  FileText,
  Flame,
  Heading1,
  List,
  Plus,
  Presentation,
  Quote,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { usePlayOnce } from "./play-once";

// One micro-demo per pillar. Each plays once (usePlayOnce), and with
// reduced motion renders its final state straight away. The mocks are
// decorative: the pillar copy next to them carries the meaning.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const POP = { type: "spring", visualDuration: 0.4, bounce: 0.25 } as const;

/* ------------------------------------------------------------------ 01 */

const PAGES = ["Tema 1 · Tu apunte", "Tema 2", "Tema 3", "Tema 4"] as const;
const SLASH = [
  { icon: Heading1, label: "Encabezado" },
  { icon: List, label: "Lista" },
  { icon: Quote, label: "Cita" },
] as const;
const FORMATS = [
  { label: "PDF", tone: "bg-(--lp-rose-100)", icon: FileText, from: 108 },
  { label: "Word", tone: "bg-(--lp-blue-100)", icon: FileText, from: 0 },
  {
    label: "PowerPoint",
    tone: "bg-(--lp-orange-100)",
    icon: Presentation,
    from: -92,
  },
] as const;

// Import: one file chip drops in, then splits into the three formats.
export function ImportDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);

  return (
    <div ref={root} aria-hidden="true" className="relative pb-10">
      <div className="lp-shadow-window flex h-[440px] overflow-hidden rounded-[22px] border border-(--lp-line) bg-white">
        <div className="hidden w-[210px] shrink-0 flex-col gap-1.5 bg-(--lp-sidebar) p-3.5 sm:flex">
          <p className="px-2 pt-1 pb-2 font-bold text-(--lp-muted) text-[11px] uppercase tracking-[0.12em]">
            Tu cuaderno
          </p>
          {PAGES.map((page, index) => (
            <span
              key={page}
              className={`flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13px] ${
                index === 0
                  ? "bg-white font-bold text-(--lp-ink) shadow-sm"
                  : "text-(--lp-ink-3)"
              }`}
            >
              <FileText className="size-3.5 shrink-0" />
              {page}
            </span>
          ))}
          <span className="flex items-center gap-2 px-2.5 py-2 text-(--lp-muted) text-[13px]">
            <Plus className="size-3.5" />
            Nueva página
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-7 sm:p-9">
          <p className="font-extrabold text-(--lp-ink) text-[26px] tracking-[-0.01em]">
            Tu apunte
          </p>
          <span className="h-2 w-[80%] rounded-full bg-(--lp-editor-line)" />
          <span className="h-2 w-[66%] rounded-full bg-(--lp-editor-line)" />
          <span className="h-2 w-[72%] rounded-full bg-(--lp-editor-line)" />
          <div className="lp-shadow-card mt-2 flex w-[240px] flex-col gap-0.5 rounded-[14px] border border-(--lp-line) bg-white p-2">
            <p className="px-2 py-1.5 font-(family-name:--lp-font-mono) text-(--lp-muted) text-[12px]">
              / insertar bloque
            </p>
            {SLASH.map(({ icon: Icon, label }, index) => (
              <span
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-(--lp-ink) text-[13px] ${
                  index === 0 ? "bg-(--lp-soft)" : ""
                }`}
              >
                <Icon className="size-4 text-(--lp-ink-3)" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-4 bottom-0 flex items-center gap-2 sm:right-8">
        <motion.span
          className="absolute inset-x-0 mx-auto flex w-fit items-center gap-2 rounded-[10px] border border-(--lp-ink)/8 bg-white px-3 py-2 font-bold text-(--lp-ink) text-[13px] shadow-sm"
          initial={{ opacity: 0, transform: "translateY(-48px)" }}
          animate={
            play
              ? {
                  opacity: [0, 1, 1, 0],
                  transform: [
                    "translateY(-48px)",
                    "translateY(0px)",
                    "translateY(0px)",
                    "translateY(0px)",
                  ],
                }
              : undefined
          }
          transition={{
            duration: 0.9,
            times: [0, 0.4, 0.75, 1],
            ease: EASE_OUT,
          }}
        >
          <FileText className="size-3.5" />
          Tu apunte
        </motion.span>
        {FORMATS.map(({ label, tone, icon: Icon, from }, index) => (
          <motion.span
            key={label}
            className={`flex items-center gap-1.5 rounded-[10px] border border-(--lp-ink)/8 px-3 py-2 font-bold text-(--lp-ink) text-[13px] ${tone}`}
            initial={{
              opacity: 0,
              transform: `translateX(${from}px) scale(0.9)`,
            }}
            animate={
              play
                ? { opacity: 1, transform: "translateX(0px) scale(1)" }
                : undefined
            }
            transition={{ ...POP, delay: 0.7 + index * 0.08 }}
          >
            <Icon className="size-3.5" />
            {label}
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

const WEEK = [
  { day: "Lun", date: 13, bars: ["bg-(--lp-yellow)"], today: true },
  { day: "Mar", date: 14, bars: [] },
  { day: "Mié", date: 15, bars: ["bg-(--lp-yellow)", "bg-(--lp-mint)"] },
  { day: "Jue", date: 16, bars: [] },
  { day: "Vie", date: 17, bars: ["bg-(--lp-rose)"] },
  { day: "Sáb", date: 18, bars: [] },
  { day: "Dom", date: 19, bars: ["bg-(--lp-yellow)", "bg-(--lp-mint)"] },
] as const;

const LEGEND = [
  { label: "Flashcards", tone: "bg-(--lp-yellow)" },
  { label: "Recuperación activa", tone: "bg-(--lp-mint)" },
  { label: "Exámenes", tone: "bg-(--lp-rose)" },
] as const;

const TODAY = [
  {
    title: "Repasar flashcards",
    meta: "Tu apunte · 12 tarjetas",
    tone: "bg-(--lp-yellow)",
  },
  {
    title: "Explícalo con tus palabras",
    meta: "Tu cuaderno · Tema 2",
    tone: "bg-(--lp-mint)",
  },
  {
    title: "Examen corto",
    meta: "Tu cuaderno · Tema 1",
    tone: "bg-(--lp-rose)",
    done: true,
  },
] as const;

// Schedule and Hoy: the Hoy rows slide in one after another, then the
// finished one gets its checkmark drawn.
export function TodayDemo() {
  const root = useRef<HTMLDivElement>(null);
  const play = usePlayOnce(root);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="relative flex flex-col gap-6 sm:pb-[230px]"
    >
      <div className="lp-shadow-float rounded-[24px] bg-(--lp-ground) p-6 sm:mr-20 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-extrabold text-(--lp-paper) text-lg">
            Esta semana
          </p>
          <span className="flex items-center gap-1.5 text-(--lp-violet-300) text-[13px]">
            <CalendarDays className="size-4" />4 días de repaso
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEK.map((cell) => (
            <div
              key={cell.day}
              className={`flex min-h-[112px] flex-col gap-1 rounded-xl border p-2 ${
                "today" in cell
                  ? "border-(--lp-violet-400) bg-(--lp-violet)"
                  : cell.bars.length > 0
                    ? "border-white/8 bg-(--lp-ground-raise)"
                    : "border-white/8 bg-white/3"
              }`}
            >
              <span
                className={`text-[12px] ${"today" in cell ? "text-(--lp-violet-100)" : "text-(--lp-on-dark-3)"}`}
              >
                {cell.day}
              </span>
              <span className="font-(family-name:--lp-font-display) text-(--lp-paper) text-[26px] leading-none">
                {cell.date}
              </span>
              <span className="mt-auto flex flex-col gap-1">
                {cell.bars.map((bar) => (
                  <span key={bar} className={`h-1.5 rounded-full ${bar}`} />
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND.map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 text-(--lp-on-dark-2) text-[12px]"
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
