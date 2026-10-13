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
// system clock. The argument is untrusted (null and non-objects included):
// it goes to the shared reads unread, which check the session first and
// then parse it, reducing it to its fields so it never carries a clock.

export type ProgressView = Progress;
export type TechniqueMetricsView = TechniqueMetricsReport;
export type CalibrationView = CalibrationRollup;

export async function getProgressAction(
  input: ProgressInput,
): Promise<Result<ProgressView, ActionError>> {
  return readProgress(input, systemClock);
}

export async function getTechniqueMetricsAction(
  input: DashboardRangeInput,
): Promise<Result<TechniqueMetricsView, ActionError>> {
  return readTechniqueMetrics(input, systemClock);
}

export async function getCalibrationAction(
  input: DashboardRangeInput,
): Promise<Result<CalibrationView, ActionError>> {
  return readCalibration(input);
}
