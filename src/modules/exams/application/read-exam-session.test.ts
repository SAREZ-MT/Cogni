import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { newExamSession } from "../domain/exam-session";
import { answerExamQuestion } from "./answer-exam-question";
import { completeExamSession } from "./complete-exam-session";
import { getExamPageOverview, readExamSession } from "./read-exam-session";
import { startExamSession } from "./start-exam-session";
import {
  LATER,
  OWNER,
  PAGE,
  pages,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

async function setup(questionCount = 12) {
  const uow = new InMemoryExamSessionUnitOfWork();
  await seedSessionQuestions(uow, questionCount);
  const clock = createFixedClock(LATER);
  const start = () =>
    startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      { pages, uow, clock, ids: { next: () => "session-1" } },
      OWNER,
    );
  return { uow, clock, start };
}

describe("readExamSession", () => {
  it("lists an open session's questions in order with the answers given so far", async () => {
    const { uow, clock, start } = await setup();
    const started = await start();
    if (!started.ok) throw started.error;
    const sessionId = started.value.session.id;
    await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 3 },
      { uow, clock },
      OWNER,
    );
    const view = await readExamSession({ sessionId }, { uow }, OWNER);
    if (!view.ok) throw view.error;
    expect(view.value.session.id).toBe(sessionId);
    expect(view.value.questions).toHaveLength(10);
    expect(view.value.questions[0]).toMatchObject({
      question: { id: "q-01" },
      answer: { selectedIndex: 3, isCorrect: false },
    });
    expect(view.value.questions[1]).toMatchObject({
      question: { id: "q-02" },
      answer: null,
    });
  });

  it("reads a finished session in its stored order with every answer", async () => {
    const { uow, clock, start } = await setup(10);
    const started = await start();
    if (!started.ok) throw started.error;
    const sessionId = started.value.session.id;
    const ids = Array.from(
      { length: 10 },
      (_, n) => `q-${String(n + 1).padStart(2, "0")}`,
    );
    for (const [n, questionId] of [...ids].reverse().entries()) {
      await answerExamQuestion(
        { sessionId, questionId, selectedIndex: 0 },
        { uow, clock: createFixedClock(new Date(LATER.getTime() + n)) },
        OWNER,
      );
    }
    await completeExamSession({ sessionId }, { uow, clock }, OWNER);
    // A question retired later still shows in the stored results.
    await uow.repos.questions.retire("q-10", OWNER, LATER);
    const view = await readExamSession({ sessionId }, { uow }, OWNER);
    if (!view.ok) throw view.error;
    expect(view.value.session.finishedAt).toEqual(LATER);
    // The order shown during the exam (stored at start), not answer order.
    expect(view.value.questions.map((q) => q.question.id)).toEqual(ids);
    expect(view.value.questions.every((q) => q.answer !== null)).toBe(true);
  });

  it("refuses another owner's session", async () => {
    const { uow, start } = await setup();
    const started = await start();
    if (!started.ok) throw started.error;
    const view = await readExamSession(
      { sessionId: started.value.session.id },
      { uow },
      "someone",
    );
    expect(view.ok).toBe(false);
    if (view.ok) return;
    expect(view.error.code).toBe(EXAM_ERROR.SESSION_NOT_FOUND);
  });
});

describe("getExamPageOverview", () => {
  it("reports the active roots, the open session and the last finished one", async () => {
    const { uow, clock, start } = await setup(10);
    const empty = await getExamPageOverview({ pageId: PAGE }, { uow }, OWNER);
    expect(empty).toEqual({
      ok: true,
      value: {
        activeQuestionCount: 10,
        retakePending: false,
        failedRootCount: 0,
        openSession: null,
        openRetake: null,
        lastFinishedSession: null,
      },
    });
    const started = await start();
    if (!started.ok) throw started.error;
    const open = await getExamPageOverview({ pageId: PAGE }, { uow }, OWNER);
    expect(open.ok && open.value.openSession?.id).toBe("session-1");

    for (let n = 1; n <= 10; n += 1) {
      await answerExamQuestion(
        {
          sessionId: "session-1",
          questionId: `q-${String(n).padStart(2, "0")}`,
          selectedIndex: 1,
        },
        { uow, clock },
        OWNER,
      );
    }
    await completeExamSession(
      { sessionId: "session-1" },
      { uow, clock },
      OWNER,
    );
    const done = await getExamPageOverview({ pageId: PAGE }, { uow }, OWNER);
    if (!done.ok) throw done.error;
    expect(done.value).toMatchObject({
      retakePending: true,
      failedRootCount: 10,
      openSession: null,
      openRetake: null,
      lastFinishedSession: { id: "session-1", passed: false },
    });
  });

  it("reports the page's open retake apart from its open normal session", async () => {
    const { uow } = await setup(10);
    const retake = newExamSession(
      {
        id: "retake-1",
        ownerId: OWNER,
        pageId: PAGE,
        requestedCount: 10,
        retakeOfSessionId: "failed-1",
        questionIds: ["q-01"],
      },
      LATER,
    );
    if (!retake.ok) throw retake.error;
    await uow.repos.sessions.create(retake.value);
    const overview = await getExamPageOverview(
      { pageId: PAGE },
      { uow },
      OWNER,
    );
    if (!overview.ok) throw overview.error;
    expect(overview.value.openSession).toBeNull();
    expect(overview.value.openRetake?.id).toBe("retake-1");
  });
});
