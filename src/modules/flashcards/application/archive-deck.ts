import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { DeckUnitOfWork } from "./deck-unit-of-work";

export interface ArchiveDeckResult {
  pageId: string;
  // Cards archived (the whole deck).
  archived: number;
}

// "Eliminar mazo" (Phase 8 H17, flashcards hub): a deck is never empty, so
// deleting it is the logical delete (§6.1) of every active card of the
// page at once, each StudyItem suspended, in one unit of work under the
// deck lock. The page then has no deck; its cards stay archived.
export async function archiveDeck(
  input: { pageId: string },
  deps: { deck: DeckUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<ArchiveDeckResult, DomainError>> {
  return deps.deck.run(async ({ flashcards, studyItems }) => {
    await flashcards.lockDeck(input.pageId, ownerId);
    const cards = await flashcards.listByPage(input.pageId, ownerId);
    if (cards.length === 0) {
      return err(new DomainError(FLASHCARD_ERROR.NOT_FOUND, input.pageId));
    }

    const now = deps.clock.now();
    for (const card of cards) {
      await flashcards.archive(card.id, ownerId, now);
      const item = await studyItems.findBySource("flashcard", card.id, ownerId);
      if (item) await studyItems.suspend(item.id, ownerId, now);
    }
    return ok({ pageId: input.pageId, archived: cards.length });
  });
}
