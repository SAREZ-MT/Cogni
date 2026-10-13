// Server-side read behind the calendar's "Mes" and "Semana" views. Not a
// "use server" file: nothing here is client-reachable. The calendar page
// calls getCalendarDays with the instant it renders with, so the today
// cell it marks and the overdue items the read folds into today come from
// one clock; the Server Action (listCalendarDaysAction) reuses the same
// read with the system clock and never accepts a clock from its input.
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
import { listCalendarDays } from "./application";
import {
  addDays,
  type CalendarDayPage,
  FIRST_CALENDAR_DAY,
  isDayKey,
  isTimeZone,
  LAST_CALENDAR_DAY,
} from "./domain/calendar";
import { SCHEDULING_ERROR } from "./domain/errors";
import { DrizzleDueInRangeReader } from "./infrastructure";

export interface CalendarRangeInput {
  fromDay: string;
  toDay: string;
  timeZone: string;
}

// "Mes" spans at most six Monday-first weeks.
const MAX_RANGE_DAYS = 42;

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// A range must hold at least one day of the calendar window: the grids of
// its edge months reach a week past it, and with the 42-day cap every
// bound stays within four-digit years (no expanded-year keys downstream).
function isValidRange(input: {
  fromDay: unknown;
  toDay: unknown;
  timeZone: unknown;
}): input is CalendarRangeInput {
  return (
    isDayKey(input.fromDay) &&
    isDayKey(input.toDay) &&
    input.fromDay <= LAST_CALENDAR_DAY &&
    input.toDay > FIRST_CALENDAR_DAY &&
    input.fromDay < input.toDay &&
    input.toDay <= addDays(input.fromDay, MAX_RANGE_DAYS) &&
    isTimeZone(input.timeZone)
  );
}

// The caller's pages per local day of [fromDay, toDay) (ISO days in
// `timeZone`, the profile's zone), each with the items whose next due date
// falls that day; overdue items show on the clock's today. Session first;
// every failure leaves as the plain ActionError shape, never throws
// (Next.js control-flow errors are rethrown to the framework).
export async function readCalendarDays(
  input: CalendarRangeInput,
  clock: Clock,
): Promise<Result<CalendarDayPage[], ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return err(
        actionError(
          SCHEDULING_ERROR.SESSION_REQUIRED,
          "Debes iniciar sesión para continuar.",
        ),
      );
    }
    const range = {
      fromDay: input.fromDay,
      toDay: input.toDay,
      timeZone: input.timeZone,
    };
    if (!isValidRange(range)) {
      return err(
        actionError(SCHEDULING_ERROR.INVALID_RANGE, "invalid calendar range"),
      );
    }
    const days = await listCalendarDays(
      { ownerId: user.id, ...range },
      { reader: new DrizzleDueInRangeReader(getDb()), clock },
    );
    return ok(days);
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return err(
      actionError(
        SCHEDULING_ERROR.UNEXPECTED,
        "unexpected scheduling action failure",
      ),
    );
  }
}

// The calendar page's read: "today" is the day of `now` in `timeZone`, the
// same instant the page renders its today cell with.
export function getCalendarDays(
  input: CalendarRangeInput & { now: Date },
): Promise<Result<CalendarDayPage[], ActionError>> {
  return readCalendarDays(input, createFixedClock(input.now));
}
