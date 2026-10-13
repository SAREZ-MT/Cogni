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

  // A range that holds today also shows every overdue item on today. The
  // ones inside the padded range come with the range read (they may belong
  // to an earlier day of the range); the ones before it are only counted,
  // per page and technique, so the read never grows with the backlog.
  const holdsToday = input.fromDay <= today;
  const { from, to } = paddedRange(input.fromDay, input.toDay);
  const [items, overdue] = await Promise.all([
    deps.reader.listDueInRange(input.ownerId, from, to),
    holdsToday ? deps.reader.listOverdueCounts(input.ownerId, from) : [],
  ]);
  return groupCalendarDays(items, {
    timeZone: input.timeZone,
    today,
    overdue,
  }).filter((row) => row.day >= input.fromDay && row.day < input.toDay);
}
