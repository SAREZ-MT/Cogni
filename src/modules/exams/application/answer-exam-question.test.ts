import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { answerExamQuestion } from "./answer-exam-question";
import { startExamSession } from "./start-exam-session";
import {
  LATER,
  OWNER,
  PAGE,
  pages,
  seedSessionQuestions,
  utcDayCutoff,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

const ANSWERED_AT = new Date(LATER.getTime() + 30_000);

async function started() {
  const uow = new InMemoryExamSessionUnitOfWork();
  await seedSessionQuestions(uow, 12);
  const result = await startExamSession(
    { pageId: PAGE, requestedCount: 10 },
    {
      pages,
      uow,
      clock: createFixedClock(LATER),
      dueCutoff: utcDayCutoff,
      ids: { next: () => "session-1" },
    },
    OWNER,
  );
  if (!result.ok) throw result.error;
  const deps = { uow, clock: createFixedClock(ANSWERED_AT) };
  return { uow, deps, sessionId: result.value.session.id };
}

describe("answerExamQuestion", () => {
  it("grades and stores the answer, revealing the correct option", async () => {
    const { uow, deps, sessionId } = await started();
    // fixtures: correctIndex 0.
    const wrong = await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 2 },
      deps,
      OWNER,
    );
    expect(wrong).toEqual({
      ok: true,
      value: expect.objectContaining({
        questionId: "q-01",
        selectedIndex: 2,
        isCorrect: false,
        correctIndex: 0,
        explanation: "La respiración celular produce ATP.",
        concept: "Concepto q-01",
      }),
    });
    const right = await answerExamQuestion(
      { sessionId, questionId: "q-02", selectedIndex: 0 },
      deps,
      OWNER,
    );
    expect(right.ok && right.value.isCorrect).toBe(true);
    const stored = await uow.repos.answers.listBySession(sessionId, OWNER);
    expect(stored.map((a) => [a.questionId, a.isCorrect])).toEqual([
      ["q-01", false],
      ["q-02", true],
    ]);
    expect(stored[0]?.answeredAt).toEqual(ANSWERED_AT);
  });

  it("checks the question against the list stored at start, whatever the study items do later", async () => {
    const { uow, deps, sessionId } = await started();
    // All 12 were due alike, so q-01..q-10 were composed. Now q-11 and q-12
    // fall due first and q-09, q-10 move far out: a composition run again
    // would swap them, the stored list does not.
    for (const [n, item] of uow.studyItems.items.entries()) {
      const early = item.sourceId === "q-11" || item.sourceId === "q-12";
      uow.studyItems.items[n] = {
        ...item,
        dueAt: early
          ? new Date("2026-09-01T00:00:00.000Z")
          : new Date("2026-12-01T00:00:00.000Z"),
      };
    }
    const shown = await answerExamQuestion(
      { sessionId, questionId: "q-10", selectedIndex: 0 },
      deps,
      OWNER,
    );
    expect(shown.ok).toBe(true);
    const notShown = await answerExamQuestion(
      { sessionId, questionId: "q-11", selectedIndex: 0 },
      deps,
      OWNER,
    );
    expect(notShown.ok).toBe(false);
    if (notShown.ok) return;
    expect(notShown.error.code).toBe(EXAM_ERROR.QUESTION_NOT_IN_SESSION);
    const stored = await uow.repos.answers.listBySession(sessionId, OWNER);
    expect(stored.map((a) => a.questionId)).toEqual(["q-10"]);
  });

  it("refuses a second answer to the same question", async () => {
    const { deps, sessionId } = await started();
    await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 0 },
      deps,
      OWNER,
    );
    const again = await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 1 },
      deps,
      OWNER,
    );
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe(EXAM_ERROR.DUPLICATE_ANSWER);
  });

  it("refuses a question that is not in the session", async () => {
    const { deps, sessionId } = await started();
    // 12 questions, N = 10: q-11 and q-12 stay out.
    const result = await answerExamQuestion(
      { sessionId, questionId: "q-12", selectedIndex: 0 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.QUESTION_NOT_IN_SESSION);
  });

  it("refuses another owner's or an unknown session", async () => {
    const { deps, sessionId } = await started();
    for (const [id, owner] of [
      [sessionId, "someone-else"],
      ["missing", OWNER],
    ] as const) {
      const result = await answerExamQuestion(
        { sessionId: id, questionId: "q-01", selectedIndex: 0 },
        deps,
        owner,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(EXAM_ERROR.SESSION_NOT_FOUND);
    }
  });

  it("refuses an answer to a finished session", async () => {
    const { uow, deps, sessionId } = await started();
    const session = await uow.repos.sessions.findById(sessionId, OWNER);
    if (!session) throw new Error("missing session");
    await uow.repos.sessions.finish({
      ...session,
      finishedAt: ANSWERED_AT,
      total: 1,
      correct: 1,
      score: 1,
      passed: true,
    });
    const result = await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 0 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.SESSION_FINISHED);
  });

  it("refuses an option out of range and stores nothing", async () => {
    const { uow, deps, sessionId } = await started();
    const result = await answerExamQuestion(
      { sessionId, questionId: "q-01", selectedIndex: 4 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_ANSWER);
    expect(await uow.repos.answers.listBySession(sessionId, OWNER)).toEqual([]);
  });
});
