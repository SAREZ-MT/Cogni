import { describe, expect, it } from "vitest";
import type { AiGeneration } from "../../domain";
import type { AiGenerationRepository } from "../ports";

export interface AiGenerationContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // A page owned by `ownerId` (the DB runner inserts a real row for the FK).
  readonly pageId: string;
  readonly newId: () => string;
}

export interface AiGenerationRepositoryContractOptions {
  createRepository(): AiGenerationRepository;
  context: () => AiGenerationContractContext;
}

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runAiGenerationRepositoryContract(
  options: AiGenerationRepositoryContractOptions,
): void {
  const makeGeneration = (
    ctx: AiGenerationContractContext,
    overrides: Partial<AiGeneration> = {},
  ): AiGeneration => ({
    id: ctx.newId(),
    ownerId: ctx.ownerId,
    pageId: ctx.pageId,
    purpose: "generate_flashcards",
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    promptVersion: "v1",
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    status: "running",
    error: null,
    createdAt: new Date("2026-10-03T10:00:00.000Z"),
    updatedAt: new Date("2026-10-03T10:00:00.000Z"),
    ...overrides,
  });

  describe("AiGenerationRepository contract", () => {
    it("create then findById round-trips every field", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const generation = makeGeneration(ctx);
      await repo.create(generation);
      expect(await repo.findById(generation.id, ctx.ownerId)).toEqual(
        generation,
      );
    });

    it("accepts a generation that is not tied to a page", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const generation = makeGeneration(ctx, { pageId: null });
      await repo.create(generation);
      const found = await repo.findById(generation.id, ctx.ownerId);
      expect(found?.pageId).toBeNull();
    });

    it("update persists the new status, usage and error", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const generation = makeGeneration(ctx);
      await repo.create(generation);
      const updated: AiGeneration = {
        ...generation,
        status: "failed",
        error: "invalid_output",
        inputTokens: 120,
        outputTokens: 30,
        latencyMs: 850,
        updatedAt: new Date("2026-10-03T10:00:05.000Z"),
      };
      await repo.update(updated);
      expect(await repo.findById(generation.id, ctx.ownerId)).toEqual(updated);
    });

    it("findById is owner-scoped: another owner gets null", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const generation = makeGeneration(ctx);
      await repo.create(generation);
      expect(await repo.findById(generation.id, ctx.otherOwnerId)).toBeNull();
    });

    it("findById of an unknown id is null", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      expect(await repo.findById(ctx.newId(), ctx.ownerId)).toBeNull();
    });

    it("update never touches another owner's row", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const generation = makeGeneration(ctx);
      await repo.create(generation);
      await repo.update({
        ...generation,
        ownerId: ctx.otherOwnerId,
        status: "done",
      });
      const found = await repo.findById(generation.id, ctx.ownerId);
      expect(found?.status).toBe("running");
    });
  });
}
