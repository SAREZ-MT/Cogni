import type { DayKey } from "./local-day";
import {
  emptyTrend,
  type ReviewFact,
  type WeeklyQuality,
  weeklyQualityTrends,
} from "./review-activity";

// "Progreso por cuaderno y por página" (§3.6): mastery level, trend, total
// and due items.

// Mirror of study-engine's MasteryLevel, checked at compile time in
// application/get-progress.ts.
export type MasteryLevelName =
  | "Nuevo"
  | "Aprendiendo"
  | "Consolidando"
  | "Dominado";

// One live page as the reader returns it. `level`/`score` come from
// page_mastery and are null for a page never reviewed; the item counts are
// live (non-suspended items, and those due now).
export interface PageProgressRow {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
  level: MasteryLevelName | null;
  score: number | null;
  itemsTotal: number;
  itemsDue: number;
}

export interface PageProgress {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  level: MasteryLevelName;
  score: number;
  itemsTotal: number;
  itemsDue: number;
  trend: WeeklyQuality[];
}

export interface NotebookProgress {
  notebookId: string;
  title: string;
  color: string | null;
  pages: number;
  itemsTotal: number;
  itemsDue: number;
  // Average mastery score (0–1) of the notebook's pages with items; null
  // while none has items.
  averageScore: number | null;
  trend: WeeklyQuality[];
}

export interface Progress {
  weekStarts: DayKey[];
  notebooks: NotebookProgress[];
  pages: PageProgress[];
}

// Pages and notebooks keep the reader's order (notebook position, then
// page position).
export function buildProgress(
  rows: readonly PageProgressRow[],
  reviews: readonly ReviewFact[],
  options: { weekStarts: readonly DayKey[]; timeZone: string },
): Progress {
  const pageTrends = weeklyQualityTrends(
    reviews,
    (fact) => fact.pageId,
    options,
  );
  const notebookTrends = weeklyQualityTrends(
    reviews,
    (fact) => fact.notebookId,
    options,
  );
  const trendOf = (trends: Map<string, WeeklyQuality[]>, key: string) =>
    trends.get(key) ?? emptyTrend(options.weekStarts);

  const pages: PageProgress[] = rows.map((row) => ({
    pageId: row.pageId,
    pageTitle: row.pageTitle,
    notebookId: row.notebookId,
    level: row.level ?? "Nuevo",
    score: row.score ?? 0,
    itemsTotal: row.itemsTotal,
    itemsDue: row.itemsDue,
    trend: trendOf(pageTrends, row.pageId),
  }));

  const notebooks = new Map<
    string,
    { notebook: NotebookProgress; scoreSum: number; scored: number }
  >();
  for (const [index, row] of rows.entries()) {
    const entry = notebooks.get(row.notebookId) ?? {
      notebook: {
        notebookId: row.notebookId,
        title: row.notebookTitle,
        color: row.notebookColor,
        pages: 0,
        itemsTotal: 0,
        itemsDue: 0,
        averageScore: null,
        trend: trendOf(notebookTrends, row.notebookId),
      },
      scoreSum: 0,
      scored: 0,
    };
    entry.notebook.pages += 1;
    entry.notebook.itemsTotal += row.itemsTotal;
    entry.notebook.itemsDue += row.itemsDue;
    if (row.itemsTotal > 0) {
      entry.scoreSum += (pages[index] as PageProgress).score;
      entry.scored += 1;
    }
    notebooks.set(row.notebookId, entry);
  }

  return {
    weekStarts: [...options.weekStarts],
    pages,
    notebooks: [...notebooks.values()].map(
      ({ notebook, scoreSum, scored }) => ({
        ...notebook,
        averageScore: scored === 0 ? null : scoreSum / scored,
      }),
    ),
  };
}
