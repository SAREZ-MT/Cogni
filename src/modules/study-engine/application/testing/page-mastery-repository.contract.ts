import { describe, expect, it } from "vitest";
import type { PageMastery } from "../../domain/page-mastery";
import type { PageMasteryRepository } from "../../domain/page-mastery-repository";

export interface PageMasteryRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Returns a fresh page id owned by `ownerId`. Async so the DB runner can
  // insert a real page row (FK) per test.
  readonly newPageId: () => Promise<string>;
  readonly newId: () => string;
}

export interface PageMasteryRepositoryContractOptions {
  createRepository(): PageMasteryRepository;
  context: () => PageMasteryRepositoryContractContext;
}

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runPageMasteryRepositoryContract(
  options: PageMasteryRepositoryContractOptions,
): void {
  const makeMastery = (
    ctx: PageMasteryRepositoryContractContext,
    pageId: string,
    overrides: Partial<PageMastery> = {},
  ): PageMastery => ({
    id: ctx.newId(),
    ownerId: ctx.ownerId,
    pageId,
    level: "Aprendiendo",
    score: 0.42,
    itemsTotal: 5,
    itemsDue: 2,
    computedAt: new Date("2026-10-01T08:00:00.000Z"),
    ...overrides,
  });

  describe("PageMasteryRepository contract", () => {
    it("getByPage is null before the first upsert", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      expect(await repo.getByPage(await ctx.newPageId(), ctx.ownerId)).toBe(
        null,
      );
    });

    it("upsert then getByPage returns the row", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const mastery = makeMastery(ctx, await ctx.newPageId());
      await repo.upsert(mastery);
      expect(await repo.getByPage(mastery.pageId, ctx.ownerId)).toEqual(
        mastery,
      );
    });

    it("a second upsert overwrites the values and keeps the first id", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const first = makeMastery(ctx, await ctx.newPageId());
      await repo.upsert(first);
      const second = makeMastery(ctx, first.pageId, {
        level: "Dominado",
        score: 0.81,
        itemsTotal: 6,
        itemsDue: 0,
        computedAt: new Date("2026-10-02T08:00:00.000Z"),
      });
      await repo.upsert(second);
      expect(await repo.getByPage(first.pageId, ctx.ownerId)).toEqual({
        ...second,
        id: first.id,
      });
    });

    it("listByOwner returns one row per page ordered by pageId", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const rows = [
        makeMastery(ctx, await ctx.newPageId()),
        makeMastery(ctx, await ctx.newPageId(), { level: "Nuevo", score: 0 }),
      ];
      for (const row of rows) await repo.upsert(row);
      const listed = await repo.listByOwner(ctx.ownerId);
      const mine = listed.filter((row) =>
        rows.some((own) => own.pageId === row.pageId),
      );
      expect(mine).toEqual(
        [...rows].sort((a, b) => (a.pageId < b.pageId ? -1 : 1)),
      );
      const pageIds = listed.map((row) => row.pageId);
      expect(pageIds).toEqual([...pageIds].sort());
    });

    it("never reveals another owner's rows", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const mastery = makeMastery(ctx, await ctx.newPageId());
      await repo.upsert(mastery);
      expect(await repo.getByPage(mastery.pageId, ctx.otherOwnerId)).toBe(null);
      const others = await repo.listByOwner(ctx.otherOwnerId);
      expect(others.some((row) => row.pageId === mastery.pageId)).toBe(false);
    });
  });
}
