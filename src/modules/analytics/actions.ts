"use server";

import { systemClock } from "@/shared/kernel/clock";
import type { ActionError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { TechniqueMetricsReport } from "./application";
import {
  type DashboardRangeInput,
  type ProgressInput,
  readCalibration,
  readProgress,
  readTechniqueMetrics,
} from "./dashboard-reads";
import type { CalibrationRollup } from "./domain/calibration";
import type { Progress } from "./domain/progress";

// Server Actions of the analytics module (documento-maestro §3.6): session
// first, every failure leaves as the plain ActionError shape with Spanish
// copy, never throws. Client-reachable, so "today" always comes from the
// system clock: each input is reduced to its fields and never carries a
// clock.

export type ProgressView = Progress;
export type TechniqueMetricsView = TechniqueMetricsReport;
export type CalibrationView = CalibrationRollup;

export async function getProgressAction(
  input: ProgressInput,
): Promise<Result<ProgressView, ActionError>> {
  return readProgress(
    { timeZone: input.timeZone, weeks: input.weeks },
    systemClock,
  );
}

export async function getTechniqueMetricsAction(
  input: DashboardRangeInput,
): Promise<Result<TechniqueMetricsView, ActionError>> {
  return readTechniqueMetrics(
    { fromDay: input.fromDay, toDay: input.toDay, timeZone: input.timeZone },
    systemClock,
  );
}

export async function getCalibrationAction(
  input: DashboardRangeInput,
): Promise<Result<CalibrationView, ActionError>> {
  return readCalibration({
    fromDay: input.fromDay,
    toDay: input.toDay,
    timeZone: input.timeZone,
  });
}
