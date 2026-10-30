import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AiGeneration,
  GenerateStructuredInput,
  GenerationRateLimit,
} from "@/modules/ai";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { question } from "./application/testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./application/testing/in-memory-exam-session-unit-of-work";
import { InMemorySessionFeedback } from "./application/testing/in-memory-session-feedback";

// Session, composition roots, env and Sentry are mocked so this proves the
// feedback and review-notice Server Action boundary (session, Zod
// validation, view mapping, ActionError mapping, never-throw) without a
// database or providers; the use cases are covered by their unit tests.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
// The owner's per-day "due" bound (UTC here): the next midnight.
vi.mock("@/modules/scheduling", () => ({
  getCurrentDueCutoff: async () => (now: Date) =>
    new Date((Math.floor(now.getTime() / 86_400_000) + 1) * 86_400_000),
}));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({
  serverEnv: () => ({ AI_PAGE_TOKEN_CAP: 12000 }),
}));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const RESET = new Date("2026-10-06T00:00:00.000Z");

const FEEDBACK_OBJECT = {
  summary: "Buen intento.",
  strengths: ["Las preguntas de ADN"],
  toReinforce: ["Concepto 1"],
  nextStepSuggestion: "Repasa la página y repite el examen.",
};

let current: {
  uow: InMemoryExamSessionUnitOfWork;
  feedback: InMemorySessionFeedback;
  limit: GenerationRateLimit;
  calls: GenerateStructuredInput[];
  checks: number;
};

vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({
    generateStructured: async (input: GenerateStructuredInput) => {
      current.calls.push(input);
      return ok({
        object: FEEDBACK_OBJECT,
        generation: { id: "gen-1" } as AiGeneration,
      });
    },
    generationLimiter: {
      check: async () => {
        current.checks += 1;
        return current.limit;
      },
      peek: async () => current.limit,
    },
  }),
}));
vi.mock("@/modules/study-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/study-engine")>()),
  createSessionFeedbackSources: () => ({ feedback: current.feedback }),
}));
vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string) =>
      pageId === PAGE
        ? ok({ title: "Mitocondria", plainText: "La mitocondria produce ATP." })
        : err(new DomainError("PAGE_NOT_FOUND", pageId)),
  }),
}));
// readExamFeedback passes through unless a test replaces it (a failing
// feedback read must never hide the exam's score).
const { readFeedbackOverride } = vi.hoisted(() => ({
  readFeedbackOverride: { run: null as null | (() => Promise<unknown>) },
}));
vi.mock("./application", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./application")>();
  return {
    ...actual,
    readExamFeedback: (...args: Parameters<typeof actual.readExamFeedback>) =>
      readFeedbackOverride.run
        ? readFeedbackOverride.run()
        : actual.readExamFeedback(...args),
  };
});
vi.mock("./infrastructure", () => ({
  DrizzleExamSessionUnitOfWork: vi.fn(function DrizzleExamSessionUnitOfWork() {
    return current.uow;
  }),
}));

function questionId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

// 10 questions on PAGE, then a finished exam with `wrong` wrong answers.
async function finishedExam(wrong: number): Promise<string> {
  const { uow } = current;
  if ((await uow.repos.questions.listActiveByPage(PAGE, OWNER)).length === 0) {
    for (let n = 1; n <= 10; n += 1) {
      const id = questionId(n);
      await uow.repos.questions.save(
        question(id, {
          ownerId: OWNER,
          pageId: PAGE,
          rootId: id,
          stem: `¿Pregunta ${n}?`,
          concept: `Concepto ${n}`,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        }),
      );
      uow.studyItems.addItem({
        ownerId: OWNER,
        pageId: PAGE,
        rootId: id,
        dueAt: new Date("2026-10-01T00:00:00.000Z"),
      });
    }
  }
  const sessions = await import("./session-actions");
  const started = await sessions.startExamSessionAction({ pageId: PAGE });
  if (!started.ok) throw new Error(started.error.code);
  const { sessionId } = started.value;
  const view = await sessions.getExamSessionAction({ sessionId });
  if (!view.ok) throw new Error(view.error.code);
  for (const [n, q] of view.value.questions.entries()) {
    const answered = await sessions.answerExamQuestionAction({
      sessionId,
      questionId: q.id,
      selectedIndex: n < wrong ? 1 : 0,
    });
    if (!answered.ok) throw new Error(answered.error.code);
  }
  const finished = await sessions.finishExamSessionAction({ sessionId });
  if (!finished.ok) throw new Error(finished.error.code);
  return sessionId;
}

async function actions() {
  return import("./feedback-actions");
}

