import type { NotebookColor } from "@/modules/notebooks";
import type { LevelStripBar } from "@/shared/ui/level-strip";
import {
  MASTERY_LEVEL_LABEL,
  type MasteryLevel,
  masteryLevelFromScore,
} from "@/shared/ui/mastery-level";
import type { DashboardRange } from "@/shared/ui/period-filter";

// Fixed, DETERMINISTIC sample data for the `/dashboard` v2 design preview
// (route-local, same reasoning as flashcards/active-recall/exams'
// `_data/sample.ts`: presentation fixtures, not a domain module — no
// backend for PageMastery/ReviewLog exists yet). Every number below is a
// literal or a pure function of literals — no `Math.random()`/`Date.now()`
// at render, so server and client always agree (hydration-safe). The one
// `Date` object used (`TODAY_ANCHOR`) is a fixed sample-fixture date, never
// the real clock.
//
// Shapes follow documento-maestro §3.6/§3.4/§7.3/§7.4: page-level mastery
// (`DashboardPage` ~ PageMastery: level/score/itemsTotal/itemsDue),
// per-technique metrics (~ReviewLog aggregates) and calibration (self-rating
// vs. AI score, §7.4's exceso/falta rule).

export const SAMPLE_USER_NAME = "Valentina";

export interface DashboardNotebook {
  id: string;
  title: string;
  color: NotebookColor;
}

export const DASHBOARD_NOTEBOOKS: readonly DashboardNotebook[] = [
  { id: "biologia-celular", title: "Biología Celular", color: "purple" },
  { id: "calculo-iii", title: "Cálculo III", color: "blue" },
  { id: "historia-del-arte", title: "Historia del Arte", color: "orange" },
];

// Chart colour per notebook — existing Cogni tokens only, one step darker
// than each notebook's own pastel accent so it reads clearly as a chart
// stroke/dot.
export const NOTEBOOK_CHART_COLOR_VAR: Readonly<Record<string, string>> = {
  "biologia-celular": "var(--color-primary-600)",
  "calculo-iii": "var(--color-info-600)",
  "historia-del-arte": "var(--color-pastel-orange-fg)",
};

export interface DashboardPage {
  id: string;
  notebookId: string;
  title: string;
  score: number; // 0-1, documento-maestro §7.3
  itemsTotal: number;
  itemsDue: number;
  // 8 weekly mastery scores (0-1), oldest → newest — a pure ramp toward
  // `score`, never hand-typed per point. Used to derive "páginas dominadas
  // la semana pasada" without a second hand-maintained dataset.
  trend: readonly number[];
}

function rampSeries(final: number, length: number, spread: number): number[] {
  const start = Math.max(0, final - spread);
  return Array.from({ length }, (_, i) => {
    const t = length === 1 ? 1 : i / (length - 1);
    return Math.round((start + (final - start) * t) * 100) / 100;
  });
}

function page(
  notebookId: string,
  id: string,
  title: string,
  score: number,
  itemsTotal: number,
  itemsDue: number,
): DashboardPage {
  return {
    id,
    notebookId,
    title,
    score,
    itemsTotal,
    itemsDue,
    trend: itemsTotal === 0 ? Array(8).fill(0) : rampSeries(score, 8, 0.32),
  };
}

export const DASHBOARD_PAGES: readonly DashboardPage[] = [
  page("biologia-celular", "mitocondria", "Mitocondria", 0.82, 24, 2),
  page("biologia-celular", "membrana-celular", "Membrana celular", 0.74, 20, 0),
  page("biologia-celular", "ribosomas", "Ribosomas", 0.58, 16, 4),
  page("biologia-celular", "cloroplasto", "Cloroplasto", 0.31, 12, 6),
  page("biologia-celular", "fotosintesis", "Fotosíntesis", 0.45, 14, 3),
  page("biologia-celular", "nucleo", "Núcleo", 0.91, 18, 0),
  page("biologia-celular", "citoesqueleto", "Citoesqueleto", 0.18, 10, 5),
  page("biologia-celular", "apoptosis", "Apoptosis", 0, 0, 0),

  page(
    "calculo-iii",
    "derivadas-parciales",
    "Derivadas parciales",
    0.92,
    22,
    1,
  ),
  page("calculo-iii", "integrales-dobles", "Integrales dobles", 0.81, 18, 2),
  page("calculo-iii", "gradiente", "Gradiente", 0.55, 14, 5),
  page(
    "calculo-iii",
    "multiplicadores-lagrange",
    "Multiplicadores de Lagrange",
    0.78,
    16,
    2,
  ),
  page("calculo-iii", "series-taylor", "Series de Taylor", 0.85, 20, 1),
  page(
    "calculo-iii",
    "ecuaciones-diferenciales",
    "Ecuaciones diferenciales",
    0.68,
    12,
    3,
  ),

  page("historia-del-arte", "renacimiento", "Renacimiento", 0.42, 16, 5),
  page("historia-del-arte", "barroco", "Barroco", 0.3, 14, 6),
  page("historia-del-arte", "impresionismo", "Impresionismo", 0.22, 12, 6),
  page("historia-del-arte", "cubismo", "Cubismo", 0.28, 10, 5),
  page("historia-del-arte", "bauhaus", "Bauhaus", 0.12, 8, 6),
];

