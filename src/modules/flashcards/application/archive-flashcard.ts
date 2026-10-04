import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { DeckUnitOfWork } from "./deck-unit-of-work";

export interface ArchiveFlashcardResult {
  pageId: string;
  // Active cards left in the page's deck (always >= 1).
  remaining: number;
}

// Logical delete of one card (§6.1): the card leaves every read and its
// StudyItem is suspended, in one unit of work. A deck is never empty, so
// the page's last active card cannot be archived. The deck is locked
// before counting, so two concurrent archives cannot both pass the check.
export async function archiveFlashcard(
  input: { flashcardId: string },
  deps: { deck: DeckUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<ArchiveFlashcardResult, DomainError>> {
  return deps.deck.run(async ({ flashcards, studyItems }) => {
    const found = await flashcards.findById(input.flashcardId, ownerId);
    if (!found) return notFound(input.flashcardId);
    await flashcards.lockDeck(found.pageId, ownerId);

    // Re-read under the lock: a concurrent archive may have won the race.
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

    const now = deps.clock.now();
    await flashcards.archive(card.id, ownerId, now);
    const item = await studyItems.findBySource("flashcard", card.id, ownerId);
    if (item) await studyItems.suspend(item.id, ownerId, now);
    return ok({ pageId: card.pageId, remaining: active - 1 });
  });
}

function notFound(flashcardId: string) {
  return err(new DomainError(FLASHCARD_ERROR.NOT_FOUND, flashcardId));
}
