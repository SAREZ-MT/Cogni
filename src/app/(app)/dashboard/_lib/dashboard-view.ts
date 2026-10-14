import type {
  CalibrationCounts,
  CalibrationRollup,
  MasteryLevelName,
  NotebookProgress,
  Progress,
  Technique,
  TechniqueMetricsReport,
} from "@/modules/analytics";
import type { NotebookColor } from "@/modules/notebooks";
import type { LevelStripBar } from "@/shared/ui/level-strip";
import {
  MASTERY_LEVEL_LABEL,
  type MasteryLevel,
  masteryLevelFromScore,
} from "@/shared/ui/mastery-level";
import type { DashboardRange } from "@/shared/ui/period-filter";
import { greetingForHour } from "../../_components/format";

// Pure mapping from the analytics outputs (documento-maestro §3.6) to the
// dashboard components' props. Type-only imports from the analytics module
// keep this file free of server code, so client components can import its
// types. Every number here comes from the analytics reads; nothing is
// sampled or invented (T4 decisions, 2026-10-13: no per-concept section, no
// week-over-week for "Dominio global", no deltas for due items or mastered
// pages, no week-over-week trend per notebook: there is no mastery history).

export type TechniqueKey = "flashcards" | "activeRecall" | "exams";

export type CalibrationZone = "exceso" | "falta" | "calibrado";

export interface DashboardSources {
  progress: Progress;
  metrics: TechniqueMetricsReport;
  calibration: CalibrationRollup;
  range: DashboardRange;
  // Local hour (0–23) in the profile zone, for the greeting.
  hour: number;
  userName: string;
}

export interface HeroView {
  greeting: string;
  subtitle: string;
}

export interface MasteryView {
  // Average current mastery (0–100) of the pages with items; null without
  // any.
  valuePct: number | null;
  bars: LevelStripBar[];
}

export interface DailyActivity {
  day: string;
  label: string; // "lun 22"
  fullLabel: string; // "lun 22 sep"
  isMonday: boolean;
  weekLabel: string; // "Sem 2", meaningful on Mondays
  flashcards: number;
  activeRecall: number;
  exams: number;
}

export interface ActivityView {
  days: DailyActivity[];
  total: number;
  // vs. the previous period of the same length; null when it had no
  // reviews (no meaningful percentage).
  deltaPct: number | null;
  periodLabel: string;
}

export interface TechniqueAccuracy {
  key: TechniqueKey;
  label: string;
  dotClass: string;
  accuracyPct: number | null;
  // Percentage points vs. the previous period; null unless both have
  // outcomes.
  deltaPts: number | null;
}

export interface AccuracyView {
  // Correct / total across every technique's outcomes; null without any.
  overallPct: number | null;
  techniques: TechniqueAccuracy[];
}

export interface KpisView {
  streak: { value: string; delta: number };
  due: { value: string; hint: string };
  mastered: { value: string; hint: string };
}

export interface NotebookProgressRow {
  notebookId: string;
  title: string;
  color: NotebookColor | null;
  itemsTotal: number;
  itemsDue: number;
  level: MasteryLevel;
  avgScorePct: number;
}

export interface CalibrationRow {
  id: string;
  pageTitle: string;
  notebookTitle: string;
  selfAvg: number;
  aiAvg: number;
  gap: number;
  zone: CalibrationZone;
  href: string;
}

export interface TechniqueCardView {
  key: TechniqueKey;
  label: string;
  reviewsCompleted: number;
  deltaPct: number | null;
  periodLabel: string;
  streakDays: number;
  // Last days of the range (at most 14), oldest first.
  studiedDays: boolean[];
  // Last 7 days of the range, oldest first, labelled by weekday initial.
  recentActivity: { day: string; label: string; count: number }[];
  accuracyPct: number | null;
  colorVar: string;
  dotClass: string;
}

export interface DashboardView {
  // No study items and no reviews yet: the page shows one empty state.
  isEmpty: boolean;
  hero: HeroView;
  mastery: MasteryView;
  activity: ActivityView;
  accuracy: AccuracyView;
  kpis: KpisView;
  notebooks: NotebookProgressRow[];
  calibration: CalibrationRow[];
  techniques: TechniqueCardView[];
}

const DAY_MS = 86_400_000;

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAY_INITIAL = ["d", "l", "m", "x", "j", "v", "s"];
const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const TECHNIQUES: Record<
  Technique,
  { key: TechniqueKey; label: string; colorVar: string; dotClass: string }
> = {
  flashcards: {
    key: "flashcards",
    label: "Flashcards",
    colorVar: "var(--color-primary-600)",
    dotClass: "bg-primary-600",
  },
  recall: {
    key: "activeRecall",
    label: "Active recall",
    colorVar: "var(--color-success-600)",
    dotClass: "bg-success-600",
  },
  exam: {
    key: "exams",
    label: "Exámenes",
    colorVar: "var(--color-rose-600)",
    dotClass: "bg-rose-600",
  },
};

