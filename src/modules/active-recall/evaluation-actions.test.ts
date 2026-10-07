import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRecallSessionUnitOfWork } from "./application/testing/in-memory-recall-session-unit-of-work";
import { seedQuestions } from "./application/testing/session-fixtures";
import { newRecallAnswer } from "./domain/recall-answer";
import { newRecallSession } from "./domain/recall-session";

// Session, composition roots, the runner and Sentry are mocked so this
// proves the evaluation Server Action boundary (session, Zod validation,
// ActionError mapping, scheduling, never-throw) over in-memory fakes.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { scheduleRecallEvaluation } = vi.hoisted(() => ({
  scheduleRecallEvaluation: vi.fn(),
}));
vi.mock("./evaluation-runner", () => ({ scheduleRecallEvaluation }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "5e55a0aa-0000-4000-8000-000000000001";
const ANSWER_1 = "a0000000-0000-4000-8000-000000000001";
const ANSWER_2 = "a0000000-0000-4000-8000-000000000002";
const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";
const STARTED = new Date("2026-10-07T10:00:00.000Z");
const FINISHED = new Date("2026-10-07T10:05:00.000Z");

let current: { uow: InMemoryRecallSessionUnitOfWork; throwOnRead: boolean };

vi.mock("./infrastructure", () => ({
  createDrizzleRecallRepositories: () => {
    if (current.throwOnRead) throw new Error("db down");
    return current.uow.repos;
  },
}));

async function actions() {
  return import("./evaluation-actions");
}

async function seed(options: { finished?: boolean } = {}) {
  const { repos } = current.uow;
  await seedQuestions(current.uow, [
    { id: Q1, ownerId: OWNER, pageId: PAGE },
    { id: Q2, ownerId: OWNER, pageId: PAGE },
  ]);
  await repos.sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, STARTED),
  );
  for (const [id, questionId, text] of [
    [ANSWER_1, Q1, "Produce ATP"],
    [ANSWER_2, Q2, "FALLA"],
  ] as const) {
    const created = newRecallAnswer(
      {
        id,
        ownerId: OWNER,
        sessionId: SESSION,
        questionId,
        answerText: text,
        selfRating: 4,
      },
      STARTED,
    );
    if (!created.ok) throw created.error;
    await repos.answers.upsert(created.value);
  }
  if (options.finished !== false) {
    await repos.sessions.finish(SESSION, OWNER, FINISHED);
  }
}

async function resolveOneFailed() {
  const { repos } = current.uow;
  await repos.answers.saveEvaluation(
    ANSWER_1,
    OWNER,
    {
      status: "done",
      aiEvaluation: {
        score: 4,
        presentConcepts: ["ATP"],
        missingConcepts: [],
        misconceptions: [],
        justification: "Bien.",
      },
      aiScore: 4,
      combinedQuality: 4,
      generationId: "gen-1",
    },
    FINISHED,
  );
  await repos.answers.saveEvaluation(
    ANSWER_2,
    OWNER,
    {
      status: "failed",
      aiEvaluation: { source: "failed", code: "AI_GENERATION_FAILED" },
      generationId: null,
    },
    FINISHED,
  );
  await repos.sessions.setEvaluationStatus(SESSION, OWNER, "partial", FINISHED);
}

