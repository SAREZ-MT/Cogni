import { beforeEach, describe, expect, it } from "vitest";
import type { PageTextReader } from "@/modules/notebooks";
import { INITIAL_EASINESS } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import {
  createFlashcard,
  MAX_FLASHCARD_SIDE_LENGTH,
} from "../domain/flashcard";
import {
  type CreateManualFlashcardDeps,
  createManualFlashcard,
} from "./create-manual-flashcard";
import { InMemoryDeckUnitOfWork } from "./testing/in-memory-deck-unit-of-work";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const NOW = new Date("2026-10-04T10:00:00.000Z");

// The page exists and is active only for OWNER; any other page or owner is
// PAGE_NOT_FOUND, like notebooks' getPage.
const pages: PageTextReader = {
  async getPageText(pageId, ownerId) {
    if (pageId !== PAGE || ownerId !== OWNER) {
      return err(new DomainError("PAGE_NOT_FOUND", pageId));
    }
    return ok({ title: "Fotosíntesis", plainText: "" });
  },
};

let ids = 0;
function makeDeps(): {
  deps: CreateManualFlashcardDeps;
  deck: InMemoryDeckUnitOfWork;
} {
  const deck = new InMemoryDeckUnitOfWork();
  return {
    deck,
    deps: {
      pages,
      deck,
      clock: createFixedClock(NOW),
      ids: { next: () => `id-${++ids}` },
    },
  };
}

describe("createManualFlashcard", () => {
  beforeEach(() => {
    ids = 0;
  });

  it("creates a trimmed manual card at the end of the page's deck", async () => {
    const { deps, deck } = makeDeps();
    const existing = createFlashcard(
      {
        id: "card-0",
        ownerId: OWNER,
        pageId: PAGE,
        generationId: "gen-1",
        front: "Antes",
        back: "Ya estaba",
        origin: "ai",
        position: 4,
      },
      NOW,
    );
    if (!existing.ok) throw existing.error;
    await deck.flashcards.insertMany([existing.value]);

    const result = await createManualFlashcard(
      { pageId: PAGE, front: "  ¿Qué es el ATP? ", back: " Energía\n" },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      front: "¿Qué es el ATP?",
      back: "Energía",
      origin: "manual",
      generationId: null,
      position: 5,
      archivedAt: null,
      createdAt: NOW,
    });
    const cards = await deck.flashcards.listByPage(PAGE, OWNER);
    expect(cards.map((card) => card.id)).toEqual(["card-0", result.value.id]);
  });

  it("creates the card's study item in the same unit of work, due now", async () => {
    const { deps, deck } = makeDeps();

    const result = await createManualFlashcard(
      { pageId: PAGE, front: "P", back: "R" },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deck.runs).toBe(1);
    const items = deck.studyItems.all();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      kind: "flashcard",
      sourceId: result.value.id,
      easiness: INITIAL_EASINESS,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      dueAt: NOW,
      suspendedAt: null,
    });
    expect(items[0]?.id).not.toBe(result.value.id);
  });

  it("starts the deck when the page has no cards yet (position 0)", async () => {
    const { deps, deck } = makeDeps();

    const result = await createManualFlashcard(
      { pageId: PAGE, front: "P", back: "R" },
      deps,
      OWNER,
    );

    expect(result.ok && result.value.position).toBe(0);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(1);
  });

  it.each([
    ["front", { front: "   ", back: "R" }],
    ["back", { front: "P", back: "\n" }],
  ])("rejects a blank %s and writes nothing", async (_side, sides) => {
    const { deps, deck } = makeDeps();

    const result = await createManualFlashcard(
      { pageId: PAGE, ...sides },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.EMPTY);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(0);
    expect(deck.studyItems.all()).toHaveLength(0);
  });

  it("rejects a side longer than the limit (after trimming) and writes nothing", async () => {
    const { deps, deck } = makeDeps();
    const tooLong = "a".repeat(MAX_FLASHCARD_SIDE_LENGTH + 1);

    const result = await createManualFlashcard(
      { pageId: PAGE, front: "P", back: tooLong },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.TOO_LONG);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(0);
    expect(deck.runs).toBe(0);
  });

  it("accepts a side of exactly the limit once trimmed", async () => {
    const { deps } = makeDeps();
    const atLimit = ` ${"a".repeat(MAX_FLASHCARD_SIDE_LENGTH)} `;

    const result = await createManualFlashcard(
      { pageId: PAGE, front: atLimit, back: "R" },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
  });

  it("propagates PAGE_NOT_FOUND for another owner's page and writes nothing", async () => {
    const { deps, deck } = makeDeps();

    const result = await createManualFlashcard(
      { pageId: PAGE, front: "P", back: "R" },
      deps,
      OTHER,
    );

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    expect(deck.runs).toBe(0);
    expect(await deck.flashcards.countByPage(PAGE, OTHER)).toBe(0);
  });
});
