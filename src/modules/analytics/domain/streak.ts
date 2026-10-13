import { addDays, type DayKey, dayKeyFormatter } from "./local-day";
import { ANALYTICS_TECHNIQUES, type Technique } from "./technique";

// One stretch of review activity as the reader returns it: the start of a
// 15-minute UTC bucket with at least one review of the technique. Every
// UTC offset in use is a multiple of 15 minutes, so a bucket never spans
// two local days, and the read stays bounded by the time spent reviewing
// rather than by the number of reviews.
export interface ReviewBucket {
  technique: Technique;
  startsAt: Date;
}

export interface ReviewDays {
  overall: Set<DayKey>;
  byTechnique: Record<Technique, Set<DayKey>>;
}

// The local days (in `timeZone`) with at least one review, overall and
// per technique.
export function reviewDays(
  buckets: readonly ReviewBucket[],
  timeZone: string,
): ReviewDays {
  const dayOf = dayKeyFormatter(timeZone);
  const days: ReviewDays = {
    overall: new Set(),
    byTechnique: Object.fromEntries(
      ANALYTICS_TECHNIQUES.map((technique) => [technique, new Set<DayKey>()]),
    ) as Record<Technique, Set<DayKey>>,
  };
  for (const bucket of buckets) {
    const day = dayOf(bucket.startsAt);
    days.overall.add(day);
    days.byTechnique[bucket.technique].add(day);
  }
  return days;
}

// The current "racha" (§3.6): consecutive local days with at least one
// review, ending today. Today still counts as open, so a streak that ran
// until yesterday stays alive until today ends without a review.
export function currentStreak(
  days: ReadonlySet<DayKey>,
  today: DayKey,
): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
