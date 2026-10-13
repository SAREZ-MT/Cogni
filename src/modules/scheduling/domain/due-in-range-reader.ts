import type { CalendarItem, OverdueCount } from "./calendar";

// Read port behind the calendar ("Mes", "Semana"). Owner-scoped: another
// owner's items never appear. Both reads skip suspended items and items
// whose page or notebook is archived. Grouping by local day happens in the
// domain (groupCalendarDays), so the time zone never reaches SQL.
export interface DueInRangeReader {
  // Every item with `from <= due_at < to`, ordered by due_at, then page id.
  listDueInRange(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarItem[]>;
  // The items with `due_at < before`, counted per page and technique (all of
  // them are overdue and show on today, so the read is bounded by pages ×
  // techniques, not by the backlog). Ordered by each row's earliest due_at,
  // then page id, then technique.
  listOverdueCounts(ownerId: string, before: Date): Promise<OverdueCount[]>;
}
