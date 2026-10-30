// Server-side API other modules use to read the "Hoy" due list and the
// calendar days (exams' hub
// counts its due exam questions with it). A composition root like
// actions.ts, but with no "use server" directive: it is not a
// client-reachable entry point, and the caller supplies the owner it has
// already authenticated.
import type { DbExecutor } from "@/shared/db/client";
import { type Clock, systemClock } from "@/shared/kernel/clock";
import { listCalendarDays, listDueToday } from "./application";
import type { CalendarDayPage, DayKey } from "./domain/calendar";
import type { DueTodayPage } from "./domain/due-today";
import {
  DrizzleDueInRangeReader,
  DrizzleDueTodayReader,
} from "./infrastructure";

export interface SchedulingServerApi {
  // The owner's pages with study items due today in `timeZone` (the
  // profile's zone), the page that has waited longest first (same read as
  // listDueTodayAction; the zone is trusted here).
  listDueToday(
    ownerId: string,
    day: { timeZone: string },
  ): Promise<DueTodayPage[]>;
  // The owner's pages per local day of [fromDay, toDay) in `timeZone`
  // (same read as listCalendarDaysAction; the range is trusted here).
  listCalendarDays(
    ownerId: string,
    range: { fromDay: DayKey; toDay: DayKey; timeZone: string },
  ): Promise<CalendarDayPage[]>;
}

export function createSchedulingServerApi(deps: {
  db: DbExecutor;
  clock?: Clock;
}): SchedulingServerApi {
  const reader = new DrizzleDueTodayReader(deps.db);
  const rangeReader = new DrizzleDueInRangeReader(deps.db);
  const clock = deps.clock ?? systemClock;
  return {
    listDueToday: (ownerId, day) =>
      listDueToday({ ownerId, timeZone: day.timeZone }, { reader, clock }),
    listCalendarDays: (ownerId, range) =>
      listCalendarDays({ ownerId, ...range }, { reader: rangeReader, clock }),
  };
}
