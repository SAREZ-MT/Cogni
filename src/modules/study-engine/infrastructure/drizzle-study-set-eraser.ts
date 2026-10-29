import { and, eq, inArray } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  flashcardSessions,
  type ReviewSessionKindValue,
  type StudyItemKindValue,
  sessionFeedback,
  studyItems,
} from "@/shared/db/schema";

// Phase 8 H19: the study-engine rows a technique module removes when it
// deletes a page's whole set. study_items carries no foreign key to its
// source row and session_feedback none to its session, so neither goes
// away on its own; review_logs cascade from their item. `db` is the
// deleting transaction.

export async function eraseStudyItems(
  db: DbExecutor,
  input: { pageId: string; ownerId: string; kind: StudyItemKindValue },
): Promise<number> {
  const deleted = await db
    .delete(studyItems)
    .where(
      and(
        eq(studyItems.pageId, input.pageId),
        eq(studyItems.ownerId, input.ownerId),
        eq(studyItems.kind, input.kind),
      ),
    )
    .returning({ id: studyItems.id });
  return deleted.length;
}

export async function eraseSessionFeedback(
  db: DbExecutor,
  input: {
    ownerId: string;
    sessionKind: ReviewSessionKindValue;
    sessionIds: readonly string[];
  },
): Promise<void> {
  if (input.sessionIds.length === 0) return;
  await db
    .delete(sessionFeedback)
    .where(
      and(
        eq(sessionFeedback.ownerId, input.ownerId),
        eq(sessionFeedback.sessionKind, input.sessionKind),
        inArray(sessionFeedback.sessionId, [...input.sessionIds]),
      ),
    );
}

// The page's flashcard review sessions and their AI feedback. A review of
// several pages at once (page_id null) is kept: it also holds other pages'
// reviews.
export async function eraseFlashcardSessions(
  db: DbExecutor,
  input: { pageId: string; ownerId: string },
): Promise<number> {
  const deleted = await db
    .delete(flashcardSessions)
    .where(
      and(
        eq(flashcardSessions.pageId, input.pageId),
        eq(flashcardSessions.ownerId, input.ownerId),
      ),
    )
    .returning({ id: flashcardSessions.id });
  await eraseSessionFeedback(db, {
    ownerId: input.ownerId,
    sessionKind: "flashcards",
    sessionIds: deleted.map((row) => row.id),
  });
  return deleted.length;
}
