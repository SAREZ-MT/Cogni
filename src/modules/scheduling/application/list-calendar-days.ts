import type { Clock } from "@/shared/kernel/clock";
import {
  type CalendarDayPage,
  type DayKey,
  dayKeyIn,
  groupCalendarDays,
  paddedRange,
} from "../domain/calendar";
import type { DueInRangeReader } from "../domain/due-in-range-reader";

export interface ListCalendarDaysDeps {
  reader: DueInRangeReader;
  clock: Clock;
}

export interface ListCalendarDaysInput {
  ownerId: string;
  // Local days [fromDay, toDay) in `timeZone` (the profile's zone).
  fromDay: DayKey;
  toDay: DayKey;
  timeZone: string;
}

// Overdue items have no lower bound: a range that holds today reads them
// all, and groupCalendarDays shows them on today.
const OVERDUE_FLOOR = new Date(0);

// "Mes" / "Semana" (documento-maestro §3.5): the owner's pages per local
// day with the items whose next due date falls that day. Past days stay
// empty — their items were either reviewed (history lives in review_logs)
// or are still pending and shown on today.
export async function listCalendarDays(
  input: ListCalendarDaysInput,
  deps: ListCalendarDaysDeps,
): Promise<CalendarDayPage[]> {
  const today = dayKeyIn(deps.clock.now(), input.timeZone);
  if (input.toDay <= today) return [];

  const holdsToday = input.fromDay <= today;
  const { from, to } = paddedRange(input.fromDay, input.toDay);
  const items = await deps.reader.listDueInRange(
    input.ownerId,
    holdsToday ? OVERDUE_FLOOR : from,
    to,
  );
  return groupCalendarDays(items, { timeZone: input.timeZone, today }).filter(
    (row) => row.day >= input.fromDay && row.day < input.toDay,
  );
}
