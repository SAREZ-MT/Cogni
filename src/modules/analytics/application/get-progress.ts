import type { MasteryLevel } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { addDays, dayKeyFormatter, paddedWindow } from "../domain/local-day";
import {
  buildProgress,
  type MasteryLevelName,
  type Progress,
} from "../domain/progress";
import type {
  PageProgressReader,
  ReviewHistoryReader,
} from "../domain/readers";
import { trendWeekStarts } from "../domain/review-activity";

// Compile-time guard: MasteryLevelName mirrors study-engine's MasteryLevel,
// so a new level breaks the build here instead of reading as unknown.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const levelsMatch: Same<MasteryLevelName, MasteryLevel> = true;
void levelsMatch;

export interface GetProgressDeps {
  pages: PageProgressReader;
  reviews: ReviewHistoryReader;
  clock: Clock;
}

export interface GetProgressInput {
  ownerId: string;
  // The profile's zone: weeks are local Monday-to-Sunday weeks.
  timeZone: string;
  // How many weeks the trends span, ending with the current week.
  weeks: number;
}

// "Progreso por cuaderno y por página" (documento-maestro §3.6): mastery
// level and score, total and due items now, and the weekly trend of the
// average review quality (decision 2026-10-12, option A).
export async function getProgress(
  input: GetProgressInput,
  deps: GetProgressDeps,
): Promise<Progress> {
  const now = deps.clock.now();
  const today = dayKeyFormatter(input.timeZone)(now);
  const weekStarts = trendWeekStarts(today, input.weeks);
  const { from, to } = paddedWindow(weekStarts[0] as string, addDays(today, 1));
  const [rows, reviews] = await Promise.all([
    deps.pages.listPageProgress(input.ownerId, now),
    deps.reviews.listReviews(input.ownerId, from, to),
  ]);
  return buildProgress(rows, reviews, {
    weekStarts,
    timeZone: input.timeZone,
  });
}
