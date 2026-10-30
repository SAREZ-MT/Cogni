// What deleting a page's deck removes (Phase 8 H19), read just before the
// confirmation: its active cards and the reviews logged for them.
export interface DeckDeletionPreview {
  cards: number;
  reviews: number;
}

// Port over the hard delete of a page's whole deck (Phase 8 H19). Both
// answer null/false when the page is not the owner's. `delete` removes, in
// one transaction under the deck lock, every card of the page (archived
// ones too), their study items and review logs, the page's flashcard
// sessions and their feedback, the deck's generation fingerprints, and
// rewrites the page's mastery from what is left.
export interface DeckDeletion {
  preview(pageId: string, ownerId: string): Promise<DeckDeletionPreview | null>;
  delete(pageId: string, ownerId: string, now: Date): Promise<boolean>;
}
