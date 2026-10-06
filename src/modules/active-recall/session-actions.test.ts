import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { InMemoryRecallSessionUnitOfWork } from "./application/testing/in-memory-recall-session-unit-of-work";
import { seedQuestions } from "./application/testing/session-fixtures";
import { SKIPPED_ANSWER_TEXT } from "./domain/recall-answer";

// Session, composition roots and Sentry are mocked so this proves the
// session Server Action boundary (session, Zod validation, ActionError
// mapping, revalidation, never-throw) over the in-memory unit of work;
// same pattern as actions.test.ts.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

let current: { uow: InMemoryRecallSessionUnitOfWork; throwOnPage: boolean };

vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string, ownerId: string) => {
      if (current.throwOnPage) throw new Error("db down");
      return pageId === PAGE && ownerId === OWNER
        ? ok({ title: "Mitocondria", plainText: "ATP" })
        : err(new DomainError("PAGE_NOT_FOUND", pageId));
    },
  }),
}));
vi.mock("@/modules/study-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/study-engine")>()),
  createStudyItemRepository: () => current.uow.repos.studyItems,
}));
vi.mock("./infrastructure", () => ({
  DrizzleRecallSessionUnitOfWork: vi.fn(
    function DrizzleRecallSessionUnitOfWork() {
      return current.uow;
    },
  ),
  DrizzleRecallQuestionRepository: vi.fn(
    function DrizzleRecallQuestionRepository() {
      return current.uow.repos.questions;
    },
  ),
}));

async function actions() {
  return import("./session-actions");
}

async function seed() {
  await seedQuestions(current.uow, [
    { id: Q1, ownerId: OWNER, pageId: PAGE },
    { id: Q2, ownerId: OWNER, pageId: PAGE },
  ]);
}

describe("active recall session actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    revalidatePath.mockClear();
    current = {
      uow: new InMemoryRecallSessionUnitOfWork(),
      throwOnPage: false,
    };
  });

  it("plans the page's questions without writing", async () => {
    await seed();
    const { getRecallSessionPlanAction } = await actions();

    const result = await getRecallSessionPlanAction({ pageId: PAGE });

    expect(result).toEqual(
      ok({
        questions: [
          { id: Q1, prompt: `¿Pregunta ${Q1}?` },
          { id: Q2, prompt: `¿Pregunta ${Q2}?` },
        ],
      }),
    );
    expect(current.uow.repos.sessions.rows.size).toBe(0);
  });

  it("starts, saves, skips and finishes a session", async () => {
    await seed();
    const {
      finishRecallSessionAction,
      saveRecallAnswerAction,
      startRecallSessionAction,
    } = await actions();

    const started = await startRecallSessionAction({ pageId: PAGE });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.questions.map((q) => q.id)).toEqual([Q1, Q2]);
    const { sessionId } = started.value;

    const saved = await saveRecallAnswerAction({
      sessionId,
      questionId: Q1,
      answerText: "Produce ATP",
      selfRating: 4,
    });
    const skipped = await saveRecallAnswerAction({
      sessionId,
      questionId: Q2,
      answerText: SKIPPED_ANSWER_TEXT,
      selfRating: 0,
    });
    expect(saved).toEqual(
      ok({ questionId: Q1, answerText: "Produce ATP", selfRating: 4 }),
    );
    expect(skipped.ok && skipped.value.answerText).toBe(SKIPPED_ANSWER_TEXT);

    const finished = await finishRecallSessionAction({ sessionId });
    expect(finished).toEqual(
      ok({ sessionId, answeredCount: 2, evaluationStatus: "pending" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/active-recall", "layout");
  });

  it("maps refusals to their codes", async () => {
    await seed();
    const {
      finishRecallSessionAction,
      saveRecallAnswerAction,
      startRecallSessionAction,
    } = await actions();

    const noQuestions = await startRecallSessionAction({
      pageId: "0a1b2c3d-4e5f-4061-8798-000000000000",
    });
    expect(!noQuestions.ok && noQuestions.error.code).toBe("PAGE_NOT_FOUND");

    const started = await startRecallSessionAction({ pageId: PAGE });
    if (!started.ok) throw new Error("start failed");
    const { sessionId } = started.value;
    const badRating = await saveRecallAnswerAction({
      sessionId,
      questionId: Q1,
      answerText: "x",
      selfRating: 7,
    });
    expect(!badRating.ok && badRating.error.code).toBe("RECALL_INVALID_ANSWER");

    await finishRecallSessionAction({ sessionId });
    const late = await saveRecallAnswerAction({
      sessionId,
      questionId: Q1,
      answerText: "x",
      selfRating: 3,
    });
    expect(!late.ok && late.error.code).toBe("RECALL_SESSION_FINISHED");
  });

  it("refuses a page without questions with RECALL_NO_QUESTIONS", async () => {
    const { startRecallSessionAction } = await actions();

    const result = await startRecallSessionAction({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("RECALL_NO_QUESTIONS");
  });

  it.each([
    ["getRecallSessionPlanAction", { pageId: "nope" }],
    ["startRecallSessionAction", { pageId: 1 }],
    [
      "saveRecallAnswerAction",
      { sessionId: PAGE, questionId: Q1, answerText: 3, selfRating: 1 },
    ],
    [
      "saveRecallAnswerAction",
      {
        sessionId: PAGE,
        questionId: Q1,
        answerText: "x".repeat(20_001),
        selfRating: 1,
      },
    ],
    ["finishRecallSessionAction", { sessionId: "nope" }],
  ] as const)("%s rejects invalid input", async (name, input) => {
    const all = await actions();

    const result = await all[name](input);

    expect(!result.ok && result.error.code).toBe("RECALL_INVALID_INPUT");
  });

  it.each([
    "getRecallSessionPlanAction",
    "startRecallSessionAction",
    "saveRecallAnswerAction",
    "finishRecallSessionAction",
  ] as const)("%s requires a signed-in user", async (name) => {
    getCurrentUser.mockResolvedValue(null);
    const all = await actions();

    const result = await all[name]({});

    expect(!result.ok && result.error.code).toBe("RECALL_SESSION_REQUIRED");
  });

  it("never throws: an unexpected failure is reported and answered generically", async () => {
    current.throwOnPage = true;
    const { startRecallSessionAction } = await actions();

    const result = await startRecallSessionAction({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("RECALL_UNEXPECTED");
    expect(captureException).toHaveBeenCalled();
  });
});
