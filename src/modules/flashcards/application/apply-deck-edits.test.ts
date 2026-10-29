import { beforeEach, describe, expect, it } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { Flashcard } from "../domain/flashcard";
import { applyDeckEdits } from "./apply-deck-edits";
import { deleteFlashcard } from "./delete-flashcard";
import { editFlashcard } from "./edit-flashcard";
import { InMemoryDeckUnitOfWork } from "./testing/in-memory-deck-unit-of-work";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const CREATED = new Date("2026-10-01T10:00:00.000Z");
const NOW = new Date("2026-10-29T10:00:00.000Z");

function card(id: string, position: number, pageId = PAGE): Flashcard {
  return {
    id,
    ownerId: OWNER,
    pageId,
    generationId: "gen-1",
    front: `P${position}`,
    back: `R${position}`,
    origin: "ai",
    position,
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
  };
}

async function seed(
  deck: InMemoryDeckUnitOfWork,
  count: number,
  pageId = PAGE,
) {
  const cards = Array.from({ length: count }, (_, i) =>
    card(`${pageId}-card-${i}`, i, pageId),
  );
  await deck.flashcards.insertMany(cards);
  for (const c of cards) {
    await deck.studyItems.save(
      newStudyItem({
        id: `item-${c.id}`,
        ownerId: OWNER,
        pageId,
        kind: "flashcard",
        sourceId: c.id,
        now: CREATED,
      }),
    );
  }
  return cards;
}

const pages = {
  async getPageText(pageId: string, ownerId: string) {
    return ownerId === OWNER
      ? ok({ title: "Página", plainText: "" })
      : err(new DomainError("PAGE_NOT_FOUND", pageId));
  },
};

describe("editFlashcard", () => {
  let deck: InMemoryDeckUnitOfWork;
  beforeEach(() => {
    deck = new InMemoryDeckUnitOfWork();
  });

  it("rewrites both sides in place, trimmed, keeping the card's study item", async () => {
    const [first] = await seed(deck, 2);

    const result = await editFlashcard(
      {
        flashcardId: first?.id ?? "",
        front: "  Nuevo frente ",
        back: "Nuevo reverso",
      },
      { deck, clock: createFixedClock(NOW) },
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      id: first?.id,
      front: "Nuevo frente",
      back: "Nuevo reverso",
      updatedAt: NOW,
    });
    expect(
      await deck.studyItems.findBySource("flashcard", first?.id ?? "", OWNER),
    ).not.toBeNull();
  });

  it("refuses a blank side and another owner's card", async () => {
    const [first] = await seed(deck, 1);
    const deps = { deck, clock: createFixedClock(NOW) };

    const blank = await editFlashcard(
      { flashcardId: first?.id ?? "", front: " ", back: "R" },
      deps,
      OWNER,
    );
    const foreign = await editFlashcard(
      { flashcardId: first?.id ?? "", front: "F", back: "R" },
      deps,
      OTHER,
    );

    expect(!blank.ok && blank.error.code).toBe(FLASHCARD_ERROR.EMPTY);
    expect(!foreign.ok && foreign.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
  });
});

describe("deleteFlashcard", () => {
  let deck: InMemoryDeckUnitOfWork;
  beforeEach(() => {
    deck = new InMemoryDeckUnitOfWork();
  });

  it("removes the card and its study item for good", async () => {
    const [first] = await seed(deck, 2);

    const result = await deleteFlashcard(
      { flashcardId: first?.id ?? "" },
      { deck },
      OWNER,
    );

    expect(result.ok && result.value.remaining).toBe(1);
    expect(await deck.flashcards.findById(first?.id ?? "", OWNER)).toBeNull();
    expect(
      await deck.studyItems.findBySource("flashcard", first?.id ?? "", OWNER),
    ).toBeNull();
  });

  it("keeps the last card of a deck (a deck is never empty)", async () => {
    const [only] = await seed(deck, 1);

    const result = await deleteFlashcard(
      { flashcardId: only?.id ?? "" },
      { deck },
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
    expect(
      await deck.flashcards.findById(only?.id ?? "", OWNER),
    ).not.toBeNull();
  });
});

describe("applyDeckEdits", () => {
  let deck: InMemoryDeckUnitOfWork;
  let n = 0;
  const deps = () => ({
    pages,
    deck,
    clock: createFixedClock(NOW),
    ids: { next: () => `new-${++n}` },
  });

  beforeEach(() => {
    deck = new InMemoryDeckUnitOfWork();
    n = 0;
  });

  it("applies edits, additions and deletions in one unit of work and returns the deck", async () => {
    const [a, b, c] = await seed(deck, 3);

    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [{ id: a?.id ?? "", front: "A editada", back: "RA" }],
        creates: [{ front: "Nueva", back: "RN" }],
        deletes: [b?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deck.runs).toBe(1);
    expect(result.value.cards.map((x) => x.front)).toEqual([
      "A editada",
      c?.front,
      "Nueva",
    ]);
    const created = result.value.cards.at(-1);
    expect(created?.origin).toBe("manual");
    expect(
      await deck.studyItems.findBySource("flashcard", created?.id ?? "", OWNER),
    ).not.toBeNull();
    expect(
      await deck.studyItems.findBySource("flashcard", b?.id ?? "", OWNER),
    ).toBeNull();
  });

  it("lets a save replace every card when it also adds one", async () => {
    const [only] = await seed(deck, 1);

    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [],
        creates: [{ front: "F", back: "R" }],
        deletes: [only?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(result.ok && result.value.cards.map((x) => x.front)).toEqual(["F"]);
  });

  it("refuses a save that would empty the deck", async () => {
    const [a, b] = await seed(deck, 2);

    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [],
        creates: [],
        deletes: [a?.id ?? "", b?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
  });

  it("validates every item before writing anything", async () => {
    const [a, b] = await seed(deck, 2);

    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [{ id: a?.id ?? "", front: "Cambiada", back: "R" }],
        creates: [{ front: "", back: "R" }],
        deletes: [b?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.EMPTY);
    expect(deck.runs).toBe(0);
    expect((await deck.flashcards.findById(a?.id ?? "", OWNER))?.front).toBe(
      "P0",
    );
  });

  it("refuses a card of another page or owner", async () => {
    await seed(deck, 2);
    const [foreign] = await seed(deck, 2, "page-2");

    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [{ id: foreign?.id ?? "", front: "F", back: "R" }],
        creates: [],
        deletes: [],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
  });

  it("refuses another owner's page", async () => {
    const result = await applyDeckEdits(
      {
        pageId: PAGE,
        updates: [],
        creates: [{ front: "F", back: "R" }],
        deletes: [],
      },
      deps(),
      OTHER,
    );

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
  });
});
