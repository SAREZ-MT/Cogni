import { and, count, eq, isNull } from "drizzle-orm";
import { createStudySetEraser } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import {
  generationFingerprints,
  pages,
  recallQuestions,
  recallSessions,
} from "@/shared/db/schema";
import { createId } from "@/shared/kernel/id";
import type {
  RecallSetDeletion,
  RecallSetDeletionPreview,
} from "../application/recall-set-deletion";

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

// Phase 8 H19: the hard delete of a page's whole recall set, in one
// transaction holding the page row. Answers cascade from their session and
// question; review logs from their study item.
export class DrizzleRecallSetDeletion implements RecallSetDeletion {
  constructor(private readonly db: DbExecutor) {}

  async preview(
    pageId: string,
    ownerId: string,
  ): Promise<RecallSetDeletionPreview | null> {
    if (!(await ownsPage(this.db, pageId, ownerId, false))) return null;
    const [questions] = await this.db
      .select({ value: count() })
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.pageId, pageId),
          eq(recallQuestions.ownerId, ownerId),
          isNull(recallQuestions.archivedAt),
        ),
      );
    const [sessions] = await this.db
      .select({ value: count() })
      .from(recallSessions)
      .where(
        and(
          eq(recallSessions.pageId, pageId),
          eq(recallSessions.ownerId, ownerId),
        ),
      );
    return {
      questions: questions?.value ?? 0,
      sessions: sessions?.value ?? 0,
    };
  }

  delete(pageId: string, ownerId: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await ownsPage(tx, pageId, ownerId, true))) return false;
      const study = createStudySetEraser(tx);
      const sessions = await tx
        .delete(recallSessions)
        .where(
          and(
            eq(recallSessions.pageId, pageId),
            eq(recallSessions.ownerId, ownerId),
          ),
        )
        .returning({ id: recallSessions.id });
      await study.eraseSessionFeedback({
        ownerId,
        sessionKind: "recall",
        sessionIds: sessions.map((session) => session.id),
      });
      await tx
        .delete(recallQuestions)
        .where(
          and(
            eq(recallQuestions.pageId, pageId),
            eq(recallQuestions.ownerId, ownerId),
          ),
        );
      await study.eraseItems({ pageId, ownerId, kind: "recall_question" });
      await tx
        .delete(generationFingerprints)
        .where(
          and(
            eq(generationFingerprints.pageId, pageId),
            eq(generationFingerprints.ownerId, ownerId),
            eq(generationFingerprints.technique, "recall"),
          ),
        );
      await study.refreshMastery({ pageId, ownerId, now, id: createId() });
      return true;
    });
  }
}
