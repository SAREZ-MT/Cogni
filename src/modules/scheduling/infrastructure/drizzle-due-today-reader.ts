import { and, asc, eq, isNull, lt, min, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { notebooks, pages, studyItems } from "@/shared/db/schema";
import type { DueKind, DueTodayPage } from "../domain/due-today";
import type { DueTodayReader } from "../domain/due-today-reader";

const countOf = (kind: DueKind) =>
  sql<number>`count(*) filter (where ${studyItems.kind} = ${kind})::int`;

// Drizzle implementation of DueTodayReader: one grouped read over
// study_items joined to their page and notebook. It only reads the due
// dates study-engine wrote (§3.4); it never computes one.
export class DrizzleDueTodayReader implements DueTodayReader {
  constructor(private readonly db: DbExecutor) {}

  async listDueToday(
    ownerId: string,
    dueBefore: Date,
  ): Promise<DueTodayPage[]> {
    const earliestDueAt = min(studyItems.dueAt);
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        flashcard: countOf("flashcard"),
        examQuestion: countOf("exam_question"),
        recallQuestion: countOf("recall_question"),
        earliestDueAt,
      })
      .from(studyItems)
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(studyItems.ownerId, ownerId),
          isNull(studyItems.suspendedAt),
          lt(studyItems.dueAt, dueBefore),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .groupBy(pages.id, notebooks.id)
      .orderBy(asc(earliestDueAt), asc(pages.id));

    return rows.flatMap((row) =>
      // min() over a non-empty group is never null; the guard only narrows.
      row.earliestDueAt === null
        ? []
        : [
            {
              pageId: row.pageId,
              pageTitle: row.pageTitle,
              notebookId: row.notebookId,
              notebookTitle: row.notebookTitle,
              notebookColor: row.notebookColor,
              due: {
                flashcard: row.flashcard,
                exam_question: row.examQuestion,
                recall_question: row.recallQuestion,
              },
              earliestDueAt: row.earliestDueAt,
            },
          ],
    );
  }
}
