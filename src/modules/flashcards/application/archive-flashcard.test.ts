import { beforeEach, describe, expect, it } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { Flashcard } from "../domain/flashcard";
import { archiveFlashcard } from "./archive-flashcard";
import { InMemoryDeckUnitOfWork } from "./testing/in-memory-deck-unit-of-work";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const CREATED = new Date("2026-10-01T10:00:00.000Z");
const NOW = new Date("2026-10-04T10:00:00.000Z");

function card(id: string, position: number, pageId = PAGE): Flashcard {
  return {
    id,
    ownerId: OWNER,
    pageId,
    generationId: null,
    front: `P${position}`,
    back: `R${position}`,
    origin: "manual",
    position,
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
  };
}

// A deck with `count` cards on PAGE, each with its study item.
async function seed(deck: InMemoryDeckUnitOfWork, count: number) {
  const cards = Array.from({ length: count }, (_, i) => card(`card-${i}`, i));
  await deck.flashcards.insertMany(cards);
  for (const c of cards) {
    await deck.studyItems.save(
      newStudyItem({
        id: `item-${c.id}`,
        ownerId: OWNER,
        pageId: PAGE,
        kind: "flashcard",
        sourceId: c.id,
        now: CREATED,
      }),
    );
  }
  return cards;
}

describe("archiveFlashcard", () => {
  let deck: InMemoryDeckUnitOfWork;
  const deps = () => ({ deck, clock: createFixedClock(NOW) });

  beforeEach(() => {
    deck = new InMemoryDeckUnitOfWork();
  });

  it("archives the card and suspends its study item when the deck keeps cards", async () => {
    await seed(deck, 2);

    const result = await archiveFlashcard(
      { flashcardId: "card-1" },
      deps(),
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ pageId: PAGE, remaining: 1 });
    expect(
      (await deck.flashcards.listByPage(PAGE, OWNER)).map((c) => c.id),
    ).toEqual(["card-0"]);
    expect(
      (await deck.flashcards.findById("card-1", OWNER))?.archivedAt,
    ).toEqual(NOW);
    const item = await deck.studyItems.findBySource(
      "flashcard",
      "card-1",
      OWNER,
    );
    expect(item?.suspendedAt).toEqual(NOW);
    const kept = await deck.studyItems.findBySource(
      "flashcard",
      "card-0",
      OWNER,
    );
    expect(kept?.suspendedAt).toBeNull();
  });

  it("refuses to archive the last active card (a deck is never empty)", async () => {
    await seed(deck, 1);

    const result = await archiveFlashcard(
      { flashcardId: "card-0" },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(1);
    const item = await deck.studyItems.findBySource(
      "flashcard",
      "card-0",
      OWNER,
    );
    expect(item?.suspendedAt).toBeNull();
  });

  it("counts only active cards: archived siblings do not keep the deck alive", async () => {
    await seed(deck, 2);
    const first = await archiveFlashcard(
      { flashcardId: "card-0" },
      deps(),
      OWNER,
    );
    expect(first.ok).toBe(true);

    const second = await archiveFlashcard(
      { flashcardId: "card-1" },
      deps(),
      OWNER,
    );

    expect(!second.ok && second.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
  });

  it("counts only the card's own page", async () => {
    await seed(deck, 1);
    await deck.flashcards.insertMany([card("elsewhere", 0, "page-2")]);

    const result = await archiveFlashcard(
      { flashcardId: "card-0" },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
  });

  it("returns NOT_FOUND for another owner's card and changes nothing", async () => {
    await seed(deck, 2);

    const result = await archiveFlashcard(
      { flashcardId: "card-1" },
      deps(),
      OTHER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(2);
  });

  it("returns NOT_FOUND for an unknown or already archived card", async () => {
    await seed(deck, 3);
    await archiveFlashcard({ flashcardId: "card-2" }, deps(), OWNER);

    const unknown = await archiveFlashcard(
      { flashcardId: "nope" },
      deps(),
      OWNER,
    );
    const again = await archiveFlashcard(
      { flashcardId: "card-2" },
      deps(),
      OWNER,
    );

    expect(!unknown.ok && unknown.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
    expect(!again.ok && again.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
  });

  it("still archives a card that has no study item", async () => {
    await deck.flashcards.insertMany([card("a", 0), card("b", 1)]);

    const result = await archiveFlashcard({ flashcardId: "b" }, deps(), OWNER);

    expect(result.ok).toBe(true);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(1);
  });
});
