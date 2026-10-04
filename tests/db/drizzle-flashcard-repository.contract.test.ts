import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { runFlashcardRepositoryContract } from "@/modules/flashcards/application/testing/flashcard-repository.contract";
import type { Flashcard } from "@/modules/flashcards/domain/flashcard";
import { DrizzleFlashcardRepository } from "@/modules/flashcards/infrastructure/drizzle-flashcard-repository";
import { flashcards, notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("flashcard-owner");
  const otherOwner = await createTestOwner("flashcard-other");
  const notebookId = randomUUID();
  let nextPagePosition = 1;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno del contrato de flashcards",
    color: "purple",
    position: 1,
  });

  const pageTitles = new Map<string, string>();

  async function newPage(): Promise<string> {
    const id = randomUUID();
    pageTitles.set(id, `Página ${id}`);
    await db.insert(pages).values({
      id,
      ownerId: owner.id,
      notebookId,
      title: `Página ${id}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    return id;
  }

  runFlashcardRepositoryContract({
    createRepository: () => new DrizzleFlashcardRepository(db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newPageId: newPage,
      newId: () => randomUUID(),
      pageInfo: (pageId) => ({
        notebookId,
        pageTitle: pageTitles.get(pageId) ?? "",
        notebookTitle: "Cuaderno del contrato de flashcards",
        notebookColor: "purple",
      }),
      archivePage: async (pageId) => {
        await db
          .update(pages)
          .set({ archivedAt: new Date() })
          .where(eq(pages.id, pageId));
      },
    }),
  });

  describe("DrizzleFlashcardRepository constraints", () => {
    const card = (pageId: string, overrides: Partial<Flashcard> = {}) => ({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      front: "Frente",
      back: "Reverso",
      origin: "manual" as const,
      position: 0,
      ...overrides,
    });

    it("cascades: deleting a page deletes its flashcards", async () => {
      const pageId = await newPage();
      const repo = new DrizzleFlashcardRepository(db);
      await repo.insertMany([
        {
          ...card(pageId),
          generationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ]);
      expect(await repo.countByPage(pageId, owner.id)).toBe(1);
      await db.delete(pages).where(eq(pages.id, pageId));
      expect(await repo.countByPage(pageId, owner.id)).toBe(0);
    });

    it("rejects a blank front", async () => {
      const pageId = await newPage();
      await expect(
        db.insert(flashcards).values(card(pageId, { front: "   " })),
      ).rejects.toThrow();
    });

    it("rejects a blank back", async () => {
      const pageId = await newPage();
      await expect(
        db.insert(flashcards).values(card(pageId, { back: "" })),
      ).rejects.toThrow();
    });

    it("rejects an origin outside ai|manual", async () => {
      const pageId = await newPage();
      await expect(
        db
          .insert(flashcards)
          // biome-ignore lint/suspicious/noExplicitAny: forcing an invalid value past the type
          .values(card(pageId, { origin: "robot" as any })),
      ).rejects.toThrow();
    });
  });
}
