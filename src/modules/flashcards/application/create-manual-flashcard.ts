import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import {
  createFlashcard,
  type Flashcard,
  MAX_FLASHCARD_SIDE_LENGTH,
} from "../domain/flashcard";
import type { DeckUnitOfWork } from "./deck-unit-of-work";

export interface CreateManualFlashcardDeps {
  pages: PageTextReader;
  deck: DeckUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Adds a hand-written card at the end of the page's deck together with its
// StudyItem (§3.4: every card is scheduled from the moment it exists), in
// one unit of work. A page without cards has no deck yet; its first card
// starts it, since a deck is derived from its cards.
export async function createManualFlashcard(
  input: { pageId: string; front: string; back: string },
  deps: CreateManualFlashcardDeps,
  ownerId: string,
): Promise<Result<Flashcard, DomainError>> {
  if (
    input.front.trim().length > MAX_FLASHCARD_SIDE_LENGTH ||
    input.back.trim().length > MAX_FLASHCARD_SIDE_LENGTH
  ) {
    return err(
      new DomainError(
        FLASHCARD_ERROR.TOO_LONG,
        `Each side holds at most ${MAX_FLASHCARD_SIDE_LENGTH} characters`,
      ),
    );
  }

  // Missing, archived or another owner's page: PAGE_NOT_FOUND, no write.
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;

  const now = deps.clock.now();
  return deps.deck.run(async ({ flashcards, studyItems }) => {
    await flashcards.lockDeck(input.pageId, ownerId);
    const card = createFlashcard(
      {
        id: deps.ids.next(),
        ownerId,
        pageId: input.pageId,
        generationId: null,
        front: input.front,
        back: input.back,
        origin: "manual",
        position: await flashcards.nextPosition(input.pageId, ownerId),
      },
      now,
    );
    if (!card.ok) return card;

    await flashcards.insertMany([card.value]);
    await studyItems.save(
      newStudyItem({
        id: deps.ids.next(),
        ownerId,
        pageId: input.pageId,
        kind: "flashcard",
        sourceId: card.value.id,
        now,
      }),
    );
    return ok(card.value);
  });
}
