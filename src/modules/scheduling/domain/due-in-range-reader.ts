import type { CalendarItem } from "./calendar";

// Read port behind the calendar ("Mes", "Semana"). Owner-scoped: another
// owner's items never appear. Returns every study item with `from <= due_at
// < to` that is not suspended and whose page and notebook are not archived,
// ordered by due_at, then page id. Grouping by local day happens in the
// domain (groupCalendarDays), so the time zone never reaches SQL.
export interface DueInRangeReader {
  listDueInRange(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarItem[]>;
}
