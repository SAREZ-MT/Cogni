import { and, eq } from "drizzle-orm";
import {
  createStudyItemRepository,
  type StudyItemKind,
} from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import { studyItems } from "@/shared/db/schema";
import type {
  DeckRepositories,
  DeckStudyItems,
  DeckUnitOfWork,
} from "../application/deck-unit-of-work";
import { DrizzleFlashcardFingerprints } from "./drizzle-flashcard-fingerprints";
import { DrizzleFlashcardRepository } from "./drizzle-flashcard-repository";

// One Postgres transaction per run: the flashcard repository and the
// study-engine repository are both built on the transaction handle, so a
// card and its study item commit or roll back together. Supabase's
// transaction pooler keeps a BEGIN..COMMIT on one connection.
export class DrizzleDeckUnitOfWork implements DeckUnitOfWork {
  constructor(private readonly db: DbExecutor) {}

  run<T>(work: (repositories: DeckRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        flashcards: new DrizzleFlashcardRepository(tx),
        studyItems: deckStudyItems(tx),
        fingerprints: new DrizzleFlashcardFingerprints(tx),
      }),
    );
  }
}

// study-engine's repository plus the delete the edit page needs (Phase 8
// H18). study_items carries no foreign key to its source, so deleting a
// card leaves its item behind unless this removes it; review_logs cascade
// from the item.
export function deckStudyItems(db: DbExecutor): DeckStudyItems {
  const items = createStudyItemRepository(db);
  return {
    save: (item) => items.save(item),
    findBySource: (kind, sourceId, ownerId) =>
      items.findBySource(kind, sourceId, ownerId),
    suspend: (id, ownerId, now) => items.suspend(id, ownerId, now),
    async deleteBySource(
      kind: StudyItemKind,
      sourceId: string,
      ownerId: string,
    ): Promise<void> {
      await db
        .delete(studyItems)
        .where(
          and(
            eq(studyItems.kind, kind),
            eq(studyItems.sourceId, sourceId),
            eq(studyItems.ownerId, ownerId),
          ),
        );
    },
  };
}
