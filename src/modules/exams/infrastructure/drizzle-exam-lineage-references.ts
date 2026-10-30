import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { examPageState, examSessions } from "@/shared/db/schema";
import type { ExamLineageReferences } from "../application/exam-unit-of-work";

// Drizzle side of ExamLineageReferences (Phase 8 H18): before a lineage is
// deleted, the page's open exams that show any of its questions are
// deleted (their answers cascade; an open exam has written no review log
// yet) and its root leaves the pending retake's failed roots. Finished
// exams keep their row and score: the record of that attempt. When the
// root was the retake's last failed root, the retake is no longer pending
// (as starting it would clear it), so the hub stops offering it.
export class DrizzleExamLineageReferences implements ExamLineageReferences {
  constructor(private readonly db: DbExecutor) {}

  async dropLineage(
    input: { pageId: string; rootId: string; questionIds: readonly string[] },
    ownerId: string,
  ): Promise<void> {
    if (input.questionIds.length > 0) {
      await this.db
        .delete(examSessions)
        .where(
          and(
            eq(examSessions.pageId, input.pageId),
            eq(examSessions.ownerId, ownerId),
            isNull(examSessions.finishedAt),
            sql`${examSessions.questionIds} ?| ${sql.param([...input.questionIds])}::text[]`,
          ),
        );
    }
    await this.db
      .update(examPageState)
      .set({
        failedRootIds: sql`${examPageState.failedRootIds} - ${input.rootId}::text`,
        retakePending: sql`${examPageState.retakePending} and jsonb_array_length(${examPageState.failedRootIds} - ${input.rootId}::text) > 0`,
      })
      .where(
        and(
          eq(examPageState.pageId, input.pageId),
          eq(examPageState.ownerId, ownerId),
        ),
      );
  }
}
