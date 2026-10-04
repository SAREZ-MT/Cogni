import { createStudyItemRepository } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import type {
  DeckRepositories,
  DeckUnitOfWork,
} from "../application/deck-unit-of-work";
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
        studyItems: createStudyItemRepository(tx),
      }),
    );
  }
}
