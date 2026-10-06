import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { runRecallRepositoriesContract } from "@/modules/active-recall/application/testing/recall-repositories.contract";
import { newRecallAnswer } from "@/modules/active-recall/domain/recall-answer";
import { newRecallQuestion } from "@/modules/active-recall/domain/recall-question";
import { newRecallSession } from "@/modules/active-recall/domain/recall-session";
import { createDrizzleRecallRepositories } from "@/modules/active-recall/infrastructure";
import {
  aiGenerations,
  notebooks,
  pages,
  profiles,
  recallAnswers,
  recallQuestions,
  recallSessions,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every recall row created here; assertions only read this
// file's own fixtures (cogni-dev is shared).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-owner");
  const otherOwner = await createTestOwner("recall-other");
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
    title: "Cuaderno del contrato de recordación activa",
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
      purpose: "generate_recall_questions",
      provider: "fake",
      model: "fake-model",
      promptVersion: "generate_recall_questions/v1",
      status: "done",
    });
    return id;
  }

  runRecallRepositoriesContract({
    createRepositories: () => createDrizzleRecallRepositories(db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newId: () => randomUUID(),
      newPageId: newPage,
      newGenerationId: newGeneration,
    }),
  });

  describe("Drizzle recall repositories inside a caller's transaction", () => {
    async function writeEverything(
      repos: ReturnType<typeof createDrizzleRecallRepositories>,
      pageId: string,
    ) {
      const now = new Date("2026-10-06T09:00:00.000Z");
      const question = newRecallQuestion(
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          prompt: "¿Qué produce la mitocondria?",
          rubric: {
            keyConcepts: ["ATP"],
            acceptableAnswerSummary: "Produce ATP.",
          },
          origin: "manual",
          generationId: null,
        },
        now,
      );
      if (!question.ok) throw question.error;
      const session = newRecallSession(
        { id: randomUUID(), ownerId: owner.id, pageId },
        now,
      );
      const answer = newRecallAnswer(
        {
          id: randomUUID(),
          ownerId: owner.id,
          sessionId: session.id,
          questionId: question.value.id,
          answerText: "ATP",
          selfRating: 4,
        },
        now,
      );
      if (!answer.ok) throw answer.error;
      await repos.questions.saveMany([question.value]);
      await repos.sessions.create(session);
      await repos.answers.upsert(answer.value);
      return { questionId: question.value.id, sessionId: session.id };
    }

    async function counts(ids: { questionId: string; sessionId: string }) {
      const questions = await db
        .select()
        .from(recallQuestions)
        .where(eq(recallQuestions.id, ids.questionId));
      const sessions = await db
        .select()
        .from(recallSessions)
        .where(eq(recallSessions.id, ids.sessionId));
      const answers = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.sessionId, ids.sessionId));
      return [questions, sessions, answers].map((rows) => rows.length);
    }

    it("commits every write with the caller's transaction", async () => {
      const pageId = await newPage();
      const ids = await db.transaction((tx) =>
        writeEverything(createDrizzleRecallRepositories(tx), pageId),
      );
      expect(await counts(ids)).toEqual([1, 1, 1]);
    });

    it("rolls every write back when the caller's transaction fails", async () => {
      const pageId = await newPage();
      let ids: { questionId: string; sessionId: string } | undefined;
      await expect(
        db.transaction(async (tx) => {
          ids = await writeEverything(
            createDrizzleRecallRepositories(tx),
            pageId,
          );
          throw new Error("later step failed");
        }),
      ).rejects.toThrow("later step failed");
      if (!ids) throw new Error("writes did not run");
      expect(await counts(ids)).toEqual([0, 0, 0]);
    });
  });
}
