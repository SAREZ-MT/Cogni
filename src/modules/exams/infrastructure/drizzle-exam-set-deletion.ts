import { and, count, eq, isNull } from "drizzle-orm";
import { createStudySetEraser } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import {
  examPageState,
  examQuestions,
  examSessions,
  generationFingerprints,
  pages,
} from "@/shared/db/schema";
import { createId } from "@/shared/kernel/id";
import type {
  ExamSetDeletion,
  ExamSetDeletionPreview,
} from "../application/exam-set-deletion";

async function ownsPage(
  db: DbExecutor,
  pageId: string,
  ownerId: string,
  lock: boolean,
): Promise<boolean> {
  const query = db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.ownerId, ownerId)));
  const rows = lock ? await query.for("update") : await query;
  return rows.length > 0;
}

// Phase 8 H19: the hard delete of a page's whole exam set, in one
// transaction holding the page row. The page state goes first (it points
// at a passed session), then the sessions (their answers cascade), then
// every question lineage.
export class DrizzleExamSetDeletion implements ExamSetDeletion {
  constructor(private readonly db: DbExecutor) {}

  async preview(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSetDeletionPreview | null> {
    if (!(await ownsPage(this.db, pageId, ownerId, false))) return null;
    const [questions] = await this.db
      .select({ value: count() })
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.pageId, pageId),
          eq(examQuestions.ownerId, ownerId),
          isNull(examQuestions.retiredAt),
        ),
      );
    const [attempts] = await this.db
      .select({ value: count() })
      .from(examSessions)
      .where(
        and(eq(examSessions.pageId, pageId), eq(examSessions.ownerId, ownerId)),
      );
    return {
      questions: questions?.value ?? 0,
      attempts: attempts?.value ?? 0,
    };
  }

  delete(pageId: string, ownerId: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await ownsPage(tx, pageId, ownerId, true))) return false;
      const study = createStudySetEraser(tx);
      await tx
        .delete(examPageState)
        .where(
          and(
            eq(examPageState.pageId, pageId),
            eq(examPageState.ownerId, ownerId),
          ),
        );
      const sessions = await tx
        .delete(examSessions)
        .where(
          and(
            eq(examSessions.pageId, pageId),
            eq(examSessions.ownerId, ownerId),
          ),
        )
        .returning({ id: examSessions.id });
      await study.eraseSessionFeedback({
        ownerId,
        sessionKind: "exam",
        sessionIds: sessions.map((session) => session.id),
      });
      await tx
        .delete(examQuestions)
        .where(
          and(
            eq(examQuestions.pageId, pageId),
            eq(examQuestions.ownerId, ownerId),
          ),
        );
      await study.eraseItems({ pageId, ownerId, kind: "exam_question" });
      await tx
        .delete(generationFingerprints)
        .where(
          and(
            eq(generationFingerprints.pageId, pageId),
            eq(generationFingerprints.ownerId, ownerId),
            eq(generationFingerprints.technique, "exam"),
          ),
        );
      await study.refreshMastery({ pageId, ownerId, now, id: createId() });
      return true;
    });
  }
}
