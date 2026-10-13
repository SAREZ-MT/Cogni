import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { notebooks, pages, studyItems } from "@/shared/db/schema";
import type { CalendarItem } from "../domain/calendar";
import type { DueInRangeReader } from "../domain/due-in-range-reader";

// Drizzle implementation of DueInRangeReader: one owner-scoped range read
// over study_items (served by the (owner_id, due_at) index) joined to the
// page and notebook. It returns items ungrouped: day bucketing in the
// profile's zone is domain logic (groupCalendarDays), not SQL.
export class DrizzleDueInRangeReader implements DueInRangeReader {
  constructor(private readonly db: DbExecutor) {}

  async listDueInRange(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarItem[]> {
    return this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        kind: studyItems.kind,
        dueAt: studyItems.dueAt,
      })
      .from(studyItems)
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(studyItems.ownerId, ownerId),
          gte(studyItems.dueAt, from),
          lt(studyItems.dueAt, to),
          isNull(studyItems.suspendedAt),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .orderBy(asc(studyItems.dueAt), asc(pages.id));
  }
}
