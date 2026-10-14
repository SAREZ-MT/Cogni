import type {
  CalibrationRollup,
  Progress,
  TechniqueMetricsReport,
} from "@/modules/analytics";
import {
  buildDashboardView,
  type DashboardSources,
  type DashboardView,
} from "./dashboard-view";

// Deterministic analytics outputs for the dashboard's view-model and
// component tests (test-only: nothing in the route imports this file).
// "Today" is Tuesday 13 Oct 2026.

function dayKeys(lastDay: string, count: number): string[] {
  const end = Date.parse(`${lastDay}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(end - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

export function sampleProgress(): Progress {
  const trend = (a: number | null, b: number | null) => [
    { weekStart: "2026-10-05", reviews: a === null ? 0 : 4, averageQuality: a },
    { weekStart: "2026-10-12", reviews: b === null ? 0 : 4, averageQuality: b },
  ];
  return {
    weekStarts: ["2026-10-05", "2026-10-12"],
    notebooks: [
      {
        notebookId: "nb-cel",
        title: "Biología",
        color: "purple",
        pages: 3,
        itemsTotal: 30,
        itemsDue: 2,
        averageScore: 0.65,
        trend: trend(3.5, 4.1),
      },
      {
        notebookId: "nb-hist",
        title: "Historia",
        color: null,
        pages: 1,
        itemsTotal: 10,
        itemsDue: 3,
        averageScore: 0.2,
        trend: trend(null, 2),
      },
    ],
    pages: [
      {
        pageId: "p-cel1",
        pageTitle: "Mitocondria",
        notebookId: "nb-cel",
        level: "Dominado",
        score: 0.8,
        itemsTotal: 20,
        itemsDue: 2,
        trend: trend(3.5, 4.1),
      },
      {
        pageId: "p-cel2",
        pageTitle: "Membrana",
        notebookId: "nb-cel",
        level: "Consolidando",
        score: 0.5,
        itemsTotal: 10,
        itemsDue: 0,
        trend: trend(null, null),
      },
      {
        pageId: "p-empty",
        pageTitle: "Apuntes sueltos",
        notebookId: "nb-cel",
        level: "Nuevo",
        score: 0,
        itemsTotal: 0,
        itemsDue: 0,
        trend: trend(null, null),
      },
      {
        pageId: "p-hist",
        pageTitle: "Renacimiento",
        notebookId: "nb-hist",
        level: "Aprendiendo",
        score: 0.2,
        itemsTotal: 10,
        itemsDue: 3,
        trend: trend(null, 2),
      },
    ],
  };
}

// The last `range` days end today; flashcards were reviewed on the last
// four of them (3 today), recall and exams once today.
export function sampleMetrics(range = 7): TechniqueMetricsReport {
  const days = dayKeys("2026-10-13", range);
  const daily = days.map((day, index) => {
    const fromEnd = days.length - 1 - index;
    return {
      day,
      reviews: {
        flashcards: fromEnd === 0 ? 3 : fromEnd < 4 ? 1 + (fromEnd % 2) : 0,
        recall: fromEnd === 0 ? 1 : 0,
        exam: fromEnd === 0 ? 1 : 0,
      },
    };
  });
  return {
    today: "2026-10-13",
    range: { fromDay: days[0] as string, toDay: "2026-10-14" },
    // The same length right before the range.
    previousRange: {
      fromDay: dayKeys("2026-10-13", 2 * range)[0] as string,
      toDay: days[0] as string,
    },
    daily,
    overall: {
      reviewsCompleted: 10,
      previousReviewsCompleted: 8,
      streakDays: 4,
      streakDaysWeekAgo: 2,
    },
    techniques: [
      {
        technique: "flashcards",
        reviewsCompleted: 8,
        previousReviewsCompleted: 4,
        accuracy: { correct: 6, total: 8, rate: 0.75 },
        previousAccuracy: { correct: 2, total: 4, rate: 0.5 },
        streakDays: 4,
      },
      {
        technique: "recall",
        reviewsCompleted: 1,
        previousReviewsCompleted: 0,
        accuracy: { correct: 2, total: 4, rate: 0.5 },
        previousAccuracy: { correct: 0, total: 0, rate: null },
        streakDays: 1,
      },
      {
        technique: "exam",
        reviewsCompleted: 1,
        previousReviewsCompleted: 4,
        accuracy: { correct: 1, total: 2, rate: 0.5 },
        previousAccuracy: { correct: 1, total: 1, rate: 1 },
        streakDays: 1,
      },
    ],
  };
}

export function sampleCalibration(): CalibrationRollup {
  return {
    pages: [
      {
        pageId: "p-hist",
        pageTitle: "Renacimiento",
        notebookId: "nb-hist",
        notebookTitle: "Historia",
        answers: 3,
        overconfident: 2,
        underconfident: 0,
        calibrated: 1,
        selfAverage: 11 / 3,
        aiAverage: 7 / 3,
      },
      {
        pageId: "p-cel1",
        pageTitle: "Mitocondria",
        notebookId: "nb-cel",
        notebookTitle: "Biología",
        answers: 2,
        overconfident: 0,
        underconfident: 0,
        calibrated: 2,
        selfAverage: 3.5,
        aiAverage: 4,
      },
    ],
    totals: { answers: 5, overconfident: 2, underconfident: 0, calibrated: 3 },
  };
}

export function sampleSources(): DashboardSources {
  return {
    progress: sampleProgress(),
    metrics: sampleMetrics(),
    calibration: sampleCalibration(),
    range: 7,
    hour: 9,
    userName: "Ana",
  };
}

export function emptySources(): DashboardSources {
  const metrics = sampleMetrics();
  return {
    progress: {
      weekStarts: ["2026-10-05", "2026-10-12"],
      notebooks: [],
      pages: [],
    },
    metrics: {
      ...metrics,
      daily: metrics.daily.map((day) => ({
        day: day.day,
        reviews: { flashcards: 0, recall: 0, exam: 0 },
      })),
      overall: {
        reviewsCompleted: 0,
        previousReviewsCompleted: 0,
        streakDays: 0,
        streakDaysWeekAgo: 0,
      },
      techniques: metrics.techniques.map((technique) => ({
        ...technique,
        reviewsCompleted: 0,
        previousReviewsCompleted: 0,
        accuracy: { correct: 0, total: 0, rate: null },
        previousAccuracy: { correct: 0, total: 0, rate: null },
        streakDays: 0,
      })),
    },
    calibration: {
      pages: [],
      totals: {
        answers: 0,
        overconfident: 0,
        underconfident: 0,
        calibrated: 0,
      },
    },
    range: 7,
    hour: 9,
    userName: "Ana",
  };
}

export function sampleView(): DashboardView {
  return buildDashboardView(sampleSources());
}

export function emptyView(): DashboardView {
  return buildDashboardView(emptySources());
}
