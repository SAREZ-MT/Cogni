import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  answerExamQuestion,
  completeExamSession,
  createExamQuestion,
  readExamSession,
  startExamSession,
} from "@/modules/exams/application";
import { EXAM_ERROR } from "@/modules/exams/domain/errors";
import {
  DrizzleExamPageStateRepository,
  DrizzleExamSessionRepository,
  DrizzleExamSessionUnitOfWork,
  DrizzleExamUnitOfWork,
} from "@/modules/exams/infrastructure";
import type { PageTextReader } from "@/modules/notebooks";
import {
  notebooks,
  pages,
  profiles,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// An exam session against Postgres: the finish stores the result, the page
// state and the SM-2 reviews in one transaction, rolls all of it back when
// the reviews fail, and two concurrent finishes (or starts) of one page
// never both win.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const otherConnection = createTestDb();
  const owner = await createTestOwner("exam-session-owner");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const CREATED = new Date("2026-10-04T08:00:00.000Z");
  const STARTED = new Date("2026-10-05T09:00:00.000Z");
  const FINISHED = new Date("2026-10-05T09:07:30.000Z");
  const DAY_MS = 86_400_000;
  const ids = { next: () => randomUUID() };
  const pageReader: PageTextReader = {
    getPageText: async () => ok({ title: "Página", plainText: "" }),
  };

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
      await otherConnection.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de sesiones de examen",
    position: 1,
  });

  // A page with 10 manual questions (correct option 0), each with its
  // root's study item due since CREATED.
  async function pageWithQuestions(): Promise<string> {
    const pageId = randomUUID();
    await db.insert(pages).values({
      id: pageId,
      ownerId: owner.id,
      notebookId,
      title: `Página ${pageId}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    for (let n = 1; n <= 10; n += 1) {
      const created = await createExamQuestion(
        {
          pageId,
          stem: `¿Pregunta ${n} de ${pageId}?`,
          options: ["Correcta", "Dos", "Tres", "Cuatro"],
          correctIndex: 0,
          explanation: "Porque sí.",
          concept: `Concepto ${n}`,
        },
        {
          pages: pageReader,
          uow: new DrizzleExamUnitOfWork(db),
          clock: createFixedClock(new Date(CREATED.getTime() + n)),
          ids,
        },
        owner.id,
      );
      if (!created.ok) throw created.error;
    }
    return pageId;
  }

  function start(pageId: string, connection = db) {
    return startExamSession(
      { pageId, requestedCount: 10 },
      {
        pages: pageReader,
        uow: new DrizzleExamSessionUnitOfWork(connection, ids),
        clock: createFixedClock(STARTED),
        ids,
      },
      owner.id,
    );
  }

  // Starts an exam and answers every question, the first `wrong` wrong.
  async function answeredExam(pageId: string, wrong: number) {
    const started = await start(pageId);
    if (!started.ok) throw started.error;
    const sessionId = started.value.session.id;
    const uow = new DrizzleExamSessionUnitOfWork(db, ids);
    const detail = await readExamSession({ sessionId }, { uow }, owner.id);
    if (!detail.ok) throw detail.error;
    for (const [n, { question }] of detail.value.questions.entries()) {
      const answered = await answerExamQuestion(
        {
          sessionId,
          questionId: question.id,
          selectedIndex: n < wrong ? 2 : 0,
        },
        {
          uow,
          clock: createFixedClock(new Date(STARTED.getTime() + n * 1000)),
        },
        owner.id,
      );
      if (!answered.ok) throw answered.error;
    }
    return {
      sessionId,
      roots: detail.value.questions.map((q) => q.question.rootId),
    };
  }

  function finish(sessionId: string, connection = db) {
    return completeExamSession(
      { sessionId },
      {
        uow: new DrizzleExamSessionUnitOfWork(connection, ids),
        clock: createFixedClock(FINISHED),
      },
      owner.id,
    );
  }

  async function logsOf(sessionId: string) {
    return db
      .select()
      .from(reviewLogs)
      .where(eq(reviewLogs.sessionId, sessionId));
  }

  // Each answer is its own transaction of about ten round trips to the
  // remote cogni-dev database, so these tests get a longer budget.
  describe("exam session on Postgres", { timeout: 240_000 }, () => {
    it("finishes a failed exam with its page state and SM-2 reviews; failed roots are due tomorrow", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId, roots } = await answeredExam(pageId, 4);
      const result = await finish(sessionId);
      if (!result.ok) throw result.error;
      expect(result.value.session).toMatchObject({
        total: 10,
        correct: 6,
        passed: false,
        finishedAt: FINISHED,
      });
      expect(
        await new DrizzleExamPageStateRepository(db).get(pageId, owner.id),
      ).toMatchObject({
        retakePending: true,
        failedRootIds: roots.slice(0, 4),
      });
      // Every root was due: 10 reviews, q = 1 for the 4 wrong ones.
      const logs = await logsOf(sessionId);
      expect(logs).toHaveLength(10);
      const items = await db
        .select()
        .from(studyItems)
        .where(eq(studyItems.pageId, pageId));
      for (const root of roots.slice(0, 4)) {
        const item = items.find((i) => i.sourceId === root);
        expect(item?.lastQuality).toBe(1);
        expect(item?.dueAt.getTime()).toBe(FINISHED.getTime() + DAY_MS);
      }
    });

    it("lets only one of two concurrent finishes score the session", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId } = await answeredExam(pageId, 0);
      const results = await Promise.all([
        finish(sessionId),
        finish(sessionId, otherConnection),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const refused = results.find((r) => !r.ok);
      expect(refused && !refused.ok && refused.error.code).toBe(
        EXAM_ERROR.SESSION_FINISHED,
      );
      expect(await logsOf(sessionId)).toHaveLength(10);
    });

    it("rolls the finish back when the SM-2 reviews fail", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId, roots } = await answeredExam(pageId, 5);
      // A root without its study item: recordExamReviews refuses.
      await db
        .delete(studyItems)
        .where(
          and(
            eq(studyItems.pageId, pageId),
            eq(studyItems.sourceId, roots[9] as string),
          ),
        );
      const result = await finish(sessionId);
      expect(result.ok).toBe(false);
      const session = await new DrizzleExamSessionRepository(db).findById(
        sessionId,
        owner.id,
      );
      expect(session?.finishedAt).toBeNull();
      expect(
        await new DrizzleExamPageStateRepository(db).get(pageId, owner.id),
      ).toBeNull();
      expect(await logsOf(sessionId)).toEqual([]);
    });

    it("never opens two sessions when two starts of one page race", async () => {
      const pageId = await pageWithQuestions();
      const [first, second] = await Promise.all([
        start(pageId),
        start(pageId, otherConnection),
      ]);
      if (!first.ok || !second.ok) throw new Error("a start failed");
      expect(first.value.session.id).toBe(second.value.session.id);
      expect([first.value.resumed, second.value.resumed].sort()).toEqual([
        false,
        true,
      ]);
    });
  });
}
