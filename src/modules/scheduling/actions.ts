"use server";

import { systemClock } from "@/shared/kernel/clock";
import type { ActionError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import { readCalendarDays } from "./calendar-days";
import type { CalendarDayPage } from "./domain/calendar";
import type { DueTodayPage } from "./domain/due-today";
import type { TechniqueOverview } from "./domain/technique-overview";
import { readDueToday } from "./due-today-read";
import { readTechniqueOverview } from "./technique-overview";

// Server Actions of the scheduling module (documento-maestro §3.5): session
// first, every failure leaves as the plain ActionError shape, never throws.

export type DueTodayPageView = DueTodayPage;
export type CalendarDayPageView = CalendarDayPage;
export type TechniqueOverviewView = TechniqueOverview;

// "Repasos de hoy": the caller's pages with items due today (the local
// day of the profile's zone, read server-side), the page that has waited
// longest first. Takes no input: the zone and the clock never come from
// the client.
export async function listDueTodayAction(): Promise<
  Result<DueTodayPageView[], ActionError>
> {
  return readDueToday({}, systemClock);
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

// Home's technique cards: per technique, the caller's study units for today
// and the next due date from tomorrow on, in the profile's zone (read
// server-side). Takes no input: the zone and the clock never come from the
// client.
export async function getTechniqueOverviewAction(): Promise<
  Result<TechniqueOverviewView, ActionError>
> {
  return readTechniqueOverview({}, systemClock);
}