export function notebookPages(notebookId: string): DashboardPage[] {
  return DASHBOARD_PAGES.filter((p) => p.notebookId === notebookId);
}

// Per-notebook 12-week mastery curve (0-100 scale) — three explicit,
// clearly-distinct trajectories (Biología rising, Cálculo plateauing,
// Historia climbing late) instead of a flat ramp derived from page
// averages. Drives both "Dominio global" (Row 1) and each notebook's trend
// arrow (Row 6).
export const NOTEBOOK_WEEKLY_MASTERY: Readonly<
  Record<string, readonly number[]>
> = {
  "biologia-celular": [38, 41, 44, 48, 52, 55, 58, 62, 65, 68, 70, 72],
  "calculo-iii": [55, 57, 58, 60, 58, 54, 55, 57, 58, 59, 60, 60],
  "historia-del-arte": [20, 21, 22, 23, 24, 26, 28, 31, 35, 40, 44, 48],
};

function combinedWeeklyMasteryAvg(weekIndex: number): number {
  const values = DASHBOARD_NOTEBOOKS.map(
    (n) => NOTEBOOK_WEEKLY_MASTERY[n.id][weekIndex],
  );
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Row 1 (key insight) — "Dominio global": the combined weekly mastery
// average, one week's delta, and a `LevelStrip` bar per page sorted by
// score (weakest → strongest, left to right).
export function dominioGlobalInsight(): {
  valuePct: number;
  deltaPts: number;
  bars: readonly LevelStripBar[];
} {
  const lastIndex = NOTEBOOK_WEEKLY_MASTERY["biologia-celular"].length - 1;
  const current = combinedWeeklyMasteryAvg(lastIndex);
  const previous = combinedWeeklyMasteryAvg(lastIndex - 1);
  const bars: LevelStripBar[] = DASHBOARD_PAGES.slice()
    .sort((a, b) => a.score - b.score)
    .map((p) => ({
      id: p.id,
      label: p.title,
      level: masteryLevelFromScore(p.score, p.itemsTotal),
      score: p.score,
    }));
  return {
    valuePct: Math.round(current),
    deltaPts: Math.round(current - previous),
    bars,
  };
}

// Row 6 — "Progreso por cuaderno": one row per notebook, no per-level
// stacked bar in v2 — just totals, a mastery `Pill` and a 1-week trend
// arrow (from the same weekly curve `dominioGlobalInsight` reads).
export interface NotebookProgressRow {
  notebookId: string;
  title: string;
  color: NotebookColor;
  itemsTotal: number;
  itemsDue: number;
  level: MasteryLevel;
  avgScorePct: number;
  deltaPts: number;
}

export function notebookProgressRows(): NotebookProgressRow[] {
  const lastIndex = NOTEBOOK_WEEKLY_MASTERY["biologia-celular"].length - 1;
  return DASHBOARD_NOTEBOOKS.map((n) => {
    const pages = notebookPages(n.id);
    const itemsTotal = pages.reduce((sum, p) => sum + p.itemsTotal, 0);
    const itemsDue = pages.reduce((sum, p) => sum + p.itemsDue, 0);
    const avgScore = pages.length
      ? pages.reduce((sum, p) => sum + p.score, 0) / pages.length
      : 0;
    const weekly = NOTEBOOK_WEEKLY_MASTERY[n.id];
    return {
      notebookId: n.id,
      title: n.title,
      color: n.color,
      itemsTotal,
      itemsDue,
      level: masteryLevelFromScore(avgScore, itemsTotal),
      avgScorePct: Math.round(avgScore * 100),
      deltaPts: Math.round(weekly[lastIndex] - weekly[lastIndex - 1]),
    };
  });
}

// Hero feedback sentence — reuses `dominioGlobalInsight`'s delta and the
// weakest notebook from `notebookProgressRows`, so the greeting never
// drifts from the numbers shown lower on the page.
export function heroFeedback(): {
  deltaPts: number;
  weakestNotebookTitle: string;
  weakestLevelLabel: string;
} {
  const { deltaPts } = dominioGlobalInsight();
  const weakest = notebookProgressRows()
    .slice()
    .sort((a, b) => a.avgScorePct - b.avgScorePct)[0];
  return {
    deltaPts,
    weakestNotebookTitle: weakest?.title ?? "",
    weakestLevelLabel: weakest ? MASTERY_LEVEL_LABEL[weakest.level] : "",
  };
}

// ---------------------------------------------------------------------
// Row 3 — "Actividad de repaso" (main chart): 30 days of deterministic
// per-technique counts, sliced to the selected 7/15/30-day range.
// ---------------------------------------------------------------------

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
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

// Fixed sample "today" — jue 25 sep 2026, the same fixture date the rest of
// the app's design previews use. Never `Date.now()`.
const TODAY_ANCHOR = new Date(2026, 8, 25);

function dateAtOffset(offset: number): Date {
  const d = new Date(TODAY_ANCHOR.getTime());
  d.setDate(d.getDate() + offset);
  return d;
}

// Base reviews per weekday (index 0 = domingo … 6 = sábado), one array per
// technique — weekdays busier than weekends, exams rarer than flashcards.
const FLASHCARDS_WEEKDAY_BASE = [3, 8, 9, 7, 8, 6, 2] as const;
const ACTIVE_RECALL_WEEKDAY_BASE = [1, 4, 5, 4, 4, 3, 1] as const;
const EXAMS_WEEKDAY_BASE = [0, 1, 2, 1, 2, 1, 0] as const;

const DAY_WINDOW = 30;

// Deterministic recency ramp — a plain linear function of `offset` (never
// `Math.random()`): activity gradually builds from 1x thirty days ago to 2x
// today, so the widget shows a believable positive week-over-week trend.
function activityFactor(offset: number): number {
  return 1 + (DAY_WINDOW - 1 + offset) / (DAY_WINDOW - 1);
}

export interface DailyActivity {
  offset: number;
  label: string; // "lun 22"
  fullLabel: string; // "lun 22 sep"
  isMonday: boolean;
  weekLabel: string; // "Sem 3" — meaningful on Monday entries
  flashcards: number;
  activeRecall: number;
  exams: number;
}

export const DAILY_ACTIVITY: readonly DailyActivity[] = (() => {
  const entries: DailyActivity[] = [];
  let weekCounter = 0;
  for (let offset = -(DAY_WINDOW - 1); offset <= 0; offset++) {
    const date = dateAtOffset(offset);
    const weekday = date.getDay();
    const factor = activityFactor(offset);
    const isMonday = weekday === 1;
    if (isMonday) weekCounter += 1;
    entries.push({
      offset,
      label: `${WEEKDAY_SHORT[weekday]} ${date.getDate()}`,
      fullLabel: `${WEEKDAY_SHORT[weekday]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`,
      isMonday,
      weekLabel: `Sem ${Math.max(1, weekCounter)}`,
      flashcards: Math.round(FLASHCARDS_WEEKDAY_BASE[weekday] * factor),
      activeRecall: Math.round(ACTIVE_RECALL_WEEKDAY_BASE[weekday] * factor),
      exams: Math.round(EXAMS_WEEKDAY_BASE[weekday] * factor),
    });
  }
  return entries;
})();

export function activityForRange(range: DashboardRange): DailyActivity[] {
  return DAILY_ACTIVITY.slice(DAILY_ACTIVITY.length - range);
}

function activityTotal(day: DailyActivity): number {
  return day.flashcards + day.activeRecall + day.exams;
}

export interface ActivityChartInsight {
  days: readonly DailyActivity[];
  total: number;
  deltaPct: number;
  periodLabel: string;
}

export function activityChartInsight(
  range: DashboardRange,
): ActivityChartInsight {
  const days = activityForRange(range);
  const total = days.reduce((sum, d) => sum + activityTotal(d), 0);
  const previousDays = DAILY_ACTIVITY.slice(
    Math.max(0, DAILY_ACTIVITY.length - range * 2),
    DAILY_ACTIVITY.length - range,
  );
  const previousTotal = previousDays.reduce(
    (sum, d) => sum + activityTotal(d),
    0,
  );
  const deltaPct =
    previousTotal > 0
      ? Math.round(((total - previousTotal) / previousTotal) * 100)
      : 0;
  return {
    days,
    total,
    deltaPct,
    periodLabel: range === 7 ? "la semana anterior" : "el período anterior",
  };
}

// ---------------------------------------------------------------------
// Row 4 — "Tasa de acierto" ring + Row 8 — "Actividad por técnica".
// ---------------------------------------------------------------------

export type TechniqueKey = "flashcards" | "activeRecall" | "exams";

export interface TechniqueMetric {
  key: TechniqueKey;
  label: string;
  accuracyPct: number;
  accuracyDeltaPts: number;
  streakDays: number;
  studiedDays: readonly boolean[]; // 14 days, oldest → newest
  weeklyActivity: readonly number[]; // 7 values, mon → sun
  repasosDeltaPct: number;
  colorVar: string;
  dotClass: string;
}

export const TECHNIQUE_METRICS: readonly TechniqueMetric[] = [
  {
    key: "flashcards",
    label: "Flashcards",
    accuracyPct: 84,
    accuracyDeltaPts: 3,
    streakDays: 9,
    studiedDays: [
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
    ],
    weeklyActivity: [4, 6, 3, 7, 5, 8, 2],
    repasosDeltaPct: 12,
    colorVar: "var(--color-primary-600)",
    dotClass: "bg-primary-600",
  },
  {
    key: "activeRecall",
    label: "Active recall",
    accuracyPct: 71,
    accuracyDeltaPts: 5,
    streakDays: 6,
    studiedDays: [
      false,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
    ],
    weeklyActivity: [3, 2, 5, 4, 6, 3, 4],
    repasosDeltaPct: 9,
    colorVar: "var(--color-success-600)",
    dotClass: "bg-success-600",
  },
  {
    key: "exams",
    label: "Exámenes",
    accuracyPct: 63,
    accuracyDeltaPts: -2,
    streakDays: 3,
    studiedDays: [
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      true,
    ],
    weeklyActivity: [1, 0, 2, 1, 3, 0, 2],
    repasosDeltaPct: -4,
    colorVar: "var(--color-rose-600)",
    dotClass: "bg-rose-600",
  },
];

export function techniqueRepasosCompletados(metric: TechniqueMetric): number {
  return metric.weeklyActivity.reduce((sum, v) => sum + v, 0);
}

// Weighted (by weekly review volume) average accuracy across techniques.
export function accuracyRingInsight(): {
  overallPct: number;
  techniques: readonly TechniqueMetric[];
} {
  const totalWeight = TECHNIQUE_METRICS.reduce(
    (sum, t) => sum + techniqueRepasosCompletados(t),
    0,
  );
  const weightedSum = TECHNIQUE_METRICS.reduce(
    (sum, t) => sum + t.accuracyPct * techniqueRepasosCompletados(t),
    0,
  );
  return {
    overallPct: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0,
    techniques: TECHNIQUE_METRICS,
  };
}

// ---------------------------------------------------------------------
// Row 5 — KPI tiles: racha de repasos, ítems vencidos, páginas dominadas.
// ---------------------------------------------------------------------

// "Racha de repasos" (overall): the longest technique streak currently
// running (Flashcards' own 9-day streak) — there's no unified "studied
// that day, any technique" log in this sample model yet, so this is the
// honest upper bound rather than a fabricated combined counter.
export function rachaRepasosKpi(): { days: number; delta: number } {
  const best = TECHNIQUE_METRICS.reduce((max, t) =>
    t.streakDays > max.streakDays ? t : max,
  );
  return { days: best.streakDays, delta: 2 };
}

export function paginasDominadasKpi(): {
  value: number;
  total: number;
  delta: number;
} {
  const dominated = DASHBOARD_PAGES.filter(
    (p) => masteryLevelFromScore(p.score, p.itemsTotal) === "dominado",
  ).length;
  // 1-week lookback: was this page's score already ≥0.70 a week ago?
  const previousDominated = DASHBOARD_PAGES.filter((p) => {
    const idx = Math.max(0, p.trend.length - 2);
    return p.trend[idx] >= 0.7;
  }).length;
  return {
    value: dominated,
    total: DASHBOARD_PAGES.length,
    delta: dominated - previousDominated,
  };
}

export function itemsVencidosKpi(): { due: number; delta: number } {
  const due = DASHBOARD_PAGES.reduce((sum, p) => sum + p.itemsDue, 0);
  const previousDue = Math.round(due * 1.18);
  return { due, delta: due - previousDue };
}

// ---------------------------------------------------------------------
// Row 7 — "Calibración metacognitiva" table (documento-maestro §7.4).
// ---------------------------------------------------------------------

export type CalibrationZone = "exceso" | "falta" | "calibrado";

interface CalibrationSeed {
  id: string;
  notebookId: string;
  pageId: string;
  pageTitle: string;
  concept: string;
  selfRating: number;
  aiScore: number;
}

const CALIBRATION_SEEDS: readonly CalibrationSeed[] = [
  {
    id: "cal-1",
    notebookId: "biologia-celular",
    pageId: "cloroplasto",
    pageTitle: "Cloroplasto",
    concept: "Fase luminosa",
    selfRating: 5,
    aiScore: 1,
  },
  {
    id: "cal-2",
    notebookId: "biologia-celular",
    pageId: "citoesqueleto",
    pageTitle: "Citoesqueleto",
    concept: "Microtúbulos",
    selfRating: 4,
    aiScore: 1,
  },
  {
    id: "cal-3",
    notebookId: "calculo-iii",
    pageId: "gradiente",
    pageTitle: "Gradiente",
    concept: "Curvas de nivel",
    selfRating: 5,
    aiScore: 2,
  },
  {
    id: "cal-4",
    notebookId: "historia-del-arte",
    pageId: "bauhaus",
    pageTitle: "Bauhaus",
    concept: "Diseño funcional",
    selfRating: 4,
    aiScore: 2,
  },
  {
    id: "cal-5",
    notebookId: "biologia-celular",
    pageId: "nucleo",
    pageTitle: "Núcleo",
    concept: "Envoltura nuclear",
    selfRating: 1,
    aiScore: 5,
  },
  {
    id: "cal-6",
    notebookId: "calculo-iii",
    pageId: "derivadas-parciales",
    pageTitle: "Derivadas parciales",
    concept: "Regla de la cadena",
    selfRating: 1,
    aiScore: 4,
  },
  {
    id: "cal-7",
    notebookId: "historia-del-arte",
    pageId: "renacimiento",
    pageTitle: "Renacimiento",
    concept: "Perspectiva lineal",
    selfRating: 0,
    aiScore: 4,
  },
  {
    id: "cal-8",
    notebookId: "biologia-celular",
    pageId: "mitocondria",
    pageTitle: "Mitocondria",
    concept: "ATP sintasa",
    selfRating: 4,
    aiScore: 4,
  },
  {
    id: "cal-9",
    notebookId: "biologia-celular",
    pageId: "mitocondria",
    pageTitle: "Mitocondria",
    concept: "Matriz mitocondrial",
    selfRating: 3,
    aiScore: 3,
  },
  {
    id: "cal-10",
    notebookId: "biologia-celular",
    pageId: "membrana-celular",
    pageTitle: "Membrana celular",
    concept: "Ósmosis",
    selfRating: 3,
    aiScore: 4,
  },
  {
    id: "cal-11",
    notebookId: "biologia-celular",
    pageId: "membrana-celular",
    pageTitle: "Membrana celular",
    concept: "Transporte activo",
    selfRating: 4,
    aiScore: 4,
  },
  {
    id: "cal-12",
    notebookId: "biologia-celular",
    pageId: "ribosomas",
    pageTitle: "Ribosomas",
    concept: "Subunidades ribosomales",
    selfRating: 2,
    aiScore: 3,
  },
  {
    id: "cal-13",
    notebookId: "biologia-celular",
    pageId: "fotosintesis",
    pageTitle: "Fotosíntesis",
    concept: "Ciclo de Calvin",
    selfRating: 2,
    aiScore: 2,
  },
  {
    id: "cal-14",
    notebookId: "biologia-celular",
    pageId: "apoptosis",
    pageTitle: "Apoptosis",
    concept: "Caspasas",
    selfRating: 1,
    aiScore: 1,
  },
  {
    id: "cal-15",
    notebookId: "calculo-iii",
    pageId: "integrales-dobles",
    pageTitle: "Integrales dobles",
    concept: "Cambio de variables",
    selfRating: 3,
    aiScore: 3,
  },
  {
    id: "cal-16",
    notebookId: "calculo-iii",
    pageId: "integrales-dobles",
    pageTitle: "Integrales dobles",
    concept: "Coordenadas polares",
    selfRating: 4,
    aiScore: 3,
  },
  {
    id: "cal-17",
    notebookId: "calculo-iii",
    pageId: "multiplicadores-lagrange",
    pageTitle: "Multiplicadores de Lagrange",
    concept: "Optimización con restricciones",
    selfRating: 4,
    aiScore: 5,
  },
  {
    id: "cal-18",
    notebookId: "calculo-iii",
    pageId: "series-taylor",
    pageTitle: "Series de Taylor",
    concept: "Resto de Lagrange",
    selfRating: 2,
    aiScore: 2,
  },
  {
    id: "cal-19",
    notebookId: "calculo-iii",
    pageId: "ecuaciones-diferenciales",
    pageTitle: "Ecuaciones diferenciales",
    concept: "Variables separables",
    selfRating: 3,
    aiScore: 3,
  },
  {
    id: "cal-20",
    notebookId: "historia-del-arte",
    pageId: "barroco",
    pageTitle: "Barroco",
    concept: "Claroscuro",
    selfRating: 3,
    aiScore: 4,
  },
  {
    id: "cal-21",
    notebookId: "historia-del-arte",
    pageId: "barroco",
    pageTitle: "Barroco",
    concept: "Tenebrismo",
    selfRating: 4,
    aiScore: 4,
  },
  {
    id: "cal-22",
    notebookId: "historia-del-arte",
    pageId: "impresionismo",
    pageTitle: "Impresionismo",
    concept: "Pincelada suelta",
    selfRating: 2,
    aiScore: 3,
  },
  {
    id: "cal-23",
    notebookId: "historia-del-arte",
    pageId: "cubismo",
    pageTitle: "Cubismo",
    concept: "Cubismo analítico",
    selfRating: 3,
    aiScore: 2,
  },
  {
    id: "cal-24",
    notebookId: "historia-del-arte",
    pageId: "renacimiento",
    pageTitle: "Renacimiento",
    concept: "Sfumato",
    selfRating: 5,
    aiScore: 5,
  },
];

// documento-maestro §7.4: self ≥4 & ai ≤2 → exceso de confianza; self ≤1 &
// ai ≥4 → falta de confianza; otherwise calibrado. Applied to the
// per-page AVERAGE self/ai ratings below (table rows are one per page).
function calibrationZone(self: number, ai: number): CalibrationZone {
  if (self >= 4 && ai <= 2) return "exceso";
  if (self <= 1 && ai >= 4) return "falta";
  return "calibrado";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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

export function calibrationRows(): CalibrationRow[] {
  const byPage = new Map<
    string,
    {
      notebookId: string;
      pageId: string;
      pageTitle: string;
      selfSum: number;
      aiSum: number;
      count: number;
    }
  >();

  for (const seed of CALIBRATION_SEEDS) {
    const key = `${seed.notebookId}:${seed.pageId}`;
    const entry = byPage.get(key) ?? {
      notebookId: seed.notebookId,
      pageId: seed.pageId,
      pageTitle: seed.pageTitle,
      selfSum: 0,
      aiSum: 0,
      count: 0,
    };
    entry.selfSum += seed.selfRating;
    entry.aiSum += seed.aiScore;
    entry.count += 1;
    byPage.set(key, entry);
  }

  return Array.from(byPage.values()).map((entry) => {
    const notebook = DASHBOARD_NOTEBOOKS.find((n) => n.id === entry.notebookId);
    const selfAvg = round1(entry.selfSum / entry.count);
    const aiAvg = round1(entry.aiSum / entry.count);
    return {
      id: `${entry.notebookId}:${entry.pageId}`,
      pageTitle: entry.pageTitle,
      notebookTitle: notebook?.title ?? entry.notebookId,
      selfAvg,
      aiAvg,
      gap: round1(selfAvg - aiAvg),
      zone: calibrationZone(selfAvg, aiAvg),
      href: `/active-recall/${entry.notebookId}/${entry.pageId}`,
    };
  });
}

// ---------------------------------------------------------------------
// Row 9 — Fortalezas / puntos débiles (unchanged from v1).
// ---------------------------------------------------------------------

export interface ConceptEntry {
  id: string;
  label: string;
  notebookId: string;
  pageId: string;
  percent: number;
}

const CONCEPT_ENTRIES: readonly ConceptEntry[] = [
  {
    id: "concept-1",
    label: "Perspectiva lineal",
    notebookId: "historia-del-arte",
    pageId: "renacimiento",
    percent: 95,
  },
  {
    id: "concept-2",
    label: "Fosforilación oxidativa",
    notebookId: "biologia-celular",
    pageId: "mitocondria",
    percent: 92,
  },
  {
    id: "concept-3",
    label: "Regla de la cadena",
    notebookId: "calculo-iii",
    pageId: "derivadas-parciales",
    percent: 90,
  },
  {
    id: "concept-4",
    label: "Transporte activo",
    notebookId: "biologia-celular",
    pageId: "membrana-celular",
    percent: 88,
  },
  {
    id: "concept-5",
    label: "Multiplicadores de Lagrange",
    notebookId: "calculo-iii",
    pageId: "multiplicadores-lagrange",
    percent: 85,
  },
  {
    id: "concept-6",
    label: "Cubismo analítico",
    notebookId: "historia-del-arte",
    pageId: "cubismo",
    percent: 62,
  },
  {
    id: "concept-7",
    label: "Ecuaciones diferenciales",
    notebookId: "calculo-iii",
    pageId: "ecuaciones-diferenciales",
    percent: 55,
  },
  {
    id: "concept-8",
    label: "Series de Taylor",
    notebookId: "calculo-iii",
    pageId: "series-taylor",
    percent: 40,
  },
  {
    id: "concept-9",
    label: "Curvas de nivel",
    notebookId: "calculo-iii",
    pageId: "gradiente",
    percent: 34,
  },
  {
    id: "concept-10",
    label: "Diseño funcional (Bauhaus)",
    notebookId: "historia-del-arte",
    pageId: "bauhaus",
    percent: 31,
  },
  {
    id: "concept-11",
    label: "Microtúbulos",
    notebookId: "biologia-celular",
    pageId: "citoesqueleto",
    percent: 28,
  },
  {
    id: "concept-12",
    label: "Regulación de la apoptosis",
    notebookId: "biologia-celular",
    pageId: "apoptosis",
    percent: 20,
  },
];

export interface ConceptListItem {
  id: string;
  label: string;
  meta: string;
  percent: number;
  href: string;
}

function toConceptListItem(entry: ConceptEntry): ConceptListItem {
  const notebook = DASHBOARD_NOTEBOOKS.find((n) => n.id === entry.notebookId);
  const pageTitle =
    notebookPages(entry.notebookId).find((p) => p.id === entry.pageId)?.title ??
    entry.pageId;
  return {
    id: entry.id,
    label: entry.label,
    meta: `${notebook?.title ?? entry.notebookId} · ${pageTitle}`,
    percent: entry.percent,
    href: `/notebooks/${entry.notebookId}/pages/${entry.pageId}`,
  };
}

export function conceptStrengths(limit = 5): ConceptListItem[] {
  return CONCEPT_ENTRIES.slice()
    .sort((a, b) => b.percent - a.percent)
    .slice(0, limit)
    .map(toConceptListItem);
}

export function conceptWeaknesses(limit = 5): ConceptListItem[] {
  return CONCEPT_ENTRIES.slice()
    .sort((a, b) => a.percent - b.percent)
    .slice(0, limit)
    .map(toConceptListItem);
}
