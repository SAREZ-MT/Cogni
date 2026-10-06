import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { RECALL_ERROR } from "../domain/errors";
import { SKIPPED_ANSWER_TEXT } from "../domain/recall-answer";
import { newRecallSession } from "../domain/recall-session";
import { saveRecallAnswer } from "./save-recall-answer";
import { InMemoryRecallSessionUnitOfWork } from "./testing/in-memory-recall-session-unit-of-work";
import {
  at,
  NOW,
  OTHER_OWNER,
  OTHER_PAGE,
  OWNER,
  PAGE,
  seedQuestions,
} from "./testing/session-fixtures";

const SESSION = "session-1";

async function setup(now: Date = NOW) {
  const uow = new InMemoryRecallSessionUnitOfWork();
  await seedQuestions(uow, [
    { id: "q-1" },
    { id: "q-2" },
    { id: "q-retired", archived: true },
    { id: "q-other-page", pageId: OTHER_PAGE },
    { id: "q-other-owner", ownerId: OTHER_OWNER },
  ]);
  await uow.repos.sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, NOW),
  );
  let n = 0;
  const deps = {
    uow,
    clock: createFixedClock(now),
    ids: { next: () => `answer-${++n}` },
  };
  return { uow, deps };
}

function answer(
  overrides: Partial<Parameters<typeof saveRecallAnswer>[0]> = {},
) {
  return {
    sessionId: SESSION,
    questionId: "q-1",
    answerText: "  La mitocondria produce ATP.  ",
    selfRating: 4,
    ...overrides,
  };
}

describe("saveRecallAnswer", () => {
  it("stores the answer and self-rating as pending, text trimmed", async () => {
    const { uow, deps } = await setup();

    const result = await saveRecallAnswer(answer(), deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: "answer-1",
      ownerId: OWNER,
      sessionId: SESSION,
      questionId: "q-1",
      answerText: "La mitocondria produce ATP.",
      selfRating: 4,
      evaluationStatus: "pending",
      aiScore: null,
      createdAt: NOW,
    });
    expect(await uow.repos.answers.listBySession(SESSION, OWNER)).toEqual([
      result.value,
    ]);
  });

  it("stores a skip or a blank answer as the skip marker", async () => {
    const { uow, deps } = await setup();

    await saveRecallAnswer(
      answer({ answerText: SKIPPED_ANSWER_TEXT, selfRating: 0 }),
      deps,
      OWNER,
    );
    await saveRecallAnswer(
      answer({ questionId: "q-2", answerText: "   ", selfRating: 2 }),
      deps,
      OWNER,
    );

    const stored = await uow.repos.answers.listBySession(SESSION, OWNER);
    expect(
      stored.map((a) => [a.questionId, a.answerText, a.selfRating]),
    ).toEqual([
      ["q-1", SKIPPED_ANSWER_TEXT, 0],
      ["q-2", SKIPPED_ANSWER_TEXT, 2],
    ]);
  });

  it("replaces the answer to the same question, keeping one row", async () => {
    const { uow, deps } = await setup();
    await saveRecallAnswer(answer(), deps, OWNER);
    const later = await setup(at(1));

    const result = await saveRecallAnswer(
      answer({ answerText: "Otra respuesta", selfRating: 1 }),
      { ...deps, clock: later.deps.clock },
      OWNER,
    );

    const stored = await uow.repos.answers.listBySession(SESSION, OWNER);
    expect(stored).toHaveLength(1);
    expect(result.ok && result.value).toMatchObject({
      id: "answer-1",
      answerText: "Otra respuesta",
      selfRating: 1,
      createdAt: NOW,
      updatedAt: at(1),
    });
  });

  it("accepts a question archived after the session showed it", async () => {
    const { deps } = await setup();

    const result = await saveRecallAnswer(
      answer({ questionId: "q-retired" }),
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
  });

  it.each([
    ["on another page", "q-other-page"],
    ["of another owner", "q-other-owner"],
    ["unknown", "q-ghost"],
  ])("refuses a question %s and writes nothing", async (_name, questionId) => {
    const { uow, deps } = await setup();

    const result = await saveRecallAnswer(answer({ questionId }), deps, OWNER);

    expect(!result.ok && result.error.code).toBe(
      RECALL_ERROR.QUESTION_NOT_IN_SESSION,
    );
    expect(await uow.repos.answers.listBySession(SESSION, OWNER)).toEqual([]);
  });

  it.each([
    -1,
    6,
    2.5,
    Number.NaN,
  ])("refuses the self-rating %s", async (selfRating) => {
    const { uow, deps } = await setup();

    const result = await saveRecallAnswer(answer({ selfRating }), deps, OWNER);

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.INVALID_ANSWER);
    expect(await uow.repos.answers.listBySession(SESSION, OWNER)).toEqual([]);
  });

  it("refuses a finished session", async () => {
    const { uow, deps } = await setup();
    await uow.repos.sessions.finish(SESSION, OWNER, NOW);

    const result = await saveRecallAnswer(answer(), deps, OWNER);

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.SESSION_FINISHED);
    expect(await uow.repos.answers.listBySession(SESSION, OWNER)).toEqual([]);
  });

  it("refuses an unknown or another owner's session", async () => {
    const { deps } = await setup();

    const unknown = await saveRecallAnswer(
      answer({ sessionId: "session-ghost" }),
      deps,
      OWNER,
    );
    const foreign = await saveRecallAnswer(answer(), deps, OTHER_OWNER);

    expect(!unknown.ok && unknown.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
    expect(!foreign.ok && foreign.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });

  it("locks the session inside one unit of work", async () => {
    const { uow, deps } = await setup();
    const locked: string[] = [];
    const lockById = uow.repos.sessions.lockById.bind(uow.repos.sessions);
    uow.repos.sessions.lockById = async (id, ownerId) => {
      locked.push(`${id}@run${uow.runs}`);
      return lockById(id, ownerId);
    };

    await saveRecallAnswer(answer(), deps, OWNER);

    expect(locked).toEqual([`${SESSION}@run1`]);
  });
});
