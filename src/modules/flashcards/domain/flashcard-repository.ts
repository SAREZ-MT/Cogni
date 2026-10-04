import type { Flashcard } from "./flashcard";

// One deck = one page with at least one card (product rule: a deck is never
// empty and its count is derived from the cards).
export interface DeckSummary {
  readonly pageId: string;
  readonly notebookId: string;
  readonly pageTitle: string;
  readonly notebookTitle: string;
  readonly notebookColor: string | null;
  readonly count: number;
}

// Every method is owner-scoped (documento-maestro §6.1): another owner's
// cards are invisible.
export interface FlashcardRepository {
  insertMany(cards: readonly Flashcard[]): Promise<void>;
  // Ordered by position ascending.
  listByPage(pageId: string, ownerId: string): Promise<Flashcard[]>;
  countByPage(pageId: string, ownerId: string): Promise<number>;
  // 0 for an empty deck, otherwise highest position + 1.
  nextPosition(pageId: string, ownerId: string): Promise<number>;
  // The owner's decks: pages (and notebooks) that are not archived and hold
  // at least one card, ordered by notebook title, then page title.
  countByOwnerGroupedByPage(ownerId: string): Promise<DeckSummary[]>;
}
