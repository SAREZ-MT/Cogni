import { and, count, eq, isNull } from "drizzle-orm";
import { createStudySetEraser } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import {
  flashcards,
  generationFingerprints,
  pages,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createId } from "@/shared/kernel/id";
import type {
  DeckDeletion,
  DeckDeletionPreview,
} from "../application/deck-deletion";

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

// Phase 8 H19: the hard delete of a page's whole deck. One transaction
// under the deck lock (the page row, as every deck change takes it), so a
// generation or an edit save of the same deck queues behind it.
export class DrizzleDeckDeletion implements DeckDeletion {
  constructor(private readonly db: DbExecutor) {}

  async preview(
    pageId: string,
    ownerId: string,
  ): Promise<DeckDeletionPreview | null> {
    if (!(await ownsPage(this.db, pageId, ownerId, false))) return null;
    const [cards] = await this.db
      .select({ value: count() })
      .from(flashcards)
      .where(
        and(
          eq(flashcards.pageId, pageId),
          eq(flashcards.ownerId, ownerId),
          isNull(flashcards.archivedAt),
        ),
      );
    const [reviews] = await this.db
      .select({ value: count() })
      .from(reviewLogs)
      .innerJoin(studyItems, eq(studyItems.id, reviewLogs.itemId))
      .where(
        and(
          eq(studyItems.pageId, pageId),
          eq(studyItems.ownerId, ownerId),
          eq(studyItems.kind, "flashcard"),
        ),
      );
    return { cards: cards?.value ?? 0, reviews: reviews?.value ?? 0 };
  }

  delete(pageId: string, ownerId: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await ownsPage(tx, pageId, ownerId, true))) return false;
      const study = createStudySetEraser(tx);
      await study.eraseFlashcardSessions({ pageId, ownerId });
      await study.eraseItems({ pageId, ownerId, kind: "flashcard" });
      await tx
        .delete(flashcards)
        .where(
          and(eq(flashcards.pageId, pageId), eq(flashcards.ownerId, ownerId)),
        );
      await tx
        .delete(generationFingerprints)
        .where(
          and(
            eq(generationFingerprints.pageId, pageId),
            eq(generationFingerprints.ownerId, ownerId),
            eq(generationFingerprints.technique, "flashcards"),
          ),
        );
      await study.refreshMastery({ pageId, ownerId, now, id: createId() });
      return true;
    });
  }
}