const LEVEL_OF: Record<MasteryLevelName, MasteryLevel> = {
  Nuevo: "nuevo",
  Aprendiendo: "aprendiendo",
  Consolidando: "consolidando",
  Dominado: "dominado",
};

const STUDIED_DAYS_WINDOW = 14;
const RECENT_ACTIVITY_DAYS = 7;

function utcMidnight(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function addDays(day: string, days: number): string {
  return new Date(utcMidnight(day).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// The last `range` local days, today included, as [fromDay, toDay).
export function dashboardRangeDays(
  today: string,
  range: DashboardRange,
): { fromDay: string; toDay: string } {
  const toDay = addDays(today, 1);
  return { fromDay: addDays(toDay, -range), toDay };
}

// The local hour (0–23) of `instant` in `timeZone`, for the greeting.
export function hourIn(instant: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(instant)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}

// Fixed Spanish day names (no platform locale data), so server and client
// always agree.
export function dayLabels(day: string): {
  label: string;
  fullLabel: string;
  initial: string;
  isMonday: boolean;
} {
  const date = utcMidnight(day);
  const weekday = date.getUTCDay();
  const label = `${WEEKDAY_SHORT[weekday]} ${date.getUTCDate()}`;
  return {
    label,
    fullLabel: `${label} ${MONTH_SHORT[date.getUTCMonth()]}`,
    initial: WEEKDAY_INITIAL[weekday] as string,
    isMonday: weekday === 1,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(rate: number): number {
  return Math.round(rate * 100);
}

function deltaPercent(current: number, previous: number): number | null {
  return previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : null;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// §7.4 zone of a page: its most frequent per-answer signal. Ties favour
// the miscalibrated signal, overconfidence before underconfidence
// (decision 2026-10-13).
export function calibrationZoneOf(counts: CalibrationCounts): CalibrationZone {
  const ranked: [CalibrationZone, number][] = [
    ["exceso", counts.overconfident],
    ["falta", counts.underconfident],
    ["calibrado", counts.calibrated],
  ];
  let best = ranked[0] as [CalibrationZone, number];
  for (const entry of ranked) if (entry[1] > best[1]) best = entry;
  return best[0];
}

function notebookLevel(notebook: NotebookProgress): MasteryLevel {
  return masteryLevelFromScore(notebook.averageScore ?? 0, notebook.itemsTotal);
}

function heroView(sources: DashboardSources): HeroView {
  const greeting = greetingForHour(sources.hour, sources.userName);
  const scored = sources.progress.notebooks.filter(
    (notebook) => notebook.averageScore !== null,
  );
  const weakest = scored.reduce<NotebookProgress | null>(
    (min, notebook) =>
      min === null || (notebook.averageScore ?? 0) < (min.averageScore ?? 0)
        ? notebook
        : min,
    null,
  );
  if (!weakest) {
    return {
      greeting,
      subtitle:
        "Genera flashcards, preguntas o exámenes en tus páginas para ver aquí cómo avanzas.",
    };
  }
  const level = notebookLevel(weakest);
  return {
    greeting,
    subtitle:
      level === "dominado"
        ? "Todos tus cuadernos están en Dominado: mantén tus repasos al día."
        : `${weakest.title} sigue en ${MASTERY_LEVEL_LABEL[level]}: dedícale dos repasos para retomar impulso.`,
  };
}

function masteryView(progress: Progress): MasteryView {
  const withItems = progress.pages.filter((page) => page.itemsTotal > 0);
  const valuePct =
    withItems.length === 0
      ? null
      : percent(
          withItems.reduce((sum, page) => sum + page.score, 0) /
            withItems.length,
        );
  const bars = progress.pages
    .map((page) => ({
      id: page.pageId,
      label: page.pageTitle,
      level: LEVEL_OF[page.level],
      score: page.score,
    }))
    // Stable: equal scores keep the reader's order.
    .sort((a, b) => a.score - b.score);
  return { valuePct, bars };
}

function periodLabelOf(range: DashboardRange): string {
  return range === 7 ? "la semana anterior" : "el período anterior";
}

function activityView(sources: DashboardSources): ActivityView {
  let weeks = 0;
  const days = sources.metrics.daily.map((entry) => {
    const labels = dayLabels(entry.day);
    if (labels.isMonday) weeks += 1;
    return {
      day: entry.day,
      label: labels.label,
      fullLabel: labels.fullLabel,
      isMonday: labels.isMonday,
      weekLabel: `Sem ${Math.max(1, weeks)}`,
      flashcards: entry.reviews.flashcards,
      activeRecall: entry.reviews.recall,
      exams: entry.reviews.exam,
    };
  });
  const { reviewsCompleted, previousReviewsCompleted } =
    sources.metrics.overall;
  return {
    days,
    total: reviewsCompleted,
    deltaPct: deltaPercent(reviewsCompleted, previousReviewsCompleted),
    periodLabel: periodLabelOf(sources.range),
  };
}

function accuracyView(metrics: TechniqueMetricsReport): AccuracyView {
  const pooled = metrics.techniques.reduce(
    (sum, technique) => ({
      correct: sum.correct + technique.accuracy.correct,
      total: sum.total + technique.accuracy.total,
    }),
    { correct: 0, total: 0 },
  );
  return {
    overallPct:
      pooled.total === 0 ? null : percent(pooled.correct / pooled.total),
    techniques: metrics.techniques.map((technique) => {
      const { key, label, dotClass } = TECHNIQUES[technique.technique];
      const current = technique.accuracy.rate;
      const previous = technique.previousAccuracy.rate;
      return {
        key,
        label,
        dotClass,
        accuracyPct: current === null ? null : percent(current),
        deltaPts:
          current === null || previous === null
            ? null
            : percent(current) - percent(previous),
      };
    }),
  };
}

function kpisView(sources: DashboardSources): KpisView {
  const { streakDays, streakDaysWeekAgo } = sources.metrics.overall;
  const pages = sources.progress.pages;
  const due = pages.reduce((sum, page) => sum + page.itemsDue, 0);
  const pagesWithDue = pages.filter((page) => page.itemsDue > 0).length;
  const mastered = pages.filter((page) => page.level === "Dominado").length;
  return {
    streak: {
      value: plural(streakDays, "día", "días"),
      delta: streakDays - streakDaysWeekAgo,
    },
    due: {
      value: String(due),
      hint:
        due === 0
          ? "Sin repasos pendientes"
          : `en ${plural(pagesWithDue, "página", "páginas")}`,
    },
    mastered: {
      value: String(mastered),
      hint: `de ${plural(pages.length, "página", "páginas")}`,
    },
  };
}

function notebookRows(progress: Progress): NotebookProgressRow[] {
  return progress.notebooks.map((notebook) => ({
    notebookId: notebook.notebookId,
    title: notebook.title,
    // notebooks.color only ever holds a palette name (checked on write).
    color: notebook.color as NotebookColor | null,
    itemsTotal: notebook.itemsTotal,
    itemsDue: notebook.itemsDue,
    level: notebookLevel(notebook),
    avgScorePct: percent(notebook.averageScore ?? 0),
  }));
}

function calibrationRows(calibration: CalibrationRollup): CalibrationRow[] {
  return calibration.pages.map((page) => {
    const selfAvg = round1(page.selfAverage);
    const aiAvg = round1(page.aiAverage);
    return {
      id: page.pageId,
      pageTitle: page.pageTitle,
      notebookTitle: page.notebookTitle,
      selfAvg,
      aiAvg,
      // From the shown averages, so the three columns always add up.
      gap: round1(selfAvg - aiAvg),
      zone: calibrationZoneOf(page),
      href: `/active-recall/${page.notebookId}/${page.pageId}`,
    };
  });
}

function techniqueCards(sources: DashboardSources): TechniqueCardView[] {
  const { metrics } = sources;
  const periodLabel = periodLabelOf(sources.range);
  return metrics.techniques.map((technique) => {
    const meta = TECHNIQUES[technique.technique];
    const counts = metrics.daily.map((entry) => ({
      day: entry.day,
      count: entry.reviews[technique.technique],
    }));
    const rate = technique.accuracy.rate;
    return {
      key: meta.key,
      label: meta.label,
      reviewsCompleted: technique.reviewsCompleted,
      deltaPct: deltaPercent(
        technique.reviewsCompleted,
        technique.previousReviewsCompleted,
      ),
      periodLabel,
      streakDays: technique.streakDays,
      studiedDays: counts
        .slice(-STUDIED_DAYS_WINDOW)
        .map((entry) => entry.count > 0),
      recentActivity: counts.slice(-RECENT_ACTIVITY_DAYS).map((entry) => ({
        day: entry.day,
        label: dayLabels(entry.day).initial,
        count: entry.count,
      })),
      accuracyPct: rate === null ? null : percent(rate),
      colorVar: meta.colorVar,
      dotClass: meta.dotClass,
    };
  });
}

export function buildDashboardView(sources: DashboardSources): DashboardView {
  const { progress, metrics } = sources;
  const isEmpty =
    progress.pages.every((page) => page.itemsTotal === 0) &&
    metrics.overall.reviewsCompleted === 0 &&
    metrics.overall.previousReviewsCompleted === 0 &&
    metrics.overall.streakDays === 0 &&
    sources.calibration.totals.answers === 0;
  return {
    isEmpty,
    hero: heroView(sources),
    mastery: masteryView(progress),
    activity: activityView(sources),
    accuracy: accuracyView(metrics),
    kpis: kpisView(sources),
    notebooks: notebookRows(progress),
    calibration: calibrationRows(sources.calibration),
    techniques: techniqueCards(sources),
  };
}
