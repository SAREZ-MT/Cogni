import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { runExamRepositoriesContract } from "@/modules/exams/application/testing/exam-repositories.contract";
import { newExamQuestion } from "@/modules/exams/domain/exam-question";
import {
  type ExamAnswer,
  newExamSession,
} from "@/modules/exams/domain/exam-session";
import { createDrizzleExamRepositories } from "@/modules/exams/infrastructure";
import {
  aiGenerations,
  examAnswers,
  examPageState,
  examQuestions,
  examSessions,
  notebooks,
  pages,
  profiles,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every exam row created here; assertions only read this file's
// own fixtures (cogni-dev is shared).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("exams-owner");
  const otherOwner = await createTestOwner("exams-other");
  const notebookId = randomUUID();
  let nextPagePosition = 1;

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
    title: "Cuaderno del contrato de exámenes",
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
      position: nextPagePosition++,
    });
    return id;
  }

  async function newGeneration(): Promise<string> {
    const id = randomUUID();
    await db.insert(aiGenerations).values({
      id,
      ownerId: owner.id,
      pageId: null,
      purpose: "generate_exam_variants",
      provider: "fake",
      model: "fake-model",
      promptVersion: "generate_exam_variants/v1",
      status: "done",
    });
    return id;
  }

  runExamRepositoriesContract({
    createRepositories: () => createDrizzleExamRepositories(db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newId: () => randomUUID(),
      newPageId: newPage,
      newGenerationId: newGeneration,
    }),
  });

  describe("Drizzle exam repositories inside a caller's transaction", () => {
    async function writeEverything(
      repos: ReturnType<typeof createDrizzleExamRepositories>,
      pageId: string,
    ) {
      const now = new Date("2026-10-05T09:00:00.000Z");
      const question = newExamQuestion(
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          stem: "¿Qué organelo produce ATP?",
          options: ["Núcleo", "Mitocondria", "Ribosoma", "Lisosoma"],
          correctIndex: 1,
          explanation: "",
          concept: "Mitocondria",
          origin: "manual",
          generationId: null,
        },
        now,
      );
      const session = newExamSession(
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          requestedCount: 10,
          retakeOfSessionId: null,
          questionIds: [randomUUID()],
        },
        now,
      );
      if (!question.ok || !session.ok) throw new Error("fixture invalid");
      await repos.questions.save(question.value);
      await repos.sessions.create(session.value);
      const answer: ExamAnswer = {
        sessionId: session.value.id,
        questionId: question.value.id,
        rootId: question.value.rootId,
        selectedIndex: 0,
        isCorrect: false,
        answeredAt: now,
      };
      await repos.answers.saveMany([answer], owner.id);
      await repos.pageStates.upsert({
        pageId,
        ownerId: owner.id,
        retakePending: true,
        failedRootIds: [question.value.rootId],
        lastPassedSessionId: null,
      });
      return { questionId: question.value.id, sessionId: session.value.id };
    }

    async function counts(
      pageId: string,
      ids: { questionId: string; sessionId: string },
    ) {
      const questions = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.id, ids.questionId));
      const sessions = await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.id, ids.sessionId));
      const answers = await db
        .select()
        .from(examAnswers)
        .where(inArray(examAnswers.sessionId, [ids.sessionId]));
      const states = await db
        .select()
        .from(examPageState)
        .where(eq(examPageState.pageId, pageId));
      return [questions, sessions, answers, states].map((rows) => rows.length);
    }

    it("commits every write with the caller's transaction", async () => {
      const pageId = await newPage();
      const ids = await db.transaction((tx) =>
        writeEverything(createDrizzleExamRepositories(tx), pageId),
      );
      expect(await counts(pageId, ids)).toEqual([1, 1, 1, 1]);
    });

    it("rolls every write back when the caller's transaction fails", async () => {
      const pageId = await newPage();
      let ids: { questionId: string; sessionId: string } | undefined;
      await expect(
        db.transaction(async (tx) => {
          ids = await writeEverything(
            createDrizzleExamRepositories(tx),
            pageId,
          );
          throw new Error("later step failed");
        }),
      ).rejects.toThrow("later step failed");
      if (!ids) throw new Error("writes did not run");
      expect(await counts(pageId, ids)).toEqual([0, 0, 0, 0]);
    });
  });
}
