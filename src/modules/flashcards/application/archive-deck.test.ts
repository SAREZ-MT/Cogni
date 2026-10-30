import { beforeEach, describe, expect, it } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { Flashcard } from "../domain/flashcard";
import { archiveDeck } from "./archive-deck";
import { InMemoryDeckUnitOfWork } from "./testing/in-memory-deck-unit-of-work";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const OTHER_PAGE = "page-2";
const CREATED = new Date("2026-10-01T10:00:00.000Z");
const NOW = new Date("2026-10-29T10:00:00.000Z");

function card(id: string, position: number, pageId = PAGE): Flashcard {
  return {
    id,
    ownerId: OWNER,
    pageId,
    generationId: null,
    front: `P${position}`,
    back: `R${position}`,
    origin: "ai",
    position,
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
  };
}

async function seed(deck: InMemoryDeckUnitOfWork, cards: Flashcard[]) {
  await deck.flashcards.insertMany(cards);
  for (const c of cards) {
    await deck.studyItems.save(
      newStudyItem({
        id: `item-${c.id}`,
        ownerId: OWNER,
        pageId: c.pageId,
        kind: "flashcard",
        sourceId: c.id,
        now: CREATED,
      }),
    );
  }
}

// Phase 8 H17: "Eliminar mazo" in the flashcards hub. A deck is never
// empty, so deleting it archives every card at once (logical delete,
// §6.1) and suspends their study items; the deck then leaves every read.
describe("archiveDeck", () => {
  let deck: InMemoryDeckUnitOfWork;
  const deps = () => ({ deck, clock: createFixedClock(NOW) });

  beforeEach(() => {
    deck = new InMemoryDeckUnitOfWork();
  });

  it("archives every active card of the page and suspends their study items", async () => {
    await seed(deck, [card("c0", 0), card("c1", 1), card("x0", 0, OTHER_PAGE)]);

    const result = await archiveDeck({ pageId: PAGE }, deps(), OWNER);

    expect(result).toEqual({ ok: true, value: { pageId: PAGE, archived: 2 } });
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(0);
    for (const id of ["c0", "c1"]) {
      expect((await deck.flashcards.findById(id, OWNER))?.archivedAt).toEqual(
        NOW,
      );
      expect(
        (await deck.studyItems.findBySource("flashcard", id, OWNER))
          ?.suspendedAt,
      ).toEqual(NOW);
    }
    expect(await deck.flashcards.countByPage(OTHER_PAGE, OWNER)).toBe(1);
  });

  it("is not found for a page without active cards or another owner's deck", async () => {
    await seed(deck, [card("c0", 0)]);

    for (const [pageId, owner] of [
      ["page-empty", OWNER],
      [PAGE, OTHER],
    ] as const) {
      const result = await archiveDeck({ pageId }, deps(), owner);
      expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
    }
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(1);
  });
});
