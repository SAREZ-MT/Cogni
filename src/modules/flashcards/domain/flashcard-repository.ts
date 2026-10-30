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
  // The newest active card's creation (the hub's recency).
  readonly latestCardAt: Date;
  // The earliest due date of the active cards' study items; null when none
  // is scheduled (Phase 8 H17: "Al día · repaso en X días").
  readonly nextDueAt: Date | null;
}

// Every method is owner-scoped (documento-maestro §6.1): another owner's
// cards are invisible. Archived cards are invisible too, except to findById
// and nextPosition.
export interface FlashcardRepository {
  insertMany(cards: readonly Flashcard[]): Promise<void>;
  // The card, archived or not; null for an unknown id or another owner's.
  findById(id: string, ownerId: string): Promise<Flashcard | null>;
  // Active cards ordered by position ascending.
  listByPage(pageId: string, ownerId: string): Promise<Flashcard[]>;
  // Active cards only.
  countByPage(pageId: string, ownerId: string): Promise<number>;
  // 0 for a page that never had cards, otherwise highest position + 1.
  // Archived cards count, so a position is never handed out twice.
  nextPosition(pageId: string, ownerId: string): Promise<number>;
  // The owner's decks: pages (and notebooks) that are not archived and hold
  // at least one active card, ordered by notebook title, then page title.
  countByOwnerGroupedByPage(ownerId: string): Promise<DeckSummary[]>;
  // Logical delete. An already archived card keeps its first archivedAt;
  // another owner's card is left untouched.
  archive(id: string, ownerId: string, now: Date): Promise<void>;
  // Writes an in-place edit of an active card: front, back and updatedAt.
  // Returns the stored card, or null for another owner's, an archived or
  // an unknown card (Phase 8 H18).
  update(card: Flashcard): Promise<Flashcard | null>;
  // Real delete of the card row (Phase 8 H18: the edit page removes a card
  // for good, so the metrics stay honest). Its study item goes with it
  // through DeckStudyItems.deleteBySource. Another owner's card is left
  // untouched.
  delete(id: string, ownerId: string): Promise<void>;
  // Serializes concurrent changes to the page's deck until the surrounding
  // unit of work ends, so "never empty" and position checks hold under
  // concurrency. A no-op outside a transaction and in memory.
  lockDeck(pageId: string, ownerId: string): Promise<void>;
}
