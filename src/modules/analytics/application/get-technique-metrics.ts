import type { SessionKind } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import {
  type AccuracyTally,
  accuracyRate,
  examAccuracy,
  flashcardAccuracy,
  recallAccuracy,
} from "../domain/accuracy";
import {
  addDays,
  type DayKey,
  dayKeyFormatter,
  daysBetween,
  paddedWindow,
} from "../domain/local-day";
import { previousRange, splitPeriods } from "../domain/periods";
import type {
  AnswerOutcomeReader,
  ReviewHistoryReader,
} from "../domain/readers";
import {
  countReviews,
  type DailyReviews,
  dailyReviews,
} from "../domain/review-activity";
import { currentStreak, reviewDays } from "../domain/streak";
import { ANALYTICS_TECHNIQUES, type Technique } from "../domain/technique";

// Compile-time guard: Technique mirrors study-engine's SessionKind (the
// review_logs.session_kind values), so a new technique breaks the build
// here instead of silently counting 0.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const techniquesMatch: Same<Technique, SessionKind> = true;
void techniquesMatch;

export interface GetTechniqueMetricsDeps {
  reviews: ReviewHistoryReader;
  answers: AnswerOutcomeReader;
  clock: Clock;
}

export interface GetTechniqueMetricsInput {
  ownerId: string;
  // Local days [fromDay, toDay) in `timeZone` (the profile's zone).
  fromDay: DayKey;
  toDay: DayKey;
  timeZone: string;
}

export interface AccuracySummary extends AccuracyTally {
  // correct / total, null without outcomes.
  rate: number | null;
}

export interface TechniqueMetrics {
  technique: Technique;
  // "Repasos completados": review_logs rows of the technique.
  reviewsCompleted: number;
  previousReviewsCompleted: number;
  accuracy: AccuracySummary;
  previousAccuracy: AccuracySummary;
  // Consecutive local days with a review of the technique, up to today.
  streakDays: number;
}

export interface TechniqueMetricsReport {
  today: DayKey;
  range: { fromDay: DayKey; toDay: DayKey };
  // Same length, right before `range` (the "vs." comparison).
  previousRange: { fromDay: DayKey; toDay: DayKey };
  // Reviews per day of `range` and technique.
  daily: DailyReviews[];
  overall: {
    reviewsCompleted: number;
    previousReviewsCompleted: number;
    streakDays: number;
    // The overall streak as it stood seven local days before today: only
    // review days up to that day count (the dashboard's "Racha" delta).
    streakDaysWeekAgo: number;
  };
  // In the techniques panel order: flashcards, recall, exam.
  techniques: TechniqueMetrics[];
}

function summary(tally: AccuracyTally): AccuracySummary {
  return { ...tally, rate: accuracyRate(tally) };
}

// "Métricas por técnica" (documento-maestro §3.6, decisions 2026-10-12):
// reviews completed, accuracy and streak per technique, for the range and
// the one before it. Accuracy: flashcards = reviews with quality ≥ 3,
// exams = correct answers, recall = evaluated answers with AI score ≥ 3.
export async function getTechniqueMetrics(
  input: GetTechniqueMetricsInput,
  deps: GetTechniqueMetricsDeps,
): Promise<TechniqueMetricsReport> {
  const { ownerId, fromDay, toDay, timeZone } = input;
  const today = dayKeyFormatter(timeZone)(deps.clock.now());
  const previous = previousRange(fromDay, toDay);
  const { from, to } = paddedWindow(previous.fromDay, toDay);
  const [reviews, buckets, examAnswers, recallAnswers] = await Promise.all([
    deps.reviews.listReviews(ownerId, from, to),
    deps.reviews.listReviewBuckets(ownerId),
    deps.answers.listExamAnswers(ownerId, from, to),
    deps.answers.listRecallAnswers(ownerId, from, to),
  ]);

  const periods = {
    previousFromDay: previous.fromDay,
    fromDay,
    toDay,
    timeZone,
  };
  const reviewPeriods = splitPeriods(reviews, (r) => r.reviewedAt, periods);
  const examPeriods = splitPeriods(examAnswers, (a) => a.answeredAt, periods);
  const recallPeriods = splitPeriods(
    recallAnswers,
    (a) => a.answeredAt,
    periods,
  );
  const ofTechnique = (facts: typeof reviews, technique: Technique) =>
    facts.filter((fact) => fact.technique === technique);
  const accuracyOf = (
    technique: Technique,
    period: "current" | "previous",
  ): AccuracySummary => {
    if (technique === "flashcards") {
      return summary(
        flashcardAccuracy(ofTechnique(reviewPeriods[period], technique)),
      );
    }
    if (technique === "exam") return summary(examAccuracy(examPeriods[period]));
    return summary(recallAccuracy(recallPeriods[period]));
  };

  const current = countReviews(reviewPeriods.current);
  const before = countReviews(reviewPeriods.previous);
  const days = reviewDays(buckets, timeZone);

  return {
    today,
    range: { fromDay, toDay },
    previousRange: previous,
    daily: dailyReviews(reviewPeriods.current, {
      days: daysBetween(fromDay, toDay),
      timeZone,
    }),
    overall: {
      reviewsCompleted: reviewPeriods.current.length,
      previousReviewsCompleted: reviewPeriods.previous.length,
      streakDays: currentStreak(days.overall, today),
      streakDaysWeekAgo: currentStreak(days.overall, addDays(today, -7)),
    },
    techniques: ANALYTICS_TECHNIQUES.map((technique) => ({
      technique,
      reviewsCompleted: current[technique],
      previousReviewsCompleted: before[technique],
      accuracy: accuracyOf(technique, "current"),
      previousAccuracy: accuracyOf(technique, "previous"),
      streakDays: currentStreak(days.byTechnique[technique], today),
    })),
  };
}
