import type { Flashcard } from "./flashcard";

// Every method is owner-scoped (documento-maestro §6.1): another owner's
// cards are invisible.
export interface FlashcardRepository {
  insertMany(cards: readonly Flashcard[]): Promise<void>;
  // Ordered by position ascending.
  listByPage(pageId: string, ownerId: string): Promise<Flashcard[]>;
  countByPage(pageId: string, ownerId: string): Promise<number>;
  // 0 for an empty deck, otherwise highest position + 1.
  nextPosition(pageId: string, ownerId: string): Promise<number>;
}
