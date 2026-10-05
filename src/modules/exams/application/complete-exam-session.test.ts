import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { examSessionDurationMs } from "../domain/exam-session";
import { answerExamQuestion } from "./answer-exam-question";
import { completeExamSession } from "./complete-exam-session";
import { composeSessionQuestions } from "./exam-session-work";
import { startExamSession } from "./start-exam-session";
import {
  LATER,
  OWNER,
  PAGE,
  pages,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

const FINISHED_AT = new Date(LATER.getTime() + 7 * 60_000 + 5_000);

// Starts a 10-question exam and answers the first `answered` questions in
// order, `wrong` of them wrong (the first ones). Fixture questions have
// correctIndex 0.
async function exam(answered: number, wrong: number) {
  const uow = new InMemoryExamSessionUnitOfWork();
  await seedSessionQuestions(uow, 10);
  const started = await startExamSession(
    { pageId: PAGE, requestedCount: 10 },
    {
      pages,
      uow,
      clock: createFixedClock(LATER),
      ids: { next: () => "session-1" },
    },
    OWNER,
  );
  if (!started.ok) throw started.error;
  const { session } = started.value;
  const questions = await uow.run((repos) =>
    composeSessionQuestions(session, repos),
  );
  if (!questions.ok) throw questions.error;
  for (const [n, q] of questions.value.slice(0, answered).entries()) {
    const result = await answerExamQuestion(
      {
        sessionId: session.id,
        questionId: q.id,
        selectedIndex: n < wrong ? 1 : 0,
      },
      { uow, clock: createFixedClock(new Date(LATER.getTime() + n * 1000)) },
      OWNER,
    );
    if (!result.ok) throw result.error;
  }
  const deps = { uow, clock: createFixedClock(FINISHED_AT) };
  return { uow, deps, sessionId: session.id, questions: questions.value };
}

describe("completeExamSession", () => {
  it("refuses a session with unanswered questions and changes nothing", async () => {
    const { uow, deps, sessionId } = await exam(9, 0);
    const result = await completeExamSession({ sessionId }, deps, OWNER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.SESSION_INCOMPLETE);
    expect(
      (await uow.repos.sessions.findById(sessionId, OWNER))?.finishedAt,
    ).toBeNull();
    expect(uow.reviews.calls).toEqual([]);
  });

  it("stores a failing result, marks the retake and records every answer on SM-2", async () => {
    const { uow, deps, sessionId, questions } = await exam(10, 4);
    const result = await completeExamSession({ sessionId }, deps, OWNER);
    if (!result.ok) throw result.error;
    const failedRoots = questions.slice(0, 4).map((q) => q.rootId);
    expect(result.value.session).toMatchObject({
      finishedAt: FINISHED_AT,
      total: 10,
      correct: 6,
      score: 0.6,
      passed: false,
    });
    expect(result.value.failedRootIds).toEqual(failedRoots);
    expect(examSessionDurationMs(result.value.session)).toBe(425_000);
    expect(await uow.repos.sessions.findById(sessionId, OWNER)).toEqual(
      result.value.session,
    );
    expect(await uow.repos.pageStates.get(PAGE, OWNER)).toEqual({
      pageId: PAGE,
      ownerId: OWNER,
      retakePending: true,
      failedRootIds: failedRoots,
      lastPassedSessionId: null,
    });
    expect(uow.reviews.calls).toEqual([
      {
        ownerId: OWNER,
        sessionId,
        pageId: PAGE,
        now: FINISHED_AT,
        answers: questions.map((q, n) => ({
          rootId: q.rootId,
          correct: n >= 4,
        })),
      },
    ]);
  });

  it("stores a passing result and clears the page state", async () => {
    const { uow, deps, sessionId } = await exam(10, 3);
    const result = await completeExamSession({ sessionId }, deps, OWNER);
    if (!result.ok) throw result.error;
    expect(result.value.session).toMatchObject({ correct: 7, passed: true });
    expect(await uow.repos.pageStates.get(PAGE, OWNER)).toMatchObject({
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: sessionId,
    });
  });

  it("refuses a second finish (the first result stays)", async () => {
    const { uow, deps, sessionId } = await exam(10, 0);
    const first = await completeExamSession({ sessionId }, deps, OWNER);
    if (!first.ok) throw first.error;
    const again = await completeExamSession({ sessionId }, deps, OWNER);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe(EXAM_ERROR.SESSION_FINISHED);
    expect(uow.reviews.calls).toHaveLength(1);
  });

  it("rolls everything back when the SM-2 recording fails", async () => {
    const { uow, deps, sessionId } = await exam(10, 5);
    uow.reviews.failNext = true;
    const result = await completeExamSession({ sessionId }, deps, OWNER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("STUDY_ENGINE_ITEM_NOT_FOUND");
    expect(
      (await uow.repos.sessions.findById(sessionId, OWNER))?.finishedAt,
    ).toBeNull();
    expect(await uow.repos.pageStates.get(PAGE, OWNER)).toBeNull();
  });

  it("refuses another owner's session", async () => {
    const { deps, sessionId } = await exam(10, 0);
    const result = await completeExamSession({ sessionId }, deps, "someone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.SESSION_NOT_FOUND);
  });
});