describe("exam feedback actions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    readFeedbackOverride.run = null;
    getCurrentUser.mockResolvedValue({ id: OWNER });
    current = {
      uow: new InMemoryExamSessionUnitOfWork(),
      feedback: new InMemorySessionFeedback(),
      limit: { allowed: true, remaining: 5, resetAt: RESET },
      calls: [],
      checks: 0,
    };
  });

  it("requires a signed-in user and a valid session id", async () => {
    const { requestExamFeedbackAction, getExamReviewNoticeAction } =
      await actions();
    expect((await requestExamFeedbackAction({ sessionId: "nope" })).ok).toBe(
      false,
    );
    getCurrentUser.mockResolvedValue(null);
    const anonymous = await requestExamFeedbackAction({ sessionId: OWNER });
    const notice = await getExamReviewNoticeAction({ pageId: PAGE });
    for (const result of [anonymous, notice]) {
      expect(!result.ok && result.error.code).toBe("EXAMS_SESSION_REQUIRED");
    }
  });

  it("gives a failed exam its AI feedback without spending a generation", async () => {
    const sessionId = await finishedExam(4);
    const { requestExamFeedbackAction } = await actions();

    const result = await requestExamFeedbackAction({ sessionId });

    expect(result).toEqual({
      ok: true,
      value: { status: "done", reused: false, content: FEEDBACK_OBJECT },
    });
    expect(current.calls).toHaveLength(1);
    expect(current.calls[0].promptVersion).toBe("session_feedback/v2");
    expect(current.checks).toBe(0);
  });

  it("shows the last pass's feedback again for a later pass", async () => {
    // Only Date is faked: the actions' system clock reads it, promises run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
    const first = await finishedExam(0);
    const { requestExamFeedbackAction } = await actions();
    await requestExamFeedbackAction({ sessionId: first });
    // Finish strictly later than the first exam.
    vi.setSystemTime(new Date("2026-10-05T11:00:00.000Z"));
    const second = await finishedExam(1);

    const result = await requestExamFeedbackAction({ sessionId: second });

    expect(result).toEqual({
      ok: true,
      value: { status: "done", reused: true, content: FEEDBACK_OBJECT },
    });
    expect(current.calls).toHaveLength(1);
  });

  it("returns the feedback in the results view once it exists", async () => {
    const sessionId = await finishedExam(4);
    const { getExamResultsAction } = await import("./session-actions");
    const before = await getExamResultsAction({ pageId: PAGE });
    if (!before.ok) throw new Error(before.error.code);
    expect(before.value.feedback).toBeNull();

    const { requestExamFeedbackAction } = await actions();
    await requestExamFeedbackAction({ sessionId });
    const after = await getExamResultsAction({ pageId: PAGE });
    if (!after.ok) throw new Error(after.error.code);
    expect(after.value.feedback).toEqual({
      status: "done",
      reused: false,
      content: FEEDBACK_OBJECT,
    });
  });

  it.each([
    [
      "throws",
      async () => {
        throw new Error("feedback table down");
      },
    ],
    [
      "returns an error",
      async () => err(new DomainError("EXAMS_SESSION_NOT_FOUND", "gone")),
    ],
  ])("still returns the score when the feedback read %s", async (_, run) => {
    await finishedExam(4);
    const { getExamResultsAction } = await import("./session-actions");
    readFeedbackOverride.run = run;

    const result = await getExamResultsAction({ pageId: PAGE });

    if (!result.ok) throw new Error(result.error.code);
    expect(result.value).toMatchObject({
      total: 10,
      correct: 6,
      passed: false,
      feedback: null,
    });
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("refuses feedback for an open session", async () => {
    const sessions = await import("./session-actions");
    await finishedExam(0);
    const started = await sessions.startExamSessionAction({ pageId: PAGE });
    if (!started.ok) throw new Error(started.error.code);
    const { requestExamFeedbackAction } = await actions();

    const result = await requestExamFeedbackAction({
      sessionId: started.value.sessionId,
    });

    expect(!result.ok && result.error.code).toBe("EXAMS_FEEDBACK_SESSION_OPEN");
  });

  it("lists the failed concepts while a retake is pending, and nothing otherwise", async () => {
    const { getExamReviewNoticeAction } = await actions();
    expect(await getExamReviewNoticeAction({ pageId: PAGE })).toEqual({
      ok: true,
      value: null,
    });

    await finishedExam(4);
    const notice = await getExamReviewNoticeAction({ pageId: PAGE });
    if (!notice.ok) throw new Error(notice.error.code);
    expect(notice.value?.failedConcepts).toHaveLength(4);
  });

  it("answers EXAMS_UNEXPECTED and reports when the database throws", async () => {
    const { getExamReviewNoticeAction } = await actions();
    current.uow.run = async () => {
      throw new Error("db down");
    };

    const result = await getExamReviewNoticeAction({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("EXAMS_UNEXPECTED");
    expect(captureException).toHaveBeenCalled();
  });
});
