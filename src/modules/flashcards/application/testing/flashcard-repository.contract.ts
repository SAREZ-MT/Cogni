import { describe, expect, it } from "vitest";
import type { Flashcard } from "../../domain/flashcard";
import type { FlashcardRepository } from "../../domain/flashcard-repository";

export interface FlashcardRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Returns a page id owned by `ownerId` that holds no cards yet. Async so
  // the DB runner can insert a real page row (FK) per test.
  readonly newPageId: () => Promise<string>;
  readonly newId: () => string;
}

export interface FlashcardRepositoryContractOptions {
  createRepository(): FlashcardRepository;
  context: () => FlashcardRepositoryContractContext;
}

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runFlashcardRepositoryContract(
  options: FlashcardRepositoryContractOptions,
): void {
  const makeCard = (
    ctx: FlashcardRepositoryContractContext,
    pageId: string,
    position: number,
    overrides: Partial<Flashcard> = {},
  ): Flashcard => ({
    id: ctx.newId(),
    ownerId: ctx.ownerId,
    pageId,
    generationId: null,
    front: `Pregunta ${position}`,
    back: `Respuesta ${position}`,
    origin: "manual",
    position,
    createdAt: new Date("2026-10-03T10:00:00.000Z"),
    updatedAt: new Date("2026-10-03T10:00:00.000Z"),
    ...overrides,
  });

  describe("FlashcardRepository contract", () => {
    it("nextPosition starts at 0 and then follows the highest position", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      expect(await repo.nextPosition(pageId, ctx.ownerId)).toBe(0);
      await repo.insertMany([
        makeCard(ctx, pageId, 0),
        makeCard(ctx, pageId, 1),
      ]);
      expect(await repo.nextPosition(pageId, ctx.ownerId)).toBe(2);
    });

    it("listByPage returns the cards ordered by position", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      await repo.insertMany([
        makeCard(ctx, pageId, 2),
        makeCard(ctx, pageId, 0),
        makeCard(ctx, pageId, 1),
      ]);
      const cards = await repo.listByPage(pageId, ctx.ownerId);
      expect(cards.map((card) => card.position)).toEqual([0, 1, 2]);
      expect(cards[0]?.front).toBe("Pregunta 0");
      expect(cards[0]?.generationId).toBeNull();
    });

    it("countByPage counts only the page's cards", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      const otherPageId = await ctx.newPageId();
      expect(await repo.countByPage(pageId, ctx.ownerId)).toBe(0);
      await repo.insertMany([
        makeCard(ctx, pageId, 0),
        makeCard(ctx, pageId, 1),
      ]);
      await repo.insertMany([makeCard(ctx, otherPageId, 0)]);
      expect(await repo.countByPage(pageId, ctx.ownerId)).toBe(2);
    });

    it("scopes every read by owner", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      await repo.insertMany([makeCard(ctx, pageId, 0)]);
      expect(await repo.listByPage(pageId, ctx.otherOwnerId)).toEqual([]);
      expect(await repo.countByPage(pageId, ctx.otherOwnerId)).toBe(0);
      expect(await repo.nextPosition(pageId, ctx.otherOwnerId)).toBe(0);
    });

    it("insertMany with no cards is a no-op", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      await repo.insertMany([]);
      expect(await repo.countByPage(pageId, ctx.ownerId)).toBe(0);
    });
  });
}
