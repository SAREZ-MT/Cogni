import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallAnswer, skippedEvaluation } from "../domain/recall-answer";
import { newRecallSession } from "../domain/recall-session";
import {
  disagreeRecallAnswer,
  evaluationFeedbackOf,
  getRecallSessionResults,
  retryRecallEvaluation,
} from "./recall-session-results";
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
const MODEL_OUTPUT = {
  score: 4,
  presentConcepts: ["ATP"],
  missingConcepts: ["respiración celular"],
  misconceptions: ["Confunde ATP con ADN"],
  justification: "Explicaste el ATP, pero te faltó la respiración celular.",
};

async function setup() {
  const uow = new InMemoryRecallSessionUnitOfWork();
  const { sessions, answers } = uow.repos;
  await seedQuestions(uow, [{ id: "q-1" }, { id: "q-2" }, { id: "q-3" }]);
  await sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, NOW),
  );
  const seeds = [
    { questionId: "q-1", text: "ATP", self: 5 },
    { questionId: "q-2", text: "", self: 0 },
    { questionId: "q-3", text: "Núcleo", self: 4 },
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
  await sessions.finish(SESSION, OWNER, at(0.01));
  const deps = { sessions, answers, clock: createFixedClock(at(1)) };
  return { uow, deps };
}

async function resolve(uow: InMemoryRecallSessionUnitOfWork) {
  const { answers, sessions } = uow.repos;
  await answers.saveEvaluation(
    "answer-1",
    OWNER,
    {
      status: "done",
      aiEvaluation: MODEL_OUTPUT,
      aiScore: 2,
      combinedQuality: 3,
      generationId: "gen-1",
    },
    at(1),
  );
  await answers.saveEvaluation(
    "answer-2",
    OWNER,
    {
      status: "done",
      aiEvaluation: skippedEvaluation(),
      aiScore: 0,
      combinedQuality: 0,
      generationId: null,
    },
    at(1),
  );
  await answers.saveEvaluation(
    "answer-3",
    OWNER,
    {
      status: "failed",
      aiEvaluation: { source: "failed", code: "AI_GENERATION_FAILED" },
      generationId: "gen-2",
    },
    at(1),
  );
  await sessions.setEvaluationStatus(SESSION, OWNER, "partial", at(1));
}

describe("evaluationFeedbackOf", () => {
  it("reads the justification and concepts of a model evaluation", () => {
    expect(evaluationFeedbackOf(MODEL_OUTPUT)).toEqual({
      justification: MODEL_OUTPUT.justification,
      presentConcepts: ["ATP"],
      missingConcepts: ["respiración celular"],
      misconceptions: ["Confunde ATP con ADN"],
    });
  });

  it("reads the skipped record", () => {
    expect(evaluationFeedbackOf(skippedEvaluation())).toEqual({
      justification: "Pregunta sin responder.",
      presentConcepts: [],
      missingConcepts: [],
      misconceptions: [],
    });
  });

  it("has nothing for a failed attempt, a pending answer or a malformed value", () => {
    expect(evaluationFeedbackOf({ source: "failed" })).toBeNull();
    expect(evaluationFeedbackOf(null)).toBeNull();
    expect(evaluationFeedbackOf("texto")).toBeNull();
  });
});

describe("getRecallSessionResults", () => {
  it("lists the pending answers of a session still being evaluated", async () => {
    const { deps } = await setup();

    const result = await getRecallSessionResults(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      session: { id: SESSION, evaluationStatus: "pending" },
      averageCombinedQuality: null,
      calibration: { overconfident: 0, underconfident: 0 },
    });
    expect(
      result.ok &&
        result.value.answers.map((a) => [a.questionId, a.evaluationStatus]),
    ).toEqual([
      ["q-1", "pending"],
      ["q-2", "pending"],
      ["q-3", "pending"],
    ]);
    expect(result.ok && result.value.answers[0]?.feedback).toBeNull();
  });

  it("gives each resolved answer its scores and feedback, with the average and calibration", async () => {
    const { uow, deps } = await setup();
    await resolve(uow);

    const result = await getRecallSessionResults(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.session.evaluationStatus).toBe("partial");
    expect(result.value.averageCombinedQuality).toBe(1.5);
    // q-1: self 5, ai 2 → overconfident; q-2: self 0, ai 0 → calibrated.
    expect(result.value.calibration).toEqual({
      overconfident: 1,
      underconfident: 0,
    });
    expect(result.value.answers[0]).toEqual({
      id: "answer-1",
      questionId: "q-1",
      answerText: "ATP",
      selfRating: 5,
      evaluationStatus: "done",
      aiScore: 2,
      combinedQuality: 3,
      disagreed: false,
      feedback: evaluationFeedbackOf(MODEL_OUTPUT),
    });
    expect(result.value.answers[2]).toMatchObject({
      evaluationStatus: "failed",
      aiScore: null,
      feedback: null,
    });
  });

  it("refuses an unknown or another owner's session", async () => {
    const { deps } = await setup();
    const result = await getRecallSessionResults(
      { sessionId: SESSION },
      deps,
      OTHER_OWNER,
    );
    expect(!result.ok && result.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });
});

describe("retryRecallEvaluation", () => {
  it("moves the failed answers back to pending and the session with them", async () => {
    const { uow, deps } = await setup();
    await resolve(uow);

    const result = await retryRecallEvaluation(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      requeued: 1,
      session: { evaluationStatus: "pending" },
    });
    const answers = await uow.repos.answers.listBySession(SESSION, OWNER);
    expect(answers.map((a) => a.evaluationStatus)).toEqual([
      "done",
      "done",
      "pending",
    ]);
  });

  it("changes nothing when no answer failed", async () => {
    const { uow, deps } = await setup();
    await uow.repos.sessions.setEvaluationStatus(SESSION, OWNER, "done", at(1));

    const result = await retryRecallEvaluation(
      { sessionId: SESSION },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      requeued: 0,
      session: { evaluationStatus: "done" },
    });
  });

  it("refuses an unknown or another owner's session", async () => {
    const { deps } = await setup();
    const result = await retryRecallEvaluation(
      { sessionId: "session-ghost" },
      deps,
      OWNER,
    );
    expect(!result.ok && result.error.code).toBe(
      RECALL_ERROR.SESSION_NOT_FOUND,
    );
  });
});

describe("disagreeRecallAnswer", () => {
  it("records the disagreement and never touches the score", async () => {
    const { uow, deps } = await setup();
    await resolve(uow);

    const result = await disagreeRecallAnswer(
      { answerId: "answer-1" },
      deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      id: "answer-1",
      disagreed: true,
      aiScore: 2,
      combinedQuality: 3,
    });
  });

  it("refuses an unknown or another owner's answer", async () => {
    const { deps } = await setup();
    for (const [answerId, ownerId] of [
      ["answer-ghost", OWNER],
      ["answer-1", OTHER_OWNER],
    ] as const) {
      const result = await disagreeRecallAnswer({ answerId }, deps, ownerId);
      expect(!result.ok && result.error.code).toBe(
        RECALL_ERROR.ANSWER_NOT_FOUND,
      );
    }
  });
});
