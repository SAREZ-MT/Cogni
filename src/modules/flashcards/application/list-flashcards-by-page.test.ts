import { describe, expect, it } from "vitest";
import { createFlashcard } from "../domain";
import { listFlashcardsByPage } from "./list-flashcards-by-page";
import { InMemoryFlashcardRepository } from "./testing/in-memory-flashcard-repository";

const NOW = new Date("2026-10-04T10:00:00.000Z");

async function seed(
  repo: InMemoryFlashcardRepository,
  id: string,
  ownerId: string,
  position: number,
) {
  const card = createFlashcard(
    {
      id,
      ownerId,
      pageId: "p1",
      generationId: null,
      front: "f",
      back: "b",
      origin: "ai",
      position,
    },
    NOW,
  );
  if (!card.ok) throw new Error("setup failed");
  await repo.insertMany([card.value]);
}

describe("listFlashcardsByPage", () => {
  it("returns the owner's cards ordered by position", async () => {
    const flashcards = new InMemoryFlashcardRepository();
    await seed(flashcards, "b", "o1", 1);
    await seed(flashcards, "a", "o1", 0);
    await seed(flashcards, "x", "o2", 0);

    const result = await listFlashcardsByPage(
      { pageId: "p1" },
      { flashcards },
      "o1",
    );

    expect(result.ok && result.value.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns an empty list for a page without cards", async () => {
    const flashcards = new InMemoryFlashcardRepository();
    const result = await listFlashcardsByPage(
      { pageId: "p1" },
      { flashcards },
      "o1",
    );
    expect(result).toEqual({ ok: true, value: [] });
  });
});
