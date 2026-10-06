import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallSession } from "../domain/recall-session";
import { finishRecallSession } from "./finish-recall-session";
import { saveRecallAnswer } from "./save-recall-answer";
import { InMemoryRecallSessionUnitOfWork } from "./testing/in-memory-recall-session-unit-of-work";
import {
  at,
  NOW,
  OTHER_OWNER,
  OWNER,
  PAGE,
  seedQuestions,
} from "./testing/session-fixtures";

const SESSION = "session-1";

async function setup() {
  const uow = new InMemoryRecallSessionUnitOfWork();
  await seedQuestions(uow, [{ id: "q-1" }, { id: "q-2" }, { id: "q-3" }]);
  await uow.repos.sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, NOW),
  );
  let n = 0;
  const ids = { next: () => `answer-${++n}` };
  const answer = (questionId: string, answerText: string, selfRating: number) =>
    saveRecallAnswer(
      { sessionId: SESSION, questionId, answerText, selfRating },
      { uow, clock: createFixedClock(NOW), ids },
      OWNER,
    );
  const deps = { uow, clock: createFixedClock(at(1)) };
  return { uow, deps, answer };
}

describe("finishRecallSession", () => {
  it("closes the session with its answers, left pending for the evaluation", async () => {
    const { uow, deps, answer } = await setup();
    await answer("q-1", "ATP", 4);
    await answer("q-2", "", 0);

    const result = await finishRecallSession(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      session: {
        id: SESSION,
        ownerId: OWNER,
        pageId: PAGE,
        startedAt: NOW,
        finishedAt: at(1),
        evaluationStatus: "pending",
      },
      answeredCount: 2,
      alreadyFinished: false,
    });
    expect(await uow.repos.sessions.findById(SESSION, OWNER)).toEqual(
      result.value.session,
    );
    const answers = await uow.repos.answers.listBySession(SESSION, OWNER);
    expect(answers.map((a) => [a.questionId, a.evaluationStatus])).toEqual([
      ["q-1", "pending"],
      ["q-2", "pending"],
    ]);
  });

  it("closes a session without answers as done: nothing to evaluate", async () => {
    const { deps } = await setup();

    const result = await finishRecallSession(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      session: { finishedAt: at(1), evaluationStatus: "done" },
      answeredCount: 0,
    });
  });

  it("is idempotent: a repeat returns the stored session unchanged", async () => {
    const { deps, answer } = await setup();
    await answer("q-1", "ATP", 4);
    const first = await finishRecallSession(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    const repeat = await finishRecallSession(
      { sessionId: SESSION },
      { ...deps, clock: createFixedClock(at(2)) },
      OWNER,
    );

    expect(repeat.ok && repeat.value).toEqual({
      session: first.ok && first.value.session,
      answeredCount: 1,
      alreadyFinished: true,
    });
  });

  it("refuses an unknown or another owner's session", async () => {
    const { uow, deps } = await setup();

    for (const [sessionId, ownerId] of [
      ["session-ghost", OWNER],
      [SESSION, OTHER_OWNER],
    ] as const) {
      const result = await finishRecallSession({ sessionId }, deps, ownerId);
      expect(!result.ok && result.error.code).toBe(
        RECALL_ERROR.SESSION_NOT_FOUND,
      );
    }
    expect(
      (await uow.repos.sessions.findById(SESSION, OWNER))?.finishedAt,
    ).toBeNull();
  });

  it("locks the session inside one unit of work", async () => {
    const { uow, deps } = await setup();
    const locked: number[] = [];
    const lockById = uow.repos.sessions.lockById.bind(uow.repos.sessions);
    uow.repos.sessions.lockById = async (id, ownerId) => {
      locked.push(uow.runs);
      return lockById(id, ownerId);
    };

    await finishRecallSession({ sessionId: SESSION }, deps, OWNER);

    expect(locked).toEqual([uow.runs]);
  });
});
