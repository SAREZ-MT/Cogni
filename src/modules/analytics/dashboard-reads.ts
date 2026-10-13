// Server-side reads behind the dashboard (documento-maestro §3.6). Not a
// "use server" file: nothing here is client-reachable. The dashboard page
// calls the getDashboard* reads with the instant it renders with, so the
// "today" of streaks and trend weeks matches what the page shows; the
// Server Actions (actions.ts) reuse the same reads with the system clock
// and never accept a clock from their input.
import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { type Clock, createFixedClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  getCalibration,
  getProgress,
  getTechniqueMetrics,
  type TechniqueMetricsReport,
} from "./application";
import type { CalibrationRollup } from "./domain/calibration";
import { ANALYTICS_ERROR } from "./domain/errors";
import { isAnalyticsRange, isTimeZone } from "./domain/local-day";
import type { Progress } from "./domain/progress";
import {
  DrizzleAnswerOutcomeReader,
  DrizzlePageProgressReader,
  DrizzleReviewHistoryReader,
} from "./infrastructure";

export interface ProgressInput {
  // The profile's zone.
  timeZone: string;
  // Weeks of trend, ending with the current week (1–26).
  weeks: number;
}

export interface DashboardRangeInput {
  // Local days [fromDay, toDay) in `timeZone` (the profile's zone).
  fromDay: string;
  toDay: string;
  timeZone: string;
}

export const MAX_TREND_WEEKS = 26;
// A quarter at most: the dashboard offers 7, 15 and 30 days, and every
// read also covers the period of the same length before it.
export const MAX_RANGE_DAYS = 92;

const SESSION_REQUIRED_MESSAGE = "Debes iniciar sesión para continuar.";
const INVALID_INPUT_MESSAGE = "El período o la zona horaria no son válidos.";
const UNEXPECTED_MESSAGE =
  "No pudimos cargar tus métricas. Inténtalo de nuevo.";

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// Session first, then the input check, then the read. Every failure leaves
// as the plain ActionError shape, never throws; Next.js control-flow
// errors go back to the framework. The input is untrusted (Server Actions
// receive whatever the client posts, null included), so it is parsed
// inside the guarded path and reduced to its known fields.
async function forCurrentOwner<I, T>(
  input: unknown,
  parse: (input: unknown) => I | null,
  read: (ownerId: string, input: I) => Promise<T>,
): Promise<Result<T, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return err(
        actionError(ANALYTICS_ERROR.SESSION_REQUIRED, SESSION_REQUIRED_MESSAGE),
      );
    }
    const parsed = parse(input);
    if (parsed === null) {
      return err(
        actionError(ANALYTICS_ERROR.INVALID_INPUT, INVALID_INPUT_MESSAGE),
      );
    }
    return ok(await read(user.id, parsed));
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return err(actionError(ANALYTICS_ERROR.UNEXPECTED, UNEXPECTED_MESSAGE));
  }
}

function fieldsOf(input: unknown): Record<string, unknown> | null {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : null;
}

function parseProgressInput(input: unknown): ProgressInput | null {
  const fields = fieldsOf(input);
  if (!fields) return null;
  const { timeZone, weeks } = fields;
  return typeof timeZone === "string" &&
    isTimeZone(timeZone) &&
    typeof weeks === "number" &&
    Number.isInteger(weeks) &&
    weeks >= 1 &&
    weeks <= MAX_TREND_WEEKS
    ? { timeZone, weeks }
    : null;
}

function parseRangeInput(input: unknown): DashboardRangeInput | null {
  const fields = fieldsOf(input);
  if (!fields) return null;
  const { fromDay, toDay, timeZone } = fields;
  return typeof fromDay === "string" &&
    typeof toDay === "string" &&
    typeof timeZone === "string" &&
    isAnalyticsRange(fromDay, toDay, MAX_RANGE_DAYS) &&
    isTimeZone(timeZone)
    ? { fromDay, toDay, timeZone }
    : null;
}

export function readProgress(
  input: ProgressInput,
  clock: Clock,
): Promise<Result<Progress, ActionError>> {
  return forCurrentOwner(input, parseProgressInput, (ownerId, valid) => {
    const db = getDb();
    return getProgress(
      { ownerId, timeZone: valid.timeZone, weeks: valid.weeks },
      {
        pages: new DrizzlePageProgressReader(db),
        reviews: new DrizzleReviewHistoryReader(db),
        clock,
      },
    );
  });
}

export function readTechniqueMetrics(
  input: DashboardRangeInput,
  clock: Clock,
): Promise<Result<TechniqueMetricsReport, ActionError>> {
  return forCurrentOwner(input, parseRangeInput, (ownerId, valid) => {
    const db = getDb();
    return getTechniqueMetrics(
      { ownerId, ...valid },
      {
        reviews: new DrizzleReviewHistoryReader(db),
        answers: new DrizzleAnswerOutcomeReader(db),
        clock,
      },
    );
  });
}

export function readCalibration(
  input: DashboardRangeInput,
): Promise<Result<CalibrationRollup, ActionError>> {
  return forCurrentOwner(input, parseRangeInput, (ownerId, valid) =>
    getCalibration(
      { ownerId, ...valid },
      { answers: new DrizzleAnswerOutcomeReader(getDb()) },
    ),
  );
}

// "Progreso por cuaderno y por página" with the page's render instant.
export function getDashboardProgress(
  input: ProgressInput & { now: Date },
): Promise<Result<Progress, ActionError>> {
  return readProgress(input, createFixedClock(input.now));
}

// "Métricas por técnica" with the page's render instant.
export function getDashboardTechniqueMetrics(
  input: DashboardRangeInput & { now: Date },
): Promise<Result<TechniqueMetricsReport, ActionError>> {
  return readTechniqueMetrics(input, createFixedClock(input.now));
}

// "Calibración metacognitiva" (needs no clock: the range is explicit).
export function getDashboardCalibration(
  input: DashboardRangeInput,
): Promise<Result<CalibrationRollup, ActionError>> {
  return readCalibration(input);
}
