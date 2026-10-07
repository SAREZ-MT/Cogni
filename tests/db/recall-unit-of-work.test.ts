import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { requestRecallGeneration } from "@/modules/active-recall/application/request-recall-generation";
import { newRecallQuestion } from "@/modules/active-recall/domain/recall-question";
import { DrizzleRecallFingerprints } from "@/modules/active-recall/infrastructure/drizzle-recall-fingerprints";
import { DrizzleRecallQuestionRepository } from "@/modules/active-recall/infrastructure/drizzle-recall-question-repository";
import { DrizzleRecallUnitOfWork } from "@/modules/active-recall/infrastructure/drizzle-recall-unit-of-work";
import type { AiGeneration } from "@/modules/ai";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import {
  aiGenerations,
  generationFingerprints,
  notebooks,
  pages,
  profiles,
  recallQuestions,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { fingerprintParagraph } from "@/shared/kernel/page-paragraphs";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The recall unit of work against the real database: a generation's
// questions and their recall_question study items commit together, and a
// failing study item write rolls the questions back.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-uow-owner");
  const notebookId = randomUUID();
  const pageId = randomUUID();
  const NOW = new Date("2026-10-06T10:00:00.000Z");
  const RESET = new Date("2026-10-07T00:00:00.000Z");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de la unidad de trabajo de recordación",
    position: 1,
  });
  await db.insert(pages).values({
    id: pageId,
    ownerId: owner.id,
    notebookId,
    title: "Mitocondria",
    content: { type: "doc", content: [] },
    position: 1,
  });

  function generation(id: string): AiGeneration {
    return {
      id,
      ownerId: owner.id,
      pageId,
      purpose: "generate_recall_questions",
      provider: "fake",
      model: "fake-model",
      promptVersion: "generate_recall_questions/v1",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      status: "done",
      error: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  describe("DrizzleRecallUnitOfWork", { timeout: 30_000 }, () => {
    it("stores a generation's questions with one due recall_question study item each", async () => {
      // recall_questions.generation_id references the audited generation.
      const generationId = randomUUID();
      await db.insert(aiGenerations).values(generation(generationId));
      let checks = 0;
      const result = await requestRecallGeneration(
        { pageId },
        {
          limiter: {
            check: async () => {
              checks += 1;
              return { allowed: true, remaining: 3, resetAt: RESET };
            },
            peek: async () => ({ allowed: true, remaining: 4, resetAt: RESET }),
          },
          pages: {
            async getPageText(id, ownerId) {
              return ownerId === owner.id && id === pageId
                ? ok({ title: "Mitocondria", plainText: "La mitocondria." })
                : err(new DomainError("PAGE_NOT_FOUND", id));
            },
          },
          ai: {
            generateStructured: async () =>
              ok({
                object: {
                  questions: [1, 2, 3].map((n) => ({
                    prompt: `Explica la idea ${n}.`,
                    rubric: {
                      keyConcepts: ["ATP", `idea ${n}`],
                      acceptableAnswerSummary: "La mitocondria produce ATP.",
                    },
                  })),
                },
                generation: generation(generationId),
              }),
          },
          questions: new DrizzleRecallQuestionRepository(db),
          fingerprints: new DrizzleRecallFingerprints(db),
          uow: new DrizzleRecallUnitOfWork(db),
          clock: createFixedClock(NOW),
          ids: { next: () => randomUUID() },
          tokenCap: 12000,
        },
        owner.id,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(checks).toBe(1);
      const stored = await db
        .select()
        .from(recallQuestions)
        .where(eq(recallQuestions.pageId, pageId));
      expect(stored.map((q) => q.prompt).sort()).toEqual([
        "Explica la idea 1.",
        "Explica la idea 2.",
        "Explica la idea 3.",
      ]);
      expect(stored.every((q) => q.generationId === generationId)).toBe(true);
      const items = await db
        .select()
        .from(studyItems)
        .where(
          and(
            eq(studyItems.pageId, pageId),
            eq(studyItems.kind, "recall_question"),
          ),
        );
      expect(items.map((i) => i.sourceId).sort()).toEqual(
        stored.map((q) => q.id).sort(),
      );
      expect(items.every((i) => i.dueAt.getTime() === NOW.getTime())).toBe(
        true,
      );
      // Phase 6 T5c: the sent paragraph's fingerprint commits with them.
      const fingerprints = await db
        .select()
        .from(generationFingerprints)
        .where(eq(generationFingerprints.pageId, pageId));
      expect(fingerprints.map((f) => [f.technique, f.fingerprint])).toEqual([
        ["recall", fingerprintParagraph("La mitocondria.")],
      ]);
    });

    it("rolls the questions back when a study item cannot be written", async () => {
      const question = newRecallQuestion(
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          prompt: "Describe la membrana interna.",
          rubric: {
            keyConcepts: ["crestas", "membrana"],
            acceptableAnswerSummary: "Forma crestas.",
          },
          origin: "manual",
          generationId: null,
        },
        NOW,
      );
      if (!question.ok) throw question.error;
      const item = () =>
        newStudyItem({
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          kind: "recall_question",
          sourceId: question.value.id,
          now: NOW,
        });

      // The second save breaks unique (kind, source_id) after the question
      // was inserted in the same transaction.
      await expect(
        new DrizzleRecallUnitOfWork(db).run(async (repositories) => {
          await repositories.questions.saveMany([question.value]);
          await repositories.fingerprints.addMany({
            ownerId: owner.id,
            pageId,
            fingerprints: ["d".repeat(64)],
            now: NOW,
          });
          await repositories.studyItems.save(item());
          await repositories.studyItems.save(item());
        }),
      ).rejects.toThrow();

      const rows = await db
        .select()
        .from(recallQuestions)
        .where(eq(recallQuestions.id, question.value.id));
      expect(rows).toEqual([]);
      const items = await db
        .select()
        .from(studyItems)
        .where(eq(studyItems.sourceId, question.value.id));
      expect(items).toEqual([]);
      const fingerprints = await db
        .select()
        .from(generationFingerprints)
        .where(eq(generationFingerprints.fingerprint, "d".repeat(64)));
      expect(fingerprints).toEqual([]);
    });
  });
}
