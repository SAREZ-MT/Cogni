import { describe, expect, it } from "vitest";
import type {
  GenerationFingerprintRepository,
  GenerationTechnique,
} from "../generation-fingerprints";

export interface GenerationFingerprintsContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // A fresh page owned by `ownerId` (async so the DB runner can insert the
  // real page row, FK).
  readonly newPageId: () => Promise<string>;
}

export interface GenerationFingerprintsContractOptions {
  // Repositories built over ONE shared store, one per technique.
  createRepository(
    technique: GenerationTechnique,
  ): GenerationFingerprintRepository;
  context: () => GenerationFingerprintsContractContext;
}

const NOW = new Date("2026-10-07T09:00:00.000Z");
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

// Shared by the in-memory fake (unit suite) and the Drizzle adapters
// (`pnpm test:db`). Assertions only look at the pages each test creates:
// the DB runner shares cogni-dev.
export function runGenerationFingerprintsContract(
  options: GenerationFingerprintsContractOptions,
): void {
  describe("GenerationFingerprintRepository contract", () => {
    it("lists nothing for a page never generated", async () => {
      const ctx = options.context();
      const pageId = await ctx.newPageId();
      const repo = options.createRepository("flashcards");
      expect(await repo.listByPage(pageId, ctx.ownerId)).toEqual([]);
    });

    it("lists what was added, across generations", async () => {
      const ctx = options.context();
      const pageId = await ctx.newPageId();
      const repo = options.createRepository("exam");
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A, B],
        now: NOW,
      });
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [C],
        now: NOW,
      });
      expect((await repo.listByPage(pageId, ctx.ownerId)).sort()).toEqual([
        A,
        B,
        C,
      ]);
    });

    it("ignores a fingerprint already stored and an empty batch", async () => {
      const ctx = options.context();
      const pageId = await ctx.newPageId();
      const repo = options.createRepository("recall");
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A],
        now: NOW,
      });
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A, B, B],
        now: NOW,
      });
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [],
        now: NOW,
      });
      expect((await repo.listByPage(pageId, ctx.ownerId)).sort()).toEqual([
        A,
        B,
      ]);
    });

    it("keeps each technique's fingerprints apart", async () => {
      const ctx = options.context();
      const pageId = await ctx.newPageId();
      const flashcards = options.createRepository("flashcards");
      const exam = options.createRepository("exam");
      const recall = options.createRepository("recall");
      await flashcards.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A],
        now: NOW,
      });
      await exam.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A, B],
        now: NOW,
      });
      expect(await flashcards.listByPage(pageId, ctx.ownerId)).toEqual([A]);
      expect((await exam.listByPage(pageId, ctx.ownerId)).sort()).toEqual([
        A,
        B,
      ]);
      expect(await recall.listByPage(pageId, ctx.ownerId)).toEqual([]);
    });

    it("keeps pages and owners apart", async () => {
      const ctx = options.context();
      const pageId = await ctx.newPageId();
      const otherPageId = await ctx.newPageId();
      const repo = options.createRepository("flashcards");
      await repo.addMany({
        ownerId: ctx.ownerId,
        pageId,
        fingerprints: [A],
        now: NOW,
      });
      expect(await repo.listByPage(otherPageId, ctx.ownerId)).toEqual([]);
      expect(await repo.listByPage(pageId, ctx.otherOwnerId)).toEqual([]);
    });
  });
}
