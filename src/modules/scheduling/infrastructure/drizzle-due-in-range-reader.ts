import { and, asc, count, eq, gte, isNull, lt, min, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { notebooks, pages, studyItems } from "@/shared/db/schema";
import type { CalendarItem, OverdueCount } from "../domain/calendar";
import type { DueInRangeReader } from "../domain/due-in-range-reader";

// Drizzle implementation of DueInRangeReader: owner-scoped reads over
// study_items (served by the (owner_id, due_at) index) joined to the page
// and notebook. The range read returns items ungrouped: day bucketing in
// the profile's zone is domain logic (groupCalendarDays), not SQL. The
// overdue read aggregates per page and technique, so its size is bounded
// by pages × techniques however large the backlog grows.
export class DrizzleDueInRangeReader implements DueInRangeReader {
  constructor(private readonly db: DbExecutor) {}

  private live(ownerId: string) {
    return [
      eq(studyItems.ownerId, ownerId),
      isNull(studyItems.suspendedAt),
      isNull(pages.archivedAt),
      isNull(notebooks.archivedAt),
    ];
  }

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
          ...this.live(ownerId),
          gte(studyItems.dueAt, from),
          lt(studyItems.dueAt, to),
        ),
      )
      .orderBy(asc(studyItems.dueAt), asc(pages.id));
  }

  async listOverdueCounts(
    ownerId: string,
    before: Date,
  ): Promise<OverdueCount[]> {
    const earliest = min(studyItems.dueAt);
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        kind: studyItems.kind,
        count: count(),
        earliestDueAt: earliest,
      })
      .from(studyItems)
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(and(...this.live(ownerId), lt(studyItems.dueAt, before)))
      .groupBy(pages.id, pages.title, notebooks.id, studyItems.kind)
      .orderBy(asc(earliest), asc(pages.id), asc(sql`${studyItems.kind}`));
    // min() over a non-empty group is never null.
    return rows.map((row) => ({
      ...row,
      earliestDueAt: row.earliestDueAt as Date,
    }));
  }
}
