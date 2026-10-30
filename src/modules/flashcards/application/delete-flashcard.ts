import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { DeckUnitOfWork } from "./deck-unit-of-work";
import { notFound } from "./edit-flashcard";

export interface DeleteFlashcardResult {
  pageId: string;
  // Active cards left in the page's deck (always >= 1).
  remaining: number;
}

// Real delete of one card (Phase 8 H18, user 2026-10-29): the card, its
// StudyItem and, by cascade, the item's review logs go away in one unit of
// work, so mastery and metrics no longer count it. Unlike archiving, no
// trace is kept. A deck is never empty, so the page's last active card
// cannot be deleted; the deck is locked before counting, like
// archiveFlashcard. Deleting the whole deck is a separate action.
export async function deleteFlashcard(
  input: { flashcardId: string },
  deps: { deck: DeckUnitOfWork },
  ownerId: string,
): Promise<Result<DeleteFlashcardResult, DomainError>> {
  return deps.deck.run(async ({ flashcards, studyItems }) => {
    const found = await flashcards.findById(input.flashcardId, ownerId);
    if (!found) return notFound(input.flashcardId);
    await flashcards.lockDeck(found.pageId, ownerId);

    // Re-read under the lock: a concurrent change may have won the race.
    const card = await flashcards.findById(input.flashcardId, ownerId);
    if (!card || card.archivedAt !== null) return notFound(input.flashcardId);

    const active = await flashcards.countByPage(card.pageId, ownerId);
    if (active <= 1) {
      return err(
        new DomainError(
          FLASHCARD_ERROR.LAST_CARD,
          "A deck always keeps at least one card",
        ),
      );
    }

    await studyItems.deleteBySource("flashcard", card.id, ownerId);
    await flashcards.delete(card.id, ownerId);
    return ok({ pageId: card.pageId, remaining: active - 1 });
  });
}
