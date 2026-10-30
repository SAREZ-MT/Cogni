import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { applyExamEdits } from "@/modules/exams/application/apply-exam-edits";
import { createExamQuestion } from "@/modules/exams/application/create-exam-question";
import { EXAM_ERROR } from "@/modules/exams/domain/errors";
import { DrizzleExamUnitOfWork } from "@/modules/exams/infrastructure/drizzle-exam-unit-of-work";
import {
  examAnswers,
  examPageState,
  examQuestions,
  examSessions,
  notebooks,
  pages,
  profiles,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Phase 8 H18: the exam edit page saves its draft in one transaction. A
// deleted question takes its whole lineage (variants included), their
// answers, the root's study item and review history, the open exams that
// show it and its place in the pending retake; a finished exam keeps its
// score.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("exam-edits-owner");
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
    title: "Cuaderno de edición de exámenes",
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
    uow: new DrizzleExamUnitOfWork(db),
    clock: createFixedClock(NOW),
    ids: { next: () => randomUUID() },
  });

  const content = (stem: string) => ({
    stem,
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correctIndex: 0,
    explanation: "Porque sí.",
    concept: "Concepto",
  });

  async function seedRoot(pageId: string, stem: string) {
    const created = await createExamQuestion(
      { pageId, ...content(stem) },
      deps(),
      owner.id,
    );
    if (!created.ok) throw new Error(created.error.code);
    const [item] = await db
      .select()
      .from(studyItems)
      .where(
        and(
          eq(studyItems.kind, "exam_question"),
          eq(studyItems.sourceId, created.value.id),
        ),
      );
    if (!item) throw new Error("no study item");
    return { root: created.value, item };
  }

  async function finishedSession(pageId: string, questionId: string) {
    const id = randomUUID();
    await db.insert(examSessions).values({
      id,
      ownerId: owner.id,
      pageId,
      requestedCount: 10,
      questionIds: [questionId],
      startedAt: NOW,
      finishedAt: NOW,
      total: 1,
      correct: 1,
      score: 1,
      passed: true,
    });
    return id;
  }

  const rowsOf = async (query: Promise<unknown[]>) => (await query).length;

  describe("applyExamEdits on the database", { timeout: 60_000 }, () => {
    it("deletes a lineage for real with everything that points at it", async () => {
      const pageId = await newPage();
      const kept = await seedRoot(pageId, "¿Queda esta pregunta?");
      const gone = await seedRoot(pageId, "¿Se va esta pregunta?");
      const variantId = randomUUID();
      await db.insert(examQuestions).values({
        id: variantId,
        ownerId: owner.id,
        pageId,
        ...content("¿Se va esta variante?"),
        rootId: gone.root.id,
        variantOf: gone.root.id,
        origin: "manual",
      });
      const finished = await finishedSession(pageId, gone.root.id);
      await db.insert(examAnswers).values({
        ownerId: owner.id,
        sessionId: finished,
        questionId: gone.root.id,
        rootId: gone.root.id,
        selectedIndex: 0,
        isCorrect: true,
        answeredAt: NOW,
      });
      await db.insert(reviewLogs).values({
        id: randomUUID(),
        ownerId: owner.id,
        itemId: gone.item.id,
        quality: 5,
        reviewedAt: NOW,
        intervalBefore: 0,
        intervalAfter: 1,
        easinessAfter: 2.6,
        sessionKind: "exam",
        sessionId: finished,
      });
      const open = randomUUID();
      await db.insert(examSessions).values({
        id: open,
        ownerId: owner.id,
        pageId,
        requestedCount: 10,
        questionIds: [kept.root.id, variantId],
        startedAt: NOW,
      });
      const untouchedOpen = randomUUID();
      await db.insert(examSessions).values({
        id: untouchedOpen,
        ownerId: owner.id,
        pageId,
        requestedCount: 10,
        questionIds: [kept.root.id],
        startedAt: NOW,
        isRetake: true,
      });
      await db.insert(examPageState).values({
        pageId,
        ownerId: owner.id,
        retakePending: true,
        failedRootIds: [gone.root.id, kept.root.id],
      });

      const result = await applyExamEdits(
        {
          pageId,
          updates: [{ id: kept.root.id, ...content("¿Queda, editada?") }],
          creates: [content("¿Pregunta nueva?")],
          deletes: [variantId],
        },
        deps(),
        owner.id,
      );

      // Same createdAt (fixed clock): the id breaks the tie, so the order is random.
      expect(
        result.ok && result.value.questions.map((q) => q.stem).sort(),
      ).toEqual(["¿Pregunta nueva?", "¿Queda, editada?"]);
      expect(
        await rowsOf(
          db
            .select()
            .from(examQuestions)
            .where(eq(examQuestions.rootId, gone.root.id)),
        ),
      ).toBe(0);
      expect(
        await rowsOf(
          db
            .select()
            .from(examAnswers)
            .where(eq(examAnswers.rootId, gone.root.id)),
        ),
      ).toBe(0);
      expect(
        await rowsOf(
          db.select().from(studyItems).where(eq(studyItems.id, gone.item.id)),
        ),
      ).toBe(0);
      expect(
        await rowsOf(
          db
            .select()
            .from(reviewLogs)
            .where(eq(reviewLogs.itemId, gone.item.id)),
        ),
      ).toBe(0);
      expect(
        await rowsOf(
          db.select().from(examSessions).where(eq(examSessions.id, open)),
        ),
      ).toBe(0);
      expect(
        await rowsOf(
          db
            .select()
            .from(examSessions)
            .where(eq(examSessions.id, untouchedOpen)),
        ),
      ).toBe(1);
      const [record] = await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.id, finished));
      expect(record?.score).toBe(1);
      const [state] = await db
        .select()
        .from(examPageState)
        .where(eq(examPageState.pageId, pageId));
      expect(state?.failedRootIds).toEqual([kept.root.id]);
    });

    it("clears the pending retake when the deleted lineage was its only failed root", async () => {
      const pageId = await newPage();
      const kept = await seedRoot(pageId, "¿Sigue esta pregunta?");
      const failed = await seedRoot(pageId, "¿Fallaste esta pregunta?");
      await db.insert(examPageState).values({
        pageId,
        ownerId: owner.id,
        retakePending: true,
        failedRootIds: [failed.root.id],
      });

      const result = await applyExamEdits(
        { pageId, updates: [], creates: [], deletes: [failed.root.id] },
        deps(),
        owner.id,
      );

      expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
        kept.root.id,
      ]);
      const [state] = await db
        .select()
        .from(examPageState)
        .where(eq(examPageState.pageId, pageId));
      expect(state?.failedRootIds).toEqual([]);
      expect(state?.retakePending).toBe(false);
    });

    it("rolls the whole save back when it would leave the page without questions", async () => {
      const pageId = await newPage();
      const only = await seedRoot(pageId, "¿Única pregunta?");

      const result = await applyExamEdits(
        {
          pageId,
          updates: [{ id: only.root.id, ...content("¿Cambiada?") }],
          creates: [],
          deletes: [only.root.id],
        },
        deps(),
        owner.id,
      );

      expect(!result.ok && result.error.code).toBe(EXAM_ERROR.LAST_QUESTION);
      const [row] = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.id, only.root.id));
      expect(row?.stem).toBe("¿Única pregunta?");
    });
  });
}