describe("active recall evaluation actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    scheduleRecallEvaluation.mockClear();
    current = {
      uow: new InMemoryRecallSessionUnitOfWork(),
      throwOnRead: false,
    };
  });

  it("answers the results of a session still being evaluated and makes sure an evaluation runs", async () => {
    await seed();
    const { getRecallSessionResultsAction } = await actions();

    const result = await getRecallSessionResultsAction({ sessionId: SESSION });

    expect(result.ok && result.value).toMatchObject({
      sessionId: SESSION,
      startedAt: STARTED.toISOString(),
      finishedAt: FINISHED.toISOString(),
      evaluationStatus: "pending",
      averageCombinedQuality: null,
      calibration: { overconfident: 0, underconfident: 0 },
    });
    expect(result.ok && result.value.answers).toHaveLength(2);
    // A run that died leaves answers pending: polling takes them over.
    expect(scheduleRecallEvaluation).toHaveBeenCalledWith(SESSION, OWNER);
  });

  it("never schedules an evaluation for an open or resolved session", async () => {
    await seed({ finished: false });
    const { getRecallSessionResultsAction } = await actions();
    await getRecallSessionResultsAction({ sessionId: SESSION });

    await current.uow.repos.sessions.finish(SESSION, OWNER, FINISHED);
    await resolveOneFailed();
    const partial = await getRecallSessionResultsAction({ sessionId: SESSION });

    expect(scheduleRecallEvaluation).not.toHaveBeenCalled();
    expect(partial.ok && partial.value).toMatchObject({
      evaluationStatus: "partial",
      averageCombinedQuality: 4,
    });
    expect(partial.ok && partial.value.answers[0]).toMatchObject({
      id: ANSWER_1,
      questionId: Q1,
      aiScore: 4,
      combinedQuality: 4,
      feedback: { justification: "Bien." },
    });
  });

  it("requeues the failed answers and schedules their evaluation (Reintentar)", async () => {
    await seed();
    await resolveOneFailed();
    const { retryRecallEvaluationAction } = await actions();

    const result = await retryRecallEvaluationAction({ sessionId: SESSION });

    expect(result.ok && result.value).toEqual({
      sessionId: SESSION,
      requeued: 1,
      evaluationStatus: "pending",
    });
    expect(scheduleRecallEvaluation).toHaveBeenCalledWith(SESSION, OWNER);
  });

  it("schedules nothing when there is nothing to retry", async () => {
    await seed();
    const { retryRecallEvaluationAction } = await actions();
    await current.uow.repos.sessions.setEvaluationStatus(
      SESSION,
      OWNER,
      "done",
      FINISHED,
    );

    const result = await retryRecallEvaluationAction({ sessionId: SESSION });

    expect(result.ok && result.value.requeued).toBe(0);
    expect(scheduleRecallEvaluation).not.toHaveBeenCalled();
  });

  it("records a disagreement without touching the score", async () => {
    await seed();
    await resolveOneFailed();
    const { disagreeRecallAnswerAction } = await actions();

    const result = await disagreeRecallAnswerAction({ answerId: ANSWER_1 });

    expect(result.ok && result.value).toEqual({
      answerId: ANSWER_1,
      disagreed: true,
    });
    const [stored] = await current.uow.repos.answers.listBySession(
      SESSION,
      OWNER,
    );
    expect(stored).toMatchObject({ aiScore: 4, combinedQuality: 4 });
  });

  it("maps refusals to their codes", async () => {
    await seed();
    const {
      disagreeRecallAnswerAction,
      getRecallSessionResultsAction,
      retryRecallEvaluationAction,
    } = await actions();
    const ghost = "5e55a0aa-0000-4000-8000-0000000000ff";

    const results = await getRecallSessionResultsAction({ sessionId: ghost });
    const retry = await retryRecallEvaluationAction({ sessionId: ghost });
    const disagree = await disagreeRecallAnswerAction({ answerId: ghost });

    expect(!results.ok && results.error.code).toBe("RECALL_SESSION_NOT_FOUND");
    expect(!retry.ok && retry.error.code).toBe("RECALL_SESSION_NOT_FOUND");
    expect(!disagree.ok && disagree.error.code).toBe("RECALL_ANSWER_NOT_FOUND");
  });

  it("requires a session and a valid input", async () => {
    const { getRecallSessionResultsAction, disagreeRecallAnswerAction } =
      await actions();

    const invalid = await getRecallSessionResultsAction({ sessionId: "x" });
    const invalidAnswer = await disagreeRecallAnswerAction({});
    getCurrentUser.mockResolvedValue(null);
    const anonymous = await getRecallSessionResultsAction({
      sessionId: SESSION,
    });

    expect(!invalid.ok && invalid.error.code).toBe("RECALL_INVALID_INPUT");
    expect(!invalidAnswer.ok && invalidAnswer.error.code).toBe(
      "RECALL_INVALID_INPUT",
    );
    expect(!anonymous.ok && anonymous.error.code).toBe(
      "RECALL_SESSION_REQUIRED",
    );
  });

  it("never throws: an unexpected failure is reported and answered as UNEXPECTED", async () => {
    current.throwOnRead = true;
    const { getRecallSessionResultsAction } = await actions();

    const result = await getRecallSessionResultsAction({ sessionId: SESSION });

    expect(!result.ok && result.error.code).toBe("RECALL_UNEXPECTED");
    expect(captureException).toHaveBeenCalled();
  });
});
