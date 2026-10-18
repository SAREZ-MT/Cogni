import { describe, expect, it } from "vitest";
import { newStudyItem, type StudyItem } from "../../domain/study-item";
import type { StudyItemRepository } from "../../domain/study-item-repository";

export interface StudyItemRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Returns a fresh page id owned by `ownerId`. Async so the DB runner can
  // insert a real page row (FK) per test.
  readonly newPageId: () => Promise<string>;
  readonly newId: () => string;
  // Archives the page (logical delete), so its items stop being due.
  readonly archivePage: (pageId: string) => Promise<void>;
  // Returns a page owned by `ownerId` whose notebook is archived.
  readonly newPageInArchivedNotebook: () => Promise<string>;
}

export interface StudyItemRepositoryContractOptions {
  createRepository(): StudyItemRepository;
  context: () => StudyItemRepositoryContractContext;
}

const T0 = new Date("2026-10-01T08:00:00.000Z");
const DAY_MS = 86_400_000;
const at = (days: number) => new Date(T0.getTime() + days * DAY_MS);

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runStudyItemRepositoryContract(
  options: StudyItemRepositoryContractOptions,
): void {
  const makeItem = (
    ctx: StudyItemRepositoryContractContext,
    pageId: string,
    overrides: Partial<StudyItem> = {},
  ): StudyItem => ({
    ...newStudyItem({
      id: ctx.newId(),
      ownerId: ctx.ownerId,
      pageId,
      kind: "flashcard",
      sourceId: ctx.newId(),
      now: T0,
    }),
    ...overrides,
  });

  describe("StudyItemRepository contract", () => {
    it("save then findById returns the same item", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      expect(await repo.findById(item.id, ctx.ownerId)).toEqual(item);
    });

    it("round-trips a reviewed SM-2 state exactly", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId(), {
        easiness: 2.36,
        intervalDays: 6,
        repetitions: 2,
        lapses: 1,
        dueAt: at(7),
        lastQuality: 3,
        lastReviewedAt: at(1),
        updatedAt: at(1),
      });
      await repo.save(item);
      expect(await repo.findById(item.id, ctx.ownerId)).toEqual(item);
    });

    it("save on an existing id replaces its SM-2 state", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      const reviewed: StudyItem = {
        ...item,
        easiness: 2.6,
        intervalDays: 1,
        repetitions: 1,
        dueAt: at(1),
        lastQuality: 5,
        lastReviewedAt: T0,
        updatedAt: at(0.5),
      };
      await repo.save(reviewed);
      expect(await repo.findById(item.id, ctx.ownerId)).toEqual(reviewed);
    });

    it("never overwrites or reveals another owner's item", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      await repo.save({ ...item, ownerId: ctx.otherOwnerId, repetitions: 9 });
      expect(await repo.findById(item.id, ctx.ownerId)).toEqual(item);
      expect(await repo.findById(item.id, ctx.otherOwnerId)).toBeNull();
    });

    it("rejects a second item for the same (kind, sourceId)", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      await expect(repo.save({ ...item, id: ctx.newId() })).rejects.toThrow();
      expect(
        await repo.findBySource("flashcard", item.sourceId, ctx.ownerId),
      ).toEqual(item);
    });

    it("findById returns null for an unknown id", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      expect(await repo.findById(ctx.newId(), ctx.ownerId)).toBeNull();
    });

    it("findBySource finds the item by kind and source id, owner-scoped", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      expect(
        await repo.findBySource("flashcard", item.sourceId, ctx.ownerId),
      ).toEqual(item);
      expect(
        await repo.findBySource("recall_question", item.sourceId, ctx.ownerId),
      ).toBeNull();
      expect(
        await repo.findBySource("flashcard", item.sourceId, ctx.otherOwnerId),
      ).toBeNull();
    });

    describe("listDue", () => {
      it("returns non-suspended items due before the bound, oldest first", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        const late = makeItem(ctx, pageId, { dueAt: at(2) });
        const early = makeItem(ctx, pageId, { dueAt: at(1) });
        const lastInstant = makeItem(ctx, pageId, {
          dueAt: new Date(at(3).getTime() - 1),
        });
        const atBound = makeItem(ctx, pageId, { dueAt: at(3) });
        const future = makeItem(ctx, pageId, { dueAt: at(4) });
        const suspended = makeItem(ctx, pageId, {
          dueAt: at(0),
          suspendedAt: at(0),
        });
        for (const item of [
          late,
          early,
          lastInstant,
          atBound,
          future,
          suspended,
        ]) {
          await repo.save(item);
        }
        const due = await repo.listDue(ctx.ownerId, at(3), pageId);
        expect(due.map((item) => item.id)).toEqual([
          early.id,
          late.id,
          lastInstant.id,
        ]);
      });

      it("spans every page without pageId and one page with it", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageA = await ctx.newPageId();
        const pageB = await ctx.newPageId();
        const onA = makeItem(ctx, pageA, { dueAt: at(1) });
        const onB = makeItem(ctx, pageB, { dueAt: at(1) });
        await repo.save(onA);
        await repo.save(onB);
        const all = (await repo.listDue(ctx.ownerId, at(2))).map((i) => i.id);
        expect(all).toEqual(expect.arrayContaining([onA.id, onB.id]));
        const onlyA = await repo.listDue(ctx.ownerId, at(2), pageA);
        expect(onlyA.map((item) => item.id)).toEqual([onA.id]);
      });

      it("skips items of archived pages and archived notebooks", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const active = await ctx.newPageId();
        const archived = await ctx.newPageId();
        const inArchivedNotebook = await ctx.newPageInArchivedNotebook();
        const onActive = makeItem(ctx, active, { dueAt: at(1) });
        const onArchived = makeItem(ctx, archived, { dueAt: at(1) });
        const onArchivedNotebook = makeItem(ctx, inArchivedNotebook, {
          dueAt: at(1),
        });
        for (const item of [onActive, onArchived, onArchivedNotebook]) {
          await repo.save(item);
        }
        await ctx.archivePage(archived);

        const all = (await repo.listDue(ctx.ownerId, at(2))).map((i) => i.id);
        expect(all).toContain(onActive.id);
        expect(all).not.toContain(onArchived.id);
        expect(all).not.toContain(onArchivedNotebook.id);
        expect(await repo.listDue(ctx.ownerId, at(2), archived)).toEqual([]);
      });

      it("never lists another owner's items", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const pageId = await ctx.newPageId();
        await repo.save(makeItem(ctx, pageId));
        expect(await repo.listDue(ctx.otherOwnerId, at(10), pageId)).toEqual(
          [],
        );
      });
    });

    it("listByPage returns every item of the page, suspended included, by creation", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      const second = makeItem(ctx, pageId, { createdAt: at(1) });
      const first = makeItem(ctx, pageId, {
        createdAt: at(0),
        suspendedAt: at(2),
      });
      const elsewhere = makeItem(ctx, await ctx.newPageId());
      await repo.save(second);
      await repo.save(first);
      await repo.save(elsewhere);
      const items = await repo.listByPage(pageId, ctx.ownerId);
      expect(items.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(await repo.listByPage(pageId, ctx.otherOwnerId)).toEqual([]);
    });

    describe("suspend", () => {
      it("sets suspendedAt and updatedAt and returns the item", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const item = makeItem(ctx, await ctx.newPageId());
        await repo.save(item);
        const suspended = await repo.suspend(item.id, ctx.ownerId, at(1));
        const expected = { ...item, suspendedAt: at(1), updatedAt: at(1) };
        expect(suspended).toEqual(expected);
        expect(await repo.findById(item.id, ctx.ownerId)).toEqual(expected);
      });

      it("is idempotent: a second call keeps the first suspendedAt", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const item = makeItem(ctx, await ctx.newPageId());
        await repo.save(item);
        await repo.suspend(item.id, ctx.ownerId, at(1));
        const again = await repo.suspend(item.id, ctx.ownerId, at(5));
        expect(again?.suspendedAt).toEqual(at(1));
        expect(again?.updatedAt).toEqual(at(1));
      });

      it("returns null for an unknown id or another owner", async () => {
        const ctx = options.context();
        const repo = options.createRepository();
        const item = makeItem(ctx, await ctx.newPageId());
        await repo.save(item);
        expect(await repo.suspend(ctx.newId(), ctx.ownerId, at(1))).toBeNull();
        expect(await repo.suspend(item.id, ctx.otherOwnerId, at(1))).toBeNull();
        expect((await repo.findById(item.id, ctx.ownerId))?.suspendedAt).toBe(
          null,
        );
      });
    });

    it("lock resolves for an owned item, an unknown id and another owner, changing nothing", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const item = makeItem(ctx, await ctx.newPageId());
      await repo.save(item);
      await repo.lock(item.id, ctx.ownerId);
      await repo.lock(ctx.newId(), ctx.ownerId);
      await repo.lock(item.id, ctx.otherOwnerId);
      expect(await repo.findById(item.id, ctx.ownerId)).toEqual(item);
    });

    it("lockPage resolves for an owned page, an unknown page and another owner, changing nothing", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const pageId = await ctx.newPageId();
      const item = makeItem(ctx, pageId);
      await repo.save(item);
      await repo.lockPage(pageId, ctx.ownerId, 1_000);
      await repo.lockPage(ctx.newId(), ctx.ownerId, 1_000);
      await repo.lockPage(pageId, ctx.otherOwnerId, 1_000);
      expect(await repo.listByPage(pageId, ctx.ownerId)).toEqual([item]);
    });
  });
}
