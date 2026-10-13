import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";
import {
  type AnalyticsPageFixture,
  runAnalyticsReadersContract,
} from "@/modules/analytics/application/testing/analytics-readers.contract";
import {
  DrizzleAnswerOutcomeReader,
  DrizzlePageProgressReader,
  DrizzleReviewHistoryReader,
} from "@/modules/analytics/infrastructure";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import {
  examAnswers,
  examQuestions,
  examSessions,
  notebooks,
  pageMastery,
  pages,
  profiles,
  recallAnswers,
  recallQuestions,
  recallSessions,
  reviewLogs,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every row created here.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("analytics-owner");
  const otherOwner = await createTestOwner("analytics-other");
  const pageOwners = new Map<string, string>();
  let nextPosition = 1;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);

  const ownerOf = (page: AnalyticsPageFixture) =>
    pageOwners.get(page.pageId) ?? owner.id;

  const insertItem = async (
    page: AnalyticsPageFixture,
    input: { dueAt: Date; suspended?: boolean },
  ) => {
    const item = newStudyItem({
      id: randomUUID(),
      ownerId: ownerOf(page),
      pageId: page.pageId,
      kind: "flashcard",
      sourceId: randomUUID(),
      now: input.dueAt,
    });
    await new DrizzleStudyItemRepository(db).save({
      ...item,
      dueAt: input.dueAt,
      suspendedAt: input.suspended ? input.dueAt : null,
    });
    return item.id;
  };

  runAnalyticsReadersContract({
    createReaders: () => ({
      reviews: new DrizzleReviewHistoryReader(db),
      pages: new DrizzlePageProgressReader(db),
      answers: new DrizzleAnswerOutcomeReader(db),
    }),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newPage: async ({ ownerId = owner.id, sameNotebookAs } = {}) => {
        const notebook = sameNotebookAs ?? {
          notebookId: randomUUID(),
          notebookTitle: "Cuaderno del contrato de analytics",
          notebookColor: "green",
        };
        if (!sameNotebookAs) {
          await db.insert(notebooks).values({
            id: notebook.notebookId,
            ownerId,
            title: notebook.notebookTitle,
            color: notebook.notebookColor,
            position: nextPosition++,
          });
        }
        const fixture = {
          pageId: randomUUID(),
          pageTitle: `Página ${randomUUID().slice(0, 8)}`,
          notebookId: notebook.notebookId,
          notebookTitle: notebook.notebookTitle,
          notebookColor: notebook.notebookColor,
        };
        await db.insert(pages).values({
          id: fixture.pageId,
          ownerId,
          notebookId: fixture.notebookId,
          title: fixture.pageTitle,
          content: { type: "doc", content: [] },
          position: nextPosition++,
        });
        pageOwners.set(fixture.pageId, ownerId);
        return fixture;
      },
      addItem: async (page, input) => {
        await insertItem(page, input);
      },
      setMastery: async (page, input) => {
        await db.insert(pageMastery).values({
          id: randomUUID(),
          ownerId: ownerOf(page),
          pageId: page.pageId,
          level: input.level,
          score: input.score,
          itemsTotal: 0,
          itemsDue: 0,
          computedAt: new Date(),
        });
      },
      addReview: async (page, input) => {
        // The item is suspended so it never counts in the page's items.
        const itemId = await insertItem(page, {
          dueAt: input.reviewedAt,
          suspended: true,
        });
        await db.insert(reviewLogs).values({
          id: randomUUID(),
          ownerId: ownerOf(page),
          itemId,
          quality: input.quality as 0 | 1 | 2 | 3 | 4 | 5,
          reviewedAt: input.reviewedAt,
          intervalBefore: 0,
          intervalAfter: 1,
          easinessAfter: 2.5,
          sessionKind: input.technique,
          sessionId: randomUUID(),
        });
      },
      addExamAnswer: async (page, input) => {
        const ownerId = ownerOf(page);
        const questionId = randomUUID();
        const sessionId = randomUUID();
        await db.insert(examQuestions).values({
          id: questionId,
          ownerId,
          pageId: page.pageId,
          stem: "¿Qué produce la mitocondria?",
          options: ["ATP", "ADN", "ARN", "Glucosa"],
          correctIndex: 0,
          explanation: "La mitocondria produce ATP.",
          concept: "Respiración celular",
          rootId: questionId,
          origin: "manual",
        });
        const finished = input.finished ?? true;
        await db.insert(examSessions).values({
          id: sessionId,
          ownerId,
          pageId: page.pageId,
          requestedCount: 10,
          questionIds: [questionId],
          startedAt: input.answeredAt,
          ...(finished
            ? {
                finishedAt: input.answeredAt,
                total: 1,
                correct: input.isCorrect ? 1 : 0,
                score: input.isCorrect ? 1 : 0,
                passed: input.isCorrect,
              }
            : {}),
        });
        await db.insert(examAnswers).values({
          ownerId,
          sessionId,
          questionId,
          rootId: questionId,
          selectedIndex: input.isCorrect ? 0 : 1,
          isCorrect: input.isCorrect,
          answeredAt: input.answeredAt,
        });
      },
      addRecallAnswer: async (page, input) => {
        const ownerId = ownerOf(page);
        const questionId = randomUUID();
        const sessionId = randomUUID();
        await db.insert(recallQuestions).values({
          id: questionId,
          ownerId,
          pageId: page.pageId,
          prompt: "Explica la función de la mitocondria.",
          rubric: {
            keyConcepts: ["ATP"],
            acceptableAnswerSummary: "Produce energía en forma de ATP.",
          },
          origin: "manual",
        });
        await db.insert(recallSessions).values({
          id: sessionId,
          ownerId,
          pageId: page.pageId,
          startedAt: input.answeredAt,
          finishedAt: input.answeredAt,
          evaluationStatus: input.status === "pending" ? "pending" : "done",
        });
        const evaluated = input.status === "done";
        await db.insert(recallAnswers).values({
          id: randomUUID(),
          ownerId,
          sessionId,
          questionId,
          answerText: "Produce ATP.",
          selfRating: input.selfRating,
          evaluationStatus: input.status,
          aiEvaluation:
            input.status === "pending" ? null : { score: input.aiScore },
          aiScore: evaluated ? input.aiScore : null,
          combinedQuality: evaluated ? input.aiScore : null,
          createdAt: input.answeredAt,
        });
      },
      archivePage: async (page) => {
        await db
          .update(pages)
          .set({ archivedAt: new Date() })
          .where(eq(pages.id, page.pageId));
      },
      archiveNotebook: async (page) => {
        await db
          .update(notebooks)
          .set({ archivedAt: new Date() })
          .where(eq(notebooks.id, page.notebookId));
      },
    }),
  });
}
