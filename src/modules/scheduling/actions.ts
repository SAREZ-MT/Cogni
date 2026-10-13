"use server";

import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { listDueToday } from "./application";
import { readCalendarDays } from "./calendar-days";
import type { CalendarDayPage } from "./domain/calendar";
import type { DueTodayPage } from "./domain/due-today";
import { SCHEDULING_ERROR } from "./domain/errors";
import { DrizzleDueTodayReader } from "./infrastructure";

// Server Actions of the scheduling module (documento-maestro §3.5): session
// first, every failure leaves as the plain ActionError shape, never throws.

export type DueTodayPageView = DueTodayPage;
export type CalendarDayPageView = CalendarDayPage;

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// "Repasos de hoy": the caller's pages with items due now, the page that has
// waited longest first.
export async function listDueTodayAction(): Promise<
  Result<DueTodayPageView[], ActionError>
> {
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
    const pages = await listDueToday(user.id, {
      reader: new DrizzleDueTodayReader(getDb()),
      clock: systemClock,
    });
    return ok(pages);
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

// "Mes" / "Semana": the caller's pages per local day of [fromDay, toDay)
// (ISO days in `timeZone`, the profile's zone), each with the items whose
// next due date falls that day; overdue items show on today. Client-
// reachable, so "today" always comes from the system clock: the input is
// reduced to the range and never carries a clock.
export async function listCalendarDaysAction(input: {
  fromDay: string;
  toDay: string;
  timeZone: string;
}): Promise<Result<CalendarDayPageView[], ActionError>> {
  return readCalendarDays(
    { fromDay: input.fromDay, toDay: input.toDay, timeZone: input.timeZone },
    systemClock,
  );
}
