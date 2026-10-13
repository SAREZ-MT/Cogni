import {
  addDays,
  type DayKey,
  dayKeyFormatter,
  weekStartOf,
} from "./local-day";
import {
  emptyTechniqueCounts,
  type Technique,
  type TechniqueCounts,
} from "./technique";

// One review_logs row as the dashboard reads it: the graded answer's
// quality (0–5), its technique and the page it belongs to.
export interface ReviewFact {
  pageId: string;
  notebookId: string;
  technique: Technique;
  quality: number;
  reviewedAt: Date;
}

// One week of a trend (decision 2026-10-12, option A): the average quality
// of the reviews made that local week, null when there were none.
export interface WeeklyQuality {
  weekStart: DayKey;
  reviews: number;
  averageQuality: number | null;
}

// The reviews of one local day per technique ("Repasos completados").
export interface DailyReviews {
  day: DayKey;
  reviews: TechniqueCounts;
}

// The Mondays of the last `weeks` weeks, oldest first; the last one starts
// the week holding `today`.
export function trendWeekStarts(today: DayKey, weeks: number): DayKey[] {
  const current = weekStartOf(today);
  return Array.from({ length: weeks }, (_, index) =>
    addDays(current, (index - weeks + 1) * 7),
  );
}

// Weekly average quality per key (a page, a notebook) over `weekStarts`.
// A key with no review in any of the weeks has no entry.
export function weeklyQualityTrends(
  facts: readonly ReviewFact[],
  keyOf: (fact: ReviewFact) => string,
  options: { weekStarts: readonly DayKey[]; timeZone: string },
): Map<string, WeeklyQuality[]> {
  const dayOf = dayKeyFormatter(options.timeZone);
  const index = new Map(options.weekStarts.map((week, i) => [week, i]));
  const sums = new Map<string, { reviews: number; quality: number }[]>();
  for (const fact of facts) {
    const week = index.get(weekStartOf(dayOf(fact.reviewedAt)));
    if (week === undefined) continue;
    const key = keyOf(fact);
    const weeks =
      sums.get(key) ??
      options.weekStarts.map(() => ({ reviews: 0, quality: 0 }));
    const bucket = weeks[week] as { reviews: number; quality: number };
    bucket.reviews += 1;
    bucket.quality += fact.quality;
    sums.set(key, weeks);
  }
  const trends = new Map<string, WeeklyQuality[]>();
  for (const [key, weeks] of sums) {
    trends.set(
      key,
      weeks.map((bucket, i) => ({
        weekStart: options.weekStarts[i] as DayKey,
        reviews: bucket.reviews,
        averageQuality:
          bucket.reviews === 0 ? null : bucket.quality / bucket.reviews,
      })),
    );
  }
  return trends;
}

// The trend of a key without reviews in the weeks.
export function emptyTrend(weekStarts: readonly DayKey[]): WeeklyQuality[] {
  return weekStarts.map((weekStart) => ({
    weekStart,
    reviews: 0,
    averageQuality: null,
  }));
}

// Reviews per local day of `days` and technique; every day is listed.
export function dailyReviews(
  facts: readonly ReviewFact[],
  options: { days: readonly DayKey[]; timeZone: string },
): DailyReviews[] {
  const dayOf = dayKeyFormatter(options.timeZone);
  const byDay = new Map(
    options.days.map((day) => [day, emptyTechniqueCounts()]),
  );
  for (const fact of facts) {
    const counts = byDay.get(dayOf(fact.reviewedAt));
    if (counts) counts[fact.technique] += 1;
  }
  return [...byDay].map(([day, reviews]) => ({ day, reviews }));
}

export function countReviews(facts: readonly ReviewFact[]): TechniqueCounts {
  const counts = emptyTechniqueCounts();
  for (const fact of facts) counts[fact.technique] += 1;
  return counts;
}
