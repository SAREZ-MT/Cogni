import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { question } from "./application/testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./application/testing/in-memory-exam-session-unit-of-work";

// Session, composition roots and Sentry are mocked so this proves the
// Server Action boundary (session, Zod validation, view mapping without
// leaking answers, ActionError mapping, revalidation, never-throw) without a
// database; the transaction itself is covered by tests/db/exam-session.test.ts.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const OTHER_PAGE = "9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a";

let current: { uow: InMemoryExamSessionUnitOfWork };

vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string) =>
      pageId === PAGE
        ? ok({ title: "Mitocondria", plainText: "" })
        : err(new DomainError("PAGE_NOT_FOUND", pageId)),
  }),
}));
vi.mock("./infrastructure", () => ({
  DrizzleExamSessionUnitOfWork: vi.fn(function DrizzleExamSessionUnitOfWork() {
    return current.uow;
  }),
}));

// 10 questions on PAGE with uuid ids (the actions validate them), correct
// option 0, concepts "Concepto 1"…
function questionId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

async function seed(uow: InMemoryExamSessionUnitOfWork) {
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

async function actions() {
  return import("./session-actions");
}

async function startedSession(): Promise<string> {
  const { startExamSessionAction } = await actions();
  const started = await startExamSessionAction({ pageId: PAGE });
  if (!started.ok) throw new Error(started.error.code);
  return started.value.sessionId;
}

async function answerAll(sessionId: string, wrong: number) {
  const { answerExamQuestionAction } = await actions();
  for (let n = 1; n <= 10; n += 1) {
    const result = await answerExamQuestionAction({
      sessionId,
      questionId: questionId(n),
      selectedIndex: n <= wrong ? 1 : 0,
    });
    if (!result.ok) throw new Error(result.error.code);
  }
}

describe("exam session actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    current = { uow: new InMemoryExamSessionUnitOfWork() };
    await seed(current.uow);
  });

  it("refuses every action without a signed-in user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { startExamSessionAction, getExamStartAction } = await actions();
    for (const result of [
      await startExamSessionAction({ pageId: PAGE }),
      await getExamStartAction({ pageId: PAGE }),
    ]) {
      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "EXAMS_SESSION_REQUIRED" }),
      });
    }
  });

  it("rejects a count outside 10 to 30 and a malformed id", async () => {
    const { startExamSessionAction, answerExamQuestionAction } =
      await actions();
    const tooFew = await startExamSessionAction({ pageId: PAGE, count: 9 });
    const badId = await answerExamQuestionAction({
      sessionId: "nope",
      questionId: questionId(1),
      selectedIndex: 0,
    });
    for (const result of [tooFew, badId]) {
      expect(!result.ok && result.error.code).toBe("EXAMS_INVALID_INPUT");
    }
  });

  it("starts a 10-question exam by default and reports it on the start view", async () => {
    const { getExamStartAction } = await actions();
    const sessionId = await startedSession();
    expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
    expect(await getExamStartAction({ pageId: PAGE })).toEqual({
      ok: true,
      value: {
        activeQuestionCount: 10,
        retakePending: false,
        openSessionId: sessionId,
        lastFinishedSessionId: null,
      },
    });
  });

  it("never sends the correct option of an unanswered question", async () => {
    const { getExamSessionAction, answerExamQuestionAction } = await actions();
    const sessionId = await startedSession();
    const answered = await answerExamQuestionAction({
      sessionId,
      questionId: questionId(1),
      selectedIndex: 2,
    });
    expect(answered).toEqual({
      ok: true,
      value: {
        questionId: questionId(1),
        selectedIndex: 2,
        isCorrect: false,
        correctIndex: 0,
        explanation: "La respiración celular produce ATP.",
        concept: "Concepto 1",
      },
    });
    const view = await getExamSessionAction({ sessionId });
    if (!view.ok) throw new Error(view.error.code);
    expect(view.value.finished).toBe(false);
    expect(view.value.questions).toHaveLength(10);
    expect(view.value.questions[0]?.answer?.correctIndex).toBe(0);
    const unanswered = view.value.questions[1];
    expect(unanswered).toEqual({
      id: questionId(2),
      stem: "¿Pregunta 2?",
      options: ["ATP", "ADN", "Lípidos", "Almidón"],
      answer: null,
    });
    expect(JSON.stringify(unanswered)).not.toContain("correct");
  });

  it("refuses to finish an incomplete exam, then finishes and shows the results", async () => {
    const { finishExamSessionAction, getExamResultsAction } = await actions();
    const sessionId = await startedSession();
    const early = await finishExamSessionAction({ sessionId });
    expect(!early.ok && early.error.code).toBe("EXAMS_SESSION_INCOMPLETE");

    await answerAll(sessionId, 4);
    const finished = await finishExamSessionAction({ sessionId });
    expect(finished).toEqual({ ok: true, value: { sessionId, passed: false } });
    expect(revalidatePath).toHaveBeenCalledWith("/notebooks", "layout");
    expect(current.uow.reviews.calls).toHaveLength(1);

    const results = await getExamResultsAction({ pageId: PAGE });
    if (!results.ok) throw new Error(results.error.code);
    expect(results.value).toMatchObject({
      sessionId,
      total: 10,
      correct: 6,
      scorePercent: 60,
      passed: false,
      failedConcepts: ["Concepto 1", "Concepto 2", "Concepto 3", "Concepto 4"],
    });
    expect(results.value.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(results.value.questions).toHaveLength(10);
    expect((await getExamResultsAction({ pageId: PAGE, sessionId })).ok).toBe(
      true,
    );
  });

  it("finds no results for a page without a finished exam or another page's session", async () => {
    const { getExamResultsAction } = await actions();
    const sessionId = await startedSession();
    const none = await getExamResultsAction({ pageId: PAGE });
    const open = await getExamResultsAction({ pageId: PAGE, sessionId });
    const otherPage = await getExamResultsAction({
      pageId: OTHER_PAGE,
      sessionId,
    });
    for (const result of [none, open, otherPage]) {
      expect(!result.ok && result.error.code).toBe("EXAMS_SESSION_NOT_FOUND");
    }
  });

  it("refuses a normal exam while a retake is pending", async () => {
    const { startExamSessionAction } = await actions();
    await current.uow.repos.pageStates.upsert({
      pageId: PAGE,
      ownerId: OWNER,
      retakePending: true,
      failedRootIds: [questionId(1)],
      lastPassedSessionId: null,
    });
    const result = await startExamSessionAction({ pageId: PAGE });
    expect(!result.ok && result.error.code).toBe("EXAMS_RETAKE_PENDING");
  });

  it("answers EXAMS_UNEXPECTED and reports when the database throws", async () => {
    const { finishExamSessionAction } = await actions();
    const sessionId = await startedSession();
    current.uow.run = async () => {
      throw new Error("db down");
    };
    const result = await finishExamSessionAction({ sessionId });
    expect(!result.ok && result.error.code).toBe("EXAMS_UNEXPECTED");
    expect(captureException).toHaveBeenCalled();
  });
});
