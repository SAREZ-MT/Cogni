import { describe, expect, it } from "vitest";
import type { Flashcard } from "../domain";
import { listDecks } from "./list-decks";
import { InMemoryFlashcardRepository } from "./testing/in-memory-flashcard-repository";

const card = (
  pageId: string,
  ownerId: string,
  position: number,
): Flashcard => ({
  id: `${pageId}-${ownerId}-${position}`,
  ownerId,
  pageId,
  generationId: null,
  front: "P",
  back: "R",
  origin: "ai",
  position,
  createdAt: new Date("2026-10-04T10:00:00.000Z"),
  updatedAt: new Date("2026-10-04T10:00:00.000Z"),
  archivedAt: null,
});

describe("listDecks", () => {
  it("lists the owner's decks with their derived card counts", async () => {
    const flashcards = new InMemoryFlashcardRepository((pageId) => ({
      notebookId: "n1",
      pageTitle: `Título ${pageId}`,
      notebookTitle: "Biología",
      notebookColor: "blue",
    }));
    await flashcards.insertMany([
      card("p1", "o1", 0),
      card("p1", "o1", 1),
      card("p2", "o1", 0),
      card("p3", "o2", 0),
    ]);

    const result = await listDecks({ flashcards }, "o1");

    expect(result.ok && result.value.map((d) => [d.pageId, d.count])).toEqual([
      ["p1", 2],
      ["p2", 1],
    ]);
  });

  it("returns an empty list when the owner has no cards", async () => {
    const result = await listDecks(
      { flashcards: new InMemoryFlashcardRepository() },
      "o1",
    );

    expect(result).toEqual({ ok: true, value: [] });
  });
});
