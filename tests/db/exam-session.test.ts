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
  examAnswers,
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
// never both win. Concurrent answers and an answer racing a finish queue on
// the session row: one answer per question, never one in a finished session.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const otherConnection = createTestDb();
  // Holds a session's row lock while the racing calls queue behind it.
  const holderConnection = createTestDb();
  // Watches which backends are blocked; never takes part in a race.
  const observer = createTestDb();
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
      await holderConnection.$client.end();
      await observer.$client.end();
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

  // Starts an exam and answers its first `count` questions (all by
  // default), the first `wrong` of them wrong.
  async function answeredExam(pageId: string, wrong: number, count = 10) {
    const started = await start(pageId);
    if (!started.ok) throw started.error;
    const sessionId = started.value.session.id;
    const uow = new DrizzleExamSessionUnitOfWork(db, ids);
    const detail = await readExamSession({ sessionId }, { uow }, owner.id);
    if (!detail.ok) throw detail.error;
    const shown = detail.value.questions.slice(0, count);
    for (const [n, { question }] of shown.entries()) {
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
      questionIds: detail.value.questions.map((q) => q.question.id),
      roots: detail.value.questions.map((q) => q.question.rootId),
    };
  }

  function answer(sessionId: string, questionId: string, connection = db) {
    return answerExamQuestion(
      { sessionId, questionId, selectedIndex: 0 },
      {
        uow: new DrizzleExamSessionUnitOfWork(connection, ids),
        clock: createFixedClock(new Date(STARTED.getTime() + 60_000)),
      },
      owner.id,
    );
  }

  // Opens the connection before a race, so no race leg pays a connect.
  async function warm(connection: typeof db): Promise<void> {
    await connection.$client`select 1`;
  }

  // Resolves once `count` backends wait on an exam session's row lock.
  // Counted from pg_stat_activity, not by backend pid: cogni-dev is reached
  // through a transaction pooler, so a connection's pid is not stable.
  async function waiting(count: number): Promise<void> {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const [row] = await observer.$client<{ n: number }[]>`
        select count(*)::int as n from pg_stat_activity
        where wait_event_type = 'Lock'
          and query ilike '%from "exam_sessions"%for update%'
      `;
      if (row && row.n >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`${count} backends never waited on the session lock`);
  }

  // Row-locks the session on holderConnection until `release` is called,
  // so the racing calls queue behind it in the order they arrive.
  async function holdSession(sessionId: string) {
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = () => {};
    const isHeld = new Promise<void>((resolve) => {
      held = resolve;
    });
    const holder = holderConnection.transaction(async (tx) => {
      await new DrizzleExamSessionRepository(tx).lockById(sessionId, owner.id);
      held();
      await released;
    });
    await isHeld;
    return async () => {
      release();
      await holder;
    };
  }

  async function answersOf(sessionId: string) {
    return db
      .select()
      .from(examAnswers)
      .where(eq(examAnswers.sessionId, sessionId));
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

    it("stores exactly one of two concurrent answers to one question", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId, questionIds } = await answeredExam(pageId, 0, 0);
      const target = questionIds[0] as string;
      await warm(db);
      await warm(otherConnection);
      const release = await holdSession(sessionId);
      let settled = 0;
      const first = answer(sessionId, target).finally(() => (settled += 1));
      const second = answer(sessionId, target, otherConnection).finally(
        () => (settled += 1),
      );
      try {
        await waiting(2);
        expect(settled).toBe(0);
      } finally {
        await release();
      }
      const results = await Promise.all([first, second]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const refused = results.find((r) => !r.ok);
      expect(refused && !refused.ok && refused.error.code).toBe(
        EXAM_ERROR.DUPLICATE_ANSWER,
      );
      const stored = await answersOf(sessionId);
      expect(stored.map((a) => a.questionId)).toEqual([target]);
    });

    it("counts an answer that reaches the session before a racing finish", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId, questionIds } = await answeredExam(pageId, 0, 9);
      const last = questionIds[9] as string;
      await warm(db);
      await warm(otherConnection);
      const release = await holdSession(sessionId);
      const answered = answer(sessionId, last);
      let finished: ReturnType<typeof finish> | undefined;
      try {
        await waiting(1);
        finished = finish(sessionId, otherConnection);
        await waiting(2);
      } finally {
        await release();
      }
      const [answerResult, finishResult] = await Promise.all([
        answered,
        finished,
      ]);
      expect(answerResult.ok).toBe(true);
      if (!finishResult?.ok) throw new Error("the finish was refused");
      expect(finishResult.value.session).toMatchObject({
        total: 10,
        correct: 10,
        passed: true,
      });
      expect(await answersOf(sessionId)).toHaveLength(10);
      expect(await logsOf(sessionId)).toHaveLength(10);
    });

    it("refuses as finished an answer that reaches the session after a racing finish", async () => {
      const pageId = await pageWithQuestions();
      const { sessionId, questionIds } = await answeredExam(pageId, 0);
      await warm(db);
      await warm(otherConnection);
      const release = await holdSession(sessionId);
      const finished = finish(sessionId, otherConnection);
      let answered: ReturnType<typeof answer> | undefined;
      try {
        await waiting(1);
        answered = answer(sessionId, questionIds[0] as string);
        await waiting(2);
      } finally {
        await release();
      }
      const [finishResult, answerResult] = await Promise.all([
        finished,
        answered,
      ]);
      expect(finishResult.ok).toBe(true);
      expect(answerResult?.ok).toBe(false);
      if (!answerResult || answerResult.ok) return;
      expect(answerResult.error.code).toBe(EXAM_ERROR.SESSION_FINISHED);
      // Nothing was added to the finished session.
      expect(await answersOf(sessionId)).toHaveLength(10);
      const session = await new DrizzleExamSessionRepository(db).findById(
        sessionId,
        owner.id,
      );
      expect(session).toMatchObject({ total: 10, finishedAt: FINISHED });
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
