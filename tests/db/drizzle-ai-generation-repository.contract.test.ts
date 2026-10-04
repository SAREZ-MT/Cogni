import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { runAiGenerationRepositoryContract } from "@/modules/ai/application/testing/ai-generation-repository.contract";
// Concrete file, not the infrastructure barrel (same convention as the other
// DB tests in this directory).
import { DrizzleAiGenerationRepository } from "@/modules/ai/infrastructure/drizzle-ai-generation-repository";
import { aiGenerations, notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("ai-generation-owner");
  const otherOwner = await createTestOwner("ai-generation-other");
  const notebookId = randomUUID();
  const pageId = randomUUID();

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
    title: "Cuaderno del contrato de ai_generations",
    position: 1,
  });
  await db.insert(pages).values({
    id: pageId,
    ownerId: owner.id,
    notebookId,
    title: "Página del contrato",
    content: { type: "doc", content: [] },
    position: 1,
  });

  runAiGenerationRepositoryContract({
    createRepository: () => new DrizzleAiGenerationRepository(db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      pageId,
      newId: () => randomUUID(),
    }),
  });

  describe("DrizzleAiGenerationRepository constraints", () => {
    const row = () => ({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      purpose: "generate_flashcards" as const,
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      promptVersion: "v1",
      status: "running" as const,
    });

    it("accepts a valid row (control for the rejections below)", async () => {
      await expect(
        db.insert(aiGenerations).values(row()),
      ).resolves.toBeDefined();
    });

    it("rejects a status outside queued|running|done|failed", async () => {
      await expect(
        db
          .insert(aiGenerations)
          // biome-ignore lint/suspicious/noExplicitAny: forcing an invalid value past the type
          .values({ ...row(), status: "weird" as any }),
      ).rejects.toThrow();
    });

    it("rejects a purpose outside the AiPurpose values", async () => {
      await expect(
        db
          .insert(aiGenerations)
          // biome-ignore lint/suspicious/noExplicitAny: forcing an invalid value past the type
          .values({ ...row(), purpose: "write_a_poem" as any }),
      ).rejects.toThrow();
    });

    it("keeps the row with a null page_id when its page is deleted", async () => {
      const tempPageId = randomUUID();
      await db.insert(pages).values({
        id: tempPageId,
        ownerId: owner.id,
        notebookId,
        title: "Página efímera",
        content: { type: "doc", content: [] },
        position: 9,
      });
      const repo = new DrizzleAiGenerationRepository(db);
      const id = randomUUID();
      const now = new Date("2026-10-03T10:00:00.000Z");
      await repo.create({
        id,
        ownerId: owner.id,
        pageId: tempPageId,
        purpose: "generate_flashcards",
        provider: "gemini",
        model: "m",
        promptVersion: "v1",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "done",
        error: null,
        createdAt: now,
        updatedAt: now,
      });
      await db.delete(pages).where(eqId(tempPageId));
      const found = await repo.findById(id, owner.id);
      expect(found).not.toBeNull();
      expect(found?.pageId).toBeNull();
    });
  });
}

import { eq } from "drizzle-orm";

function eqId(id: string) {
  return eq(pages.id, id);
}
