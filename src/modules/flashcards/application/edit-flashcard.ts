import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import { editFlashcard as editCard, type Flashcard } from "../domain/flashcard";
import type { DeckUnitOfWork } from "./deck-unit-of-work";

// Rewrites one card's sides in place (Phase 8 H18 edit page): same id,
// origin and position, so its study item and review history stay
// attached. An archived card or another owner's reads as not found.
export async function editFlashcard(
  input: { flashcardId: string; front: string; back: string },
  deps: { deck: DeckUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<Flashcard, DomainError>> {
  return deps.deck.run(async ({ flashcards }) => {
    const card = await flashcards.findById(input.flashcardId, ownerId);
    if (!card || card.archivedAt !== null) return notFound(input.flashcardId);
    const edited = editCard(card, input, deps.clock.now());
    if (!edited.ok) return edited;
    const saved = await flashcards.update(edited.value);
    if (!saved) return notFound(input.flashcardId);
    return ok(saved);
  });
}

export function notFound(flashcardId: string) {
  return err(new DomainError(FLASHCARD_ERROR.NOT_FOUND, flashcardId));
}
