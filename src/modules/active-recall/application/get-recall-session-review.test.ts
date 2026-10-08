import { describe, expect, it } from "vitest";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallAnswer, SKIPPED_ANSWER_TEXT } from "../domain/recall-answer";
import { newRecallSession } from "../domain/recall-session";
import { getRecallSessionReview } from "./get-recall-session-review";
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

async function setup(options: { finish?: boolean } = {}) {
  const uow = new InMemoryRecallSessionUnitOfWork();
  const { sessions, answers, questions } = uow.repos;
  // q-2 is archived after the session: its stored answer still shows.
  await seedQuestions(uow, [
    { id: "q-1" },
    { id: "q-2", archived: true },
    { id: "q-3" },
  ]);
  await sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, NOW),
  );
  // Answer order: q-3 first, then q-1 skipped, then q-2.
  const seeds = [
    { questionId: "q-3", text: "Produce ATP", self: 4 },
    { questionId: "q-1", text: "", self: 0 },
    { questionId: "q-2", text: "Crestas", self: 2 },
  ];
  for (const [i, seed] of seeds.entries()) {
    const created = newRecallAnswer(
      {
        id: `answer-${i + 1}`,
        ownerId: OWNER,
        sessionId: SESSION,
        questionId: seed.questionId,
        answerText: seed.text,
        selfRating: seed.self,
      },
      new Date(NOW.getTime() + i),
    );
    if (!created.ok) throw created.error;
    await answers.upsert(created.value);
  }
  if (options.finish ?? true) await sessions.finish(SESSION, OWNER, at(0.01));
  return { uow, deps: { sessions, answers, questions } };
}

describe("getRecallSessionReview", () => {
  it("rebuilds a finished session's answered questions in answer order", async () => {
    const { deps } = await setup();

    const result = await getRecallSessionReview(
      { pageId: PAGE, sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toEqual({
      sessionId: SESSION,
      pageId: PAGE,
      records: [
        {
          questionId: "q-3",
          prompt: "¿Pregunta q-3?",
          answerText: "Produce ATP",
          selfRating: 4,
        },
        {
          questionId: "q-1",
          prompt: "¿Pregunta q-1?",
          answerText: SKIPPED_ANSWER_TEXT,
          selfRating: 0,
        },
        {
          questionId: "q-2",
          prompt: "¿Pregunta q-2?",
          answerText: "Crestas",
          selfRating: 2,
        },
      ],
    });
  });

  it("refuses a session that is still open", async () => {
    const { deps } = await setup({ finish: false });

    const result = await getRecallSessionReview(
      { pageId: PAGE, sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });

  it("refuses another page's session", async () => {
    const { deps } = await setup();

    const result = await getRecallSessionReview(
      { pageId: OTHER_PAGE, sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });

  it("refuses another owner's or an unknown session", async () => {
    const { deps } = await setup();

    const foreign = await getRecallSessionReview(
      { pageId: PAGE, sessionId: SESSION },
      deps,
      OTHER_OWNER,
    );
    const unknown = await getRecallSessionReview(
      { pageId: PAGE, sessionId: "missing" },
      deps,
      OWNER,
    );

    expect(!foreign.ok && foreign.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
    expect(!unknown.ok && unknown.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });
});
