import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { applyRecallEdits } from "@/modules/active-recall/application/apply-recall-edits";
import { createRecallQuestion } from "@/modules/active-recall/application/create-recall-question";
import { RECALL_ERROR } from "@/modules/active-recall/domain/errors";
import { DrizzleRecallUnitOfWork } from "@/modules/active-recall/infrastructure/drizzle-recall-unit-of-work";
import {
  notebooks,
  pages,
  profiles,
  recallAnswers,
  recallQuestions,
  recallSessions,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Phase 8 H18: the recall edit page saves its draft in one transaction; a
// deleted question takes its answers, its study item and its review
// history with it, so the metrics stop counting it.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-edits-owner");
  const notebookId = randomUUID();
  const NOW = new Date("2026-10-29T10:00:00.000Z");
  let nextPosition = 1;

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
    title: "Cuaderno de edición de recordación",
    position: 1,
  });

  async function newPage(): Promise<string> {
    const id = randomUUID();
    await db.insert(pages).values({
      id,
      ownerId: owner.id,
      notebookId,
      title: `Página ${id}`,
      content: { type: "doc", content: [] },
      position: nextPosition++,
    });
    return id;
  }

  const deps = () => ({
    pages: {
      async getPageText(pageId: string, ownerId: string) {
        return ownerId === owner.id
          ? ok({ title: "Página", plainText: "" })
          : err(new DomainError("PAGE_NOT_FOUND", pageId));
      },
    },
    uow: new DrizzleRecallUnitOfWork(db),
    clock: createFixedClock(NOW),
    ids: { next: () => randomUUID() },
  });

  // A question with its study item, one answered session and a review log.
  async function seedQuestion(pageId: string, prompt: string) {
    const created = await createRecallQuestion(
      {
        pageId,
        prompt,
        keyConcepts: ["Idea"],
        acceptableAnswerSummary: "Resumen",
      },
      deps(),
      owner.id,
    );
    if (!created.ok) throw new Error(created.error.code);
    const [item] = await db
      .select()
      .from(studyItems)
      .where(
        and(
          eq(studyItems.kind, "recall_question"),
          eq(studyItems.sourceId, created.value.id),
        ),
      );
    if (!item) throw new Error("no study item");
    const sessionId = randomUUID();
    await db.insert(recallSessions).values({
      id: sessionId,
      ownerId: owner.id,
      pageId,
      startedAt: NOW,
      finishedAt: NOW,
      evaluationStatus: "done",
    });
    await db.insert(recallAnswers).values({
      id: randomUUID(),
      ownerId: owner.id,
      sessionId,
      questionId: created.value.id,
      answerText: "Respuesta",
      selfRating: 3,
    });
    await db.insert(reviewLogs).values({
      id: randomUUID(),
      ownerId: owner.id,
      itemId: item.id,
      quality: 3,
      reviewedAt: NOW,
      intervalBefore: 0,
      intervalAfter: 1,
      easinessAfter: 2.5,
      sessionKind: "recall",
      sessionId,
    });
    return { question: created.value, item };
  }

  const count = async (rows: Promise<unknown[]>) => (await rows).length;

  describe("applyRecallEdits on the database", { timeout: 30_000 }, () => {
    it("edits, adds and deletes for real: the deleted question's answers, item and logs are gone", async () => {
      const pageId = await newPage();
      const kept = await seedQuestion(pageId, "Queda");
      const gone = await seedQuestion(pageId, "Se va");

      const result = await applyRecallEdits(
        {
          pageId,
          updates: [
            {
              id: kept.question.id,
              prompt: "Queda editada",
              keyConcepts: ["A", "B"],
              acceptableAnswerSummary: "R",
            },
          ],
          creates: [
            {
              prompt: "Nueva",
              keyConcepts: ["C"],
              acceptableAnswerSummary: "R",
            },
          ],
          deletes: [gone.question.id],
        },
        deps(),
        owner.id,
      );

      // Same createdAt (fixed clock): the id breaks the tie, so the order is random.
      expect(
        result.ok && result.value.questions.map((q) => q.prompt).sort(),
      ).toEqual(["Nueva", "Queda editada"]);
      expect(
        await count(
          db
            .select()
            .from(recallQuestions)
            .where(eq(recallQuestions.id, gone.question.id)),
        ),
      ).toBe(0);
      expect(
        await count(
          db
            .select()
            .from(recallAnswers)
            .where(eq(recallAnswers.questionId, gone.question.id)),
        ),
      ).toBe(0);
      expect(
        await count(
          db.select().from(studyItems).where(eq(studyItems.id, gone.item.id)),
        ),
      ).toBe(0);
      expect(
        await count(
          db
            .select()
            .from(reviewLogs)
            .where(eq(reviewLogs.itemId, gone.item.id)),
        ),
      ).toBe(0);
      expect(
        await count(
          db
            .select()
            .from(reviewLogs)
            .where(eq(reviewLogs.itemId, kept.item.id)),
        ),
      ).toBe(1);
    });

    it("rolls the whole save back when it would leave the page without questions", async () => {
      const pageId = await newPage();
      const only = await seedQuestion(pageId, "Única");

      const result = await applyRecallEdits(
        {
          pageId,
          updates: [
            {
              id: only.question.id,
              prompt: "Cambiada",
              keyConcepts: ["A"],
              acceptableAnswerSummary: "R",
            },
          ],
          creates: [],
          deletes: [only.question.id],
        },
        deps(),
        owner.id,
      );

      expect(!result.ok && result.error.code).toBe(RECALL_ERROR.LAST_QUESTION);
      const [row] = await db
        .select()
        .from(recallQuestions)
        .where(eq(recallQuestions.id, only.question.id));
      expect(row?.prompt).toBe("Única");
      expect(
        await count(
          db.select().from(studyItems).where(eq(studyItems.id, only.item.id)),
        ),
      ).toBe(1);
    });
  });
}
