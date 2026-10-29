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
  // Describes the page created by `newPageId` (notebook and titles), as the
  // deck listing must report it.
  readonly pageInfo: (pageId: string) => {
    readonly notebookId: string;
    readonly pageTitle: string;
    readonly notebookTitle: string;
    readonly notebookColor: string | null;
  };
  // Archives the page so it drops out of the deck listing.
  readonly archivePage: (pageId: string) => Promise<void>;
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
    archivedAt: null,
    ...overrides,
  });
  const ARCHIVED_AT = new Date("2026-10-04T09:00:00.000Z");

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

    it("findById returns the owner's card, archived or not", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      const card = makeCard(ctx, pageId, 0);
      await repo.insertMany([card]);
      expect(await repo.findById(card.id, ctx.ownerId)).toEqual(card);
      expect(await repo.findById(card.id, ctx.otherOwnerId)).toBeNull();
      expect(await repo.findById(ctx.newId(), ctx.ownerId)).toBeNull();
      await repo.archive(card.id, ctx.ownerId, ARCHIVED_AT);
      expect(await repo.findById(card.id, ctx.ownerId)).toMatchObject({
        id: card.id,
        archivedAt: ARCHIVED_AT,
      });
    });

    describe("archive", () => {
      it("hides the card from listByPage and countByPage", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        const kept = makeCard(ctx, pageId, 0);
        const archived = makeCard(ctx, pageId, 1);
        await repo.insertMany([kept, archived]);
        await repo.archive(archived.id, ctx.ownerId, ARCHIVED_AT);
        const cards = await repo.listByPage(pageId, ctx.ownerId);
        expect(cards.map((card) => card.id)).toEqual([kept.id]);
        expect(await repo.countByPage(pageId, ctx.ownerId)).toBe(1);
      });

      it("keeps positions monotonic: nextPosition still counts archived cards", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        const first = makeCard(ctx, pageId, 0);
        const last = makeCard(ctx, pageId, 1);
        await repo.insertMany([first, last]);
        await repo.archive(last.id, ctx.ownerId, ARCHIVED_AT);
        expect(await repo.nextPosition(pageId, ctx.ownerId)).toBe(2);
      });

      it("keeps the first archivedAt when archived twice", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        const card = makeCard(ctx, pageId, 0);
        await repo.insertMany([card]);
        await repo.archive(card.id, ctx.ownerId, ARCHIVED_AT);
        await repo.archive(
          card.id,
          ctx.ownerId,
          new Date("2026-10-05T09:00:00.000Z"),
        );
        expect((await repo.findById(card.id, ctx.ownerId))?.archivedAt).toEqual(
          ARCHIVED_AT,
        );
      });

      it("never archives another owner's card", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        const card = makeCard(ctx, pageId, 0);
        await repo.insertMany([card]);
        await repo.archive(card.id, ctx.otherOwnerId, ARCHIVED_AT);
        expect(await repo.findById(card.id, ctx.ownerId)).toEqual(card);
      });
    });

    it("lockDeck resolves for an owned page, with or without cards", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      await expect(repo.lockDeck(pageId, ctx.ownerId)).resolves.toBeUndefined();
    });

    describe("countByOwnerGroupedByPage", () => {
      it("returns one entry per page that has cards, with its count and page metadata", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageA = await ctx.newPageId();
        const pageB = await ctx.newPageId();
        const emptyPage = await ctx.newPageId();
        await repo.insertMany([
          makeCard(ctx, pageA, 0),
          makeCard(ctx, pageA, 1),
          makeCard(ctx, pageA, 2),
          makeCard(ctx, pageB, 0),
        ]);
        const decks = await repo.countByOwnerGroupedByPage(ctx.ownerId);
        const byPage = new Map(decks.map((deck) => [deck.pageId, deck]));
        expect(byPage.get(pageA)).toEqual({
          pageId: pageA,
          ...ctx.pageInfo(pageA),
          count: 3,
          // Phase 8 H17: the newest active card's creation and the
          // earliest due date of the deck's study items (none here).
          latestCardAt: new Date("2026-10-03T10:00:00.000Z"),
          nextDueAt: null,
        });
        expect(byPage.get(pageB)?.count).toBe(1);
        expect(byPage.has(emptyPage)).toBe(false);
      });

      it("never lists another owner's decks", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        await repo.insertMany([makeCard(ctx, pageId, 0)]);
        const decks = await repo.countByOwnerGroupedByPage(ctx.otherOwnerId);
        expect(decks.some((deck) => deck.pageId === pageId)).toBe(false);
      });

      it("counts only active cards and drops a deck whose cards are all archived", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const partly = await ctx.newPageId();
        const fully = await ctx.newPageId();
        const active = makeCard(ctx, partly, 0);
        const gone = makeCard(ctx, partly, 1);
        const onlyCard = makeCard(ctx, fully, 0);
        await repo.insertMany([active, gone, onlyCard]);
        await repo.archive(gone.id, ctx.ownerId, ARCHIVED_AT);
        await repo.archive(onlyCard.id, ctx.ownerId, ARCHIVED_AT);
        const decks = await repo.countByOwnerGroupedByPage(ctx.ownerId);
        const byPage = new Map(decks.map((deck) => [deck.pageId, deck]));
        expect(byPage.get(partly)?.count).toBe(1);
        expect(byPage.has(fully)).toBe(false);
      });

      it("drops the deck of an archived page", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        await repo.insertMany([makeCard(ctx, pageId, 0)]);
        await ctx.archivePage(pageId);
        const decks = await repo.countByOwnerGroupedByPage(ctx.ownerId);
        expect(decks.some((deck) => deck.pageId === pageId)).toBe(false);
      });
    });
  });
}
