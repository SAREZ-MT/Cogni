import { describe, expect, it } from "vitest";
import type { ReviewLog } from "../../domain/review-log";
import type { ReviewLogRepository } from "../../domain/review-log-repository";

export interface ReviewLogRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Returns the id of a fresh study item owned by `ownerId`. Async so the
  // DB runner can insert the real item row the log references (FK).
  readonly newItemId: () => Promise<string>;
  readonly newId: () => string;
}

export interface ReviewLogRepositoryContractOptions {
  createRepository(): ReviewLogRepository;
  context: () => ReviewLogRepositoryContractContext;
}

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runReviewLogRepositoryContract(
  options: ReviewLogRepositoryContractOptions,
): void {
  const makeLog = (
    ctx: ReviewLogRepositoryContractContext,
    itemId: string,
    reviewedAt: string,
    overrides: Partial<ReviewLog> = {},
  ): ReviewLog => ({
    id: ctx.newId(),
    ownerId: ctx.ownerId,
    itemId,
    quality: 4,
    reviewedAt: new Date(reviewedAt),
    intervalBefore: 0,
    intervalAfter: 1,
    easinessAfter: 2.5,
    sessionKind: "flashcards",
    sessionId: ctx.newId(),
    ...overrides,
  });

  describe("ReviewLogRepository contract", () => {
    it("append then listByItem returns the logs oldest first", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const itemId = await ctx.newItemId();
      const second = makeLog(ctx, itemId, "2026-10-02T09:00:00.000Z", {
        quality: 1,
        intervalBefore: 1,
        intervalAfter: 1,
        easinessAfter: 1.96,
      });
      const first = makeLog(ctx, itemId, "2026-10-01T09:00:00.000Z");
      await repo.append(second);
      await repo.append(first);
      expect(await repo.listByItem(itemId, ctx.ownerId)).toEqual([
        first,
        second,
      ]);
    });

    it("breaks a reviewedAt tie by id, like the database", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const itemId = await ctx.newItemId();
      const at = "2026-10-01T09:00:00.000Z";
      const logs = [makeLog(ctx, itemId, at), makeLog(ctx, itemId, at)];
      const [high, low] = [...logs].sort((a, b) => (a.id < b.id ? 1 : -1));
      if (!high || !low) throw new Error("two logs expected");
      await repo.append(high);
      await repo.append(low);
      expect(await repo.listByItem(itemId, ctx.ownerId)).toEqual([low, high]);
    });

    it("lists only the given item's logs", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const itemId = await ctx.newItemId();
      const otherItemId = await ctx.newItemId();
      const log = makeLog(ctx, itemId, "2026-10-01T09:00:00.000Z");
      await repo.append(log);
      await repo.append(makeLog(ctx, otherItemId, "2026-10-01T09:00:00.000Z"));
      expect(await repo.listByItem(itemId, ctx.ownerId)).toEqual([log]);
    });

    it("never lists another owner's logs", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const itemId = await ctx.newItemId();
      await repo.append(makeLog(ctx, itemId, "2026-10-01T09:00:00.000Z"));
      expect(await repo.listByItem(itemId, ctx.otherOwnerId)).toEqual([]);
    });

    it("keeps every session kind", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const itemId = await ctx.newItemId();
      const exam = makeLog(ctx, itemId, "2026-10-01T09:00:00.000Z", {
        sessionKind: "exam",
        quality: 0,
      });
      const recall = makeLog(ctx, itemId, "2026-10-02T09:00:00.000Z", {
        sessionKind: "recall",
        quality: 5,
      });
      await repo.append(exam);
      await repo.append(recall);
      expect(await repo.listByItem(itemId, ctx.ownerId)).toEqual([
        exam,
        recall,
      ]);
    });
  });
}
