import type { PageTextReader } from "@/modules/notebooks";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import { editFlashcard as editCard, type Flashcard } from "../domain/flashcard";
import { createManualFlashcard } from "./create-manual-flashcard";
import type { DeckRepositories, DeckUnitOfWork } from "./deck-unit-of-work";
import { deleteFlashcard } from "./delete-flashcard";
import { editFlashcard, notFound } from "./edit-flashcard";

export interface CardSides {
  front: string;
  back: string;
}

// What the edit page's "Guardar" sends (Phase 8 H18): the local draft
// reduced to operations on the page's deck.
export interface DeckEdits {
  pageId: string;
  // `expectedUpdatedAt`: the item's updatedAt when the edit page loaded
  // (ISO); a different stored one refuses the save (CHANGED, V10).
  updates: readonly ({ id: string; expectedUpdatedAt?: string } & CardSides)[];
  creates: readonly CardSides[];
  deletes: readonly string[];
}

export interface DeckEditsResult {
  // The deck after saving, by position.
  cards: Flashcard[];
}

export interface ApplyDeckEditsDeps {
  pages: PageTextReader;
  deck: DeckUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Carries an err Result out of DeckUnitOfWork.run as a throw, so the whole
// save rolls back; applyDeckEdits turns it back into the Result.
class RollbackSignal extends Error {
  constructor(readonly result: Result<never, DomainError>) {
    super("deck edits rolled back by an err result");
    this.name = "RollbackSignal";
  }
}

// Applies an edit page draft in ONE unit of work, all or nothing, through
// the single-card use cases (editFlashcard, createManualFlashcard,
// deleteFlashcard) run on the open transaction. Every side is validated
// before anything is written. Order: edits, additions, then deletions, so
// a save may replace every card as long as one is left (a deck is never
// empty: LAST_CARD otherwise). Every edited or deleted id must be an
// active card of this page; anything else is FLASHCARD_NOT_FOUND.
export async function applyDeckEdits(
  input: DeckEdits,
  deps: ApplyDeckEditsDeps,
  ownerId: string,
): Promise<Result<DeckEditsResult, DomainError>> {
  const invalid = firstInvalid(input, deps.clock.now());
  if (invalid) return invalid;

  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  // The page was read above; the single-item use cases reuse that answer,
  // so nothing inside the transaction asks for a second connection (the
  // app's pool holds one: a read there would wait for it forever).
  const checkedPage = { getPageText: async () => page };

  try {
    return await deps.deck.run(async (repos) => {
      // The single-card use cases run on this transaction's repositories.
      const deck = sameTransaction(repos);
      await repos.flashcards.lockDeck(input.pageId, ownerId);
      for (const id of [...input.updates.map((u) => u.id), ...input.deletes]) {
        const card = await repos.flashcards.findById(id, ownerId);
        if (!card || card.pageId !== input.pageId || card.archivedAt !== null) {
          throw new RollbackSignal(notFound(id));
        }
        const expected = input.updates.find(
          (u) => u.id === id,
        )?.expectedUpdatedAt;
        if (
          expected !== undefined &&
          card.updatedAt.toISOString() !== expected
        ) {
          throw new RollbackSignal(changed(id));
        }
      }
      for (const update of input.updates) {
        must(
          await editFlashcard(
            { flashcardId: update.id, front: update.front, back: update.back },
            { deck, clock: deps.clock },
            ownerId,
          ),
        );
      }
      for (const sides of input.creates) {
        must(
          await createManualFlashcard(
            { pageId: input.pageId, ...sides },
            { ...deps, pages: checkedPage, deck },
            ownerId,
          ),
        );
      }
      for (const id of input.deletes) {
        must(await deleteFlashcard({ flashcardId: id }, { deck }, ownerId));
      }
      return ok({
        cards: await repos.flashcards.listByPage(input.pageId, ownerId),
      });
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.result;
    throw error;
  }
}

function changed(id: string): Result<never, DomainError> {
  return err(
    new DomainError(
      FLASHCARD_ERROR.CHANGED,
      `Flashcard ${id} changed after the edit page loaded`,
    ),
  );
}

function sameTransaction(repos: DeckRepositories): DeckUnitOfWork {
  return { run: (work) => work(repos) };
}

function must<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new RollbackSignal(result);
  return result.value;
}

// The first edit or addition the domain refuses (a blank or too long
// side), checked with editFlashcard's rules on a throwaway card.
function firstInvalid(
  input: DeckEdits,
  now: Date,
): Result<never, DomainError> | null {
  const probe: Flashcard = {
    id: "probe",
    ownerId: "probe",
    pageId: input.pageId,
    generationId: null,
    front: "x",
    back: "x",
    origin: "manual",
    position: 0,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  for (const sides of [...input.updates, ...input.creates]) {
    const checked = editCard(probe, sides, now);
    if (!checked.ok) return checked;
  }
  return null;
}
