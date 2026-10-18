import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { finishRecallSession } from "@/modules/active-recall/application/finish-recall-session";
import { planRecallSession } from "@/modules/active-recall/application/plan-recall-session";
import { saveRecallAnswer } from "@/modules/active-recall/application/save-recall-answer";
import { startRecallSession } from "@/modules/active-recall/application/start-recall-session";
import { SKIPPED_ANSWER_TEXT } from "@/modules/active-recall/domain/recall-answer";
import { newRecallQuestion } from "@/modules/active-recall/domain/recall-question";
import { DrizzleRecallQuestionRepository } from "@/modules/active-recall/infrastructure/drizzle-recall-question-repository";
import { DrizzleRecallSessionUnitOfWork } from "@/modules/active-recall/infrastructure/drizzle-recall-session-unit-of-work";
import { createStudyItemRepository } from "@/modules/study-engine";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import {
  notebooks,
  pages,
  profiles,
  recallAnswers,
  recallSessions,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Reviews are due per local day (UTC here): due before the next midnight.
function utcDayCutoff(now: Date): Date {
  const day = 86_400_000;
  return new Date((Math.floor(now.getTime() / day) + 1) * day);
}

// A recall session against the real database (Phase 6 T5): composition
// from the page's study items, one answer per (session, question), page
// coherence, finish with the answered questions only, and the session row
// lock that queues a save behind a finish.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-session-owner");
  const notebookId = randomUUID();
  const pageId = randomUUID();
  const otherPageId = randomUUID();
  const NOW = new Date("2026-10-06T10:00:00.000Z");
  const DAY = 86_400_000;

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
    title: "Cuaderno de sesiones de recordación",
    position: 1,
  });
  await db.insert(pages).values(
    [pageId, otherPageId].map((id, i) => ({
      id,
      ownerId: owner.id,
      notebookId,
      title: i === 0 ? "Mitocondria" : "Núcleo",
      content: { type: "doc", content: [] },
      position: i + 1,
    })),
  );

  // Four questions on the page: one due (reviewed, due yesterday), two new
  // and one reviewed but not due; plus one question on the other page.
  const ids = {
    due: randomUUID(),
    newA: randomUUID(),
    newB: randomUUID(),
    later: randomUUID(),
    elsewhere: randomUUID(),
  };
  const seeds = [
    { id: ids.newA, page: pageId, day: -5 },
    { id: ids.later, page: pageId, day: -4, reviewed: -1, due: 6 },
    { id: ids.due, page: pageId, day: -3, reviewed: -4, due: -1 },
    { id: ids.newB, page: pageId, day: -2 },
    { id: ids.elsewhere, page: otherPageId, day: -1 },
  ];
  const questions = new DrizzleRecallQuestionRepository(db);
  const items = createStudyItemRepository(db);
  for (const seed of seeds) {
    const createdAt = new Date(NOW.getTime() + seed.day * DAY);
    const question = newRecallQuestion(
      {
        id: seed.id,
        ownerId: owner.id,
        pageId: seed.page,
        prompt: `¿Pregunta ${seed.day}?`,
        rubric: { keyConcepts: ["ATP"], acceptableAnswerSummary: "ATP." },
        origin: "manual",
        generationId: null,
      },
      createdAt,
    );
    if (!question.ok) throw question.error;
    await questions.saveMany([question.value]);
    const item = newStudyItem({
      id: randomUUID(),
      ownerId: owner.id,
      pageId: seed.page,
      kind: "recall_question",
      sourceId: seed.id,
      now: createdAt,
    });
    await items.save({
      ...item,
      lastReviewedAt:
        seed.reviewed === undefined
          ? null
          : new Date(NOW.getTime() + seed.reviewed * DAY),
      dueAt:
        seed.due === undefined
          ? item.dueAt
          : new Date(NOW.getTime() + seed.due * DAY),
    });
  }

  const uow = new DrizzleRecallSessionUnitOfWork(db);
  const clock = createFixedClock(NOW);
  const newIds = { next: () => randomUUID() };
  const pageReader = {
    async getPageText(id: string, ownerId: string) {
      return ownerId === owner.id && (id === pageId || id === otherPageId)
        ? ok({ title: "Mitocondria", plainText: "ATP" })
        : err(new DomainError("PAGE_NOT_FOUND", id));
    },
  };

  async function start() {
    const started = await startRecallSession(
      { pageId },
      { pages: pageReader, uow, clock, dueCutoff: utcDayCutoff, ids: newIds },
      owner.id,
    );
    if (!started.ok) throw started.error;
    return started.value;
  }

  function save(
    sessionId: string,
    questionId: string,
    answerText: string,
    selfRating: number,
  ) {
    return saveRecallAnswer(
      { sessionId, questionId, answerText, selfRating },
      { uow, clock, ids: newIds },
      owner.id,
    );
  }

  describe("recall session on the database", { timeout: 30_000 }, () => {
    it("plans and starts with due, then new, then least recently reviewed", async () => {
      const expected = [ids.due, ids.newA, ids.newB, ids.later];
      const plan = await planRecallSession(
        { pageId },
        { questions, studyItems: items, clock, dueCutoff: utcDayCutoff },
        owner.id,
      );
      expect(plan.questions.map((q) => q.id)).toEqual(expected);

      const started = await start();
      expect(started.questions.map((q) => q.id)).toEqual(expected);
      const [row] = await db
        .select()
        .from(recallSessions)
        .where(eq(recallSessions.id, started.session.id));
      expect(row).toMatchObject({
        pageId,
        finishedAt: null,
        evaluationStatus: "pending",
      });
    });

    it("saves answered and skipped questions, refuses another page's, finishes with the answered only", async () => {
      const { session } = await start();

      expect((await save(session.id, ids.due, "Produce ATP", 4)).ok).toBe(true);
      expect(
        (await save(session.id, ids.due, "Produce ATP y NADH", 5)).ok,
      ).toBe(true);
      expect(
        (await save(session.id, ids.newA, SKIPPED_ANSWER_TEXT, 0)).ok,
      ).toBe(true);
      const foreign = await save(session.id, ids.elsewhere, "x", 3);
      expect(!foreign.ok && foreign.error.code).toBe(
        "RECALL_QUESTION_NOT_IN_SESSION",
      );

      const finished = await finishRecallSession(
        { sessionId: session.id },
        { uow, clock: createFixedClock(new Date(NOW.getTime() + 60_000)) },
        owner.id,
      );
      expect(finished.ok && finished.value.answeredCount).toBe(2);

      const answers = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.sessionId, session.id));
      expect(
        answers
          .map((a) => [a.questionId, a.answerText, a.selfRating])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ).toEqual(
        [
          [ids.due, "Produce ATP y NADH", 5],
          [ids.newA, SKIPPED_ANSWER_TEXT, 0],
        ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      );
      expect(answers.every((a) => a.evaluationStatus === "pending")).toBe(true);
      const [row] = await db
        .select()
        .from(recallSessions)
        .where(eq(recallSessions.id, session.id));
      expect(row?.finishedAt).toEqual(new Date(NOW.getTime() + 60_000));
      expect(row?.evaluationStatus).toBe("pending");

      const late = await save(session.id, ids.newB, "Tarde", 3);
      expect(!late.ok && late.error.code).toBe("RECALL_SESSION_FINISHED");
    });

    it("closes a session without answers as done", async () => {
      const { session } = await start();

      const finished = await finishRecallSession(
        { sessionId: session.id },
        { uow, clock },
        owner.id,
      );

      expect(finished.ok && finished.value.session.evaluationStatus).toBe(
        "done",
      );
    });

    it("queues a save and a finish of the same session on the row lock", async () => {
      const { session } = await start();

      const [saved, finished] = await Promise.all([
        save(session.id, ids.newB, "Concurrente", 3),
        finishRecallSession(
          { sessionId: session.id },
          { uow, clock },
          owner.id,
        ),
      ]);

      expect(finished.ok).toBe(true);
      const answers = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.sessionId, session.id));
      // Either the save ran first and the finish counted it, or the finish
      // ran first and the save was refused: never an answer after a finish.
      if (saved.ok) {
        expect(finished.ok && finished.value.answeredCount).toBe(1);
        expect(answers).toHaveLength(1);
      } else {
        expect(saved.error.code).toBe("RECALL_SESSION_FINISHED");
        expect(finished.ok && finished.value.answeredCount).toBe(0);
        expect(answers).toEqual([]);
      }
    });
  });
}
