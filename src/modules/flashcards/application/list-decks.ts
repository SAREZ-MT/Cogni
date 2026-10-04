import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type {
  DeckSummary,
  FlashcardRepository,
} from "../domain/flashcard-repository";

// A deck is a page that holds at least one card; the repository derives the
// list (and the counts) from the cards, scoped to the owner.
export async function listDecks(
  deps: { flashcards: FlashcardRepository },
  ownerId: string,
): Promise<Result<DeckSummary[], DomainError>> {
  return ok(await deps.flashcards.countByOwnerGroupedByPage(ownerId));
}
