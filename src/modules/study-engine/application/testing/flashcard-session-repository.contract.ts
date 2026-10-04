import { describe, expect, it } from "vitest";
import {
  type FlashcardSession,
  newFlashcardSession,
} from "../../domain/flashcard-session";
import type { FlashcardSessionRepository } from "../../domain/flashcard-session-repository";

export interface FlashcardSessionRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Returns a fresh page id owned by `ownerId`. Async so the DB runner can
  // insert a real page row (FK) per test.
  readonly newPageId: () => Promise<string>;
  readonly newId: () => string;
}

export interface FlashcardSessionRepositoryContractOptions {
  createRepository(): FlashcardSessionRepository;
  context: () => FlashcardSessionRepositoryContractContext;
}

const T0 = new Date("2026-10-01T08:00:00.000Z");
const T1 = new Date("2026-10-01T08:10:00.000Z");
const T2 = new Date("2026-10-01T08:20:00.000Z");

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runFlashcardSessionRepositoryContract(
  options: FlashcardSessionRepositoryContractOptions,
): void {
  const makeSession = async (
    ctx: FlashcardSessionRepositoryContractContext,
    pageId: string | null = null,
  ): Promise<FlashcardSession> =>
    newFlashcardSession({
      id: ctx.newId(),
      ownerId: ctx.ownerId,
      pageId,
      now: T0,
    });

  describe("FlashcardSessionRepository contract", () => {
    it("insert then findById returns the open session", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx, await ctx.newPageId());
      await repo.insert(session);
      expect(await repo.findById(session.id, ctx.ownerId)).toEqual(session);
    });

    it("keeps a multi-page session without a page", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx, null);
      await repo.insert(session);
      expect((await repo.findById(session.id, ctx.ownerId))?.pageId).toBe(null);
    });

    it("never reveals another owner's session", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx);
      await repo.insert(session);
      expect(await repo.findById(session.id, ctx.otherOwnerId)).toBe(null);
      expect(await repo.findById(ctx.newId(), ctx.ownerId)).toBe(null);
    });

    it("recordGrade counts reviews and 'Otra vez' answers", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx);
      await repo.insert(session);
      await repo.recordGrade(session.id, ctx.ownerId, false);
      const updated = await repo.recordGrade(session.id, ctx.ownerId, true);
      expect(updated).toEqual({ ...session, reviewedCount: 2, againCount: 1 });
      expect(await repo.findById(session.id, ctx.ownerId)).toEqual(updated);
    });

    it("recordGrade never touches another owner's session", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx);
      await repo.insert(session);
      expect(await repo.recordGrade(session.id, ctx.otherOwnerId, true)).toBe(
        null,
      );
      expect(await repo.findById(session.id, ctx.ownerId)).toEqual(session);
    });

    it("finish sets finishedAt once and keeps the first one", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx);
      await repo.insert(session);
      const finished = await repo.finish(session.id, ctx.ownerId, T1);
      expect(finished).toEqual({ ...session, finishedAt: T1 });
      const again = await repo.finish(session.id, ctx.ownerId, T2);
      expect(again?.finishedAt).toEqual(T1);
    });

    it("finish returns null for an unknown id or another owner", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const session = await makeSession(ctx);
      await repo.insert(session);
      expect(await repo.finish(ctx.newId(), ctx.ownerId, T1)).toBe(null);
      expect(await repo.finish(session.id, ctx.otherOwnerId, T1)).toBe(null);
      expect(
        (await repo.findById(session.id, ctx.ownerId))?.finishedAt,
      ).toBeNull();
    });
  });
}
