// Server-side API other modules use to read the dashboard metrics. A
// composition root like actions.ts, but with no "use server" directive: it
// is not a client-reachable entry point, and the caller supplies the owner
// it has already authenticated and a range it has already validated.
import type { DbExecutor } from "@/shared/db/client";
import { type Clock, systemClock } from "@/shared/kernel/clock";
import {
  getCalibration,
  getProgress,
  getTechniqueMetrics,
  type TechniqueMetricsReport,
} from "./application";
import type { CalibrationRollup } from "./domain/calibration";
import type { DayKey } from "./domain/local-day";
import type { Progress } from "./domain/progress";
import {
  DrizzleAnswerOutcomeReader,
  DrizzlePageProgressReader,
  DrizzleReviewHistoryReader,
} from "./infrastructure";

export interface AnalyticsRange {
  fromDay: DayKey;
  toDay: DayKey;
  timeZone: string;
}

export interface AnalyticsServerApi {
  getProgress(
    ownerId: string,
    input: { timeZone: string; weeks: number },
  ): Promise<Progress>;
  getTechniqueMetrics(
    ownerId: string,
    range: AnalyticsRange,
  ): Promise<TechniqueMetricsReport>;
  getCalibration(
    ownerId: string,
    range: AnalyticsRange,
  ): Promise<CalibrationRollup>;
}

export function createAnalyticsServerApi(deps: {
  db: DbExecutor;
  clock?: Clock;
}): AnalyticsServerApi {
  const reviews = new DrizzleReviewHistoryReader(deps.db);
  const pages = new DrizzlePageProgressReader(deps.db);
  const answers = new DrizzleAnswerOutcomeReader(deps.db);
  const clock = deps.clock ?? systemClock;
  return {
    getProgress: (ownerId, input) =>
      getProgress({ ownerId, ...input }, { pages, reviews, clock }),
    getTechniqueMetrics: (ownerId, range) =>
      getTechniqueMetrics({ ownerId, ...range }, { reviews, answers, clock }),
    getCalibration: (ownerId, range) =>
      getCalibration({ ownerId, ...range }, { answers }),
  };
}
