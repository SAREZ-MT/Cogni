import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  type GenerateStructuredInput,
  type GenerationRateLimit,
} from "@/modules/ai";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { question } from "./application/testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./application/testing/in-memory-exam-session-unit-of-work";

// Session, composition roots, env and Sentry are mocked so this proves the
// retake Server Action boundary (session, Zod validation, ActionError
// mapping with resetAt, revalidation, never-throw) without a database or
// providers; the transaction itself is covered by tests/db/exam-retake.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
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

const generation = {
  id: "0b1c2d3e-4f50-4617-8899-aabbccddeeff",
} as AiGeneration;

let current: {
  uow: InMemoryExamSessionUnitOfWork;
  limit: GenerationRateLimit;
  checks: number;
  generate: (input: GenerateStructuredInput) => Promise<unknown>;
};

vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({
    entries: [],
    generateStructured: (input: GenerateStructuredInput) =>
      current.generate(input),
    generationLimiter: {
      check: async () => {
        current.checks += 1;
        return current.limit;
      },
      peek: async () => current.limit,
    },
  }),
}));
vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string) =>
      pageId === PAGE
        ? ok({ title: "Mitocondria", plainText: "La mitocondria produce ATP." })
        : err(new DomainError("PAGE_NOT_FOUND", pageId)),
  }),
}));
vi.mock("./infrastructure", () => ({
  DrizzleExamSessionUnitOfWork: vi.fn(function DrizzleExamSessionUnitOfWork() {
    return current.uow;
  }),
}));

function questionId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

// One fresh wording per root listed in the variants prompt.
async function freshVariants(input: GenerateStructuredInput) {
  const roots = [...input.prompt.matchAll(/^Root (\S+) \[/gm)].map(
    (m) => m[1] as string,
  );
  return ok({
    object: {
      variants: roots.map((rootId) => ({
        forRootId: rootId,
        stem: `¿Reformulada ${rootId}?`,
        options: ["ATP", "ADN", "Lípidos", "Almidón"],
        correctIndex: 0,
        explanation: "Produce ATP.",
      })),
    },
    generation,
  });
}

// 10 questions on PAGE, then an exam with 4 wrong answers: retake pending.
async function failedPage() {
  const { uow } = current;
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
  const sessions = await import("./session-actions");
  const started = await sessions.startExamSessionAction({ pageId: PAGE });
  if (!started.ok) throw new Error(started.error.code);
  const view = await sessions.getExamSessionAction({
    sessionId: started.value.sessionId,
  });
  if (!view.ok) throw new Error(view.error.code);
  for (const [i, q] of view.value.questions.entries()) {
    const answered = await sessions.answerExamQuestionAction({
      sessionId: started.value.sessionId,
      questionId: q.id,
      selectedIndex: i < 4 ? 1 : 0,
    });
    if (!answered.ok) throw new Error(answered.error.code);
  }
  const finished = await sessions.finishExamSessionAction({
    sessionId: started.value.sessionId,
  });
  if (!finished.ok || finished.value.passed) throw new Error("not failed");
  revalidatePath.mockClear();
}

async function action() {
  return (await import("./retake-actions")).startExamRetakeAction;
}

describe("startExamRetakeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    current = {
      uow: new InMemoryExamSessionUnitOfWork(),
      limit: { allowed: true, remaining: 4, resetAt: RESET },
      checks: 0,
      generate: freshVariants,
    };
  });

  it("refuses without a signed-in user and rejects a malformed input", async () => {
    const start = await action();
    getCurrentUser.mockResolvedValueOnce(null);
    const anonymous = await start({ pageId: PAGE, count: 10 });
    expect(!anonymous.ok && anonymous.error.code).toBe(
      "EXAMS_SESSION_REQUIRED",
    );
    for (const input of [
      { pageId: PAGE, count: 9 },
      { pageId: PAGE },
      { pageId: "nope", count: 10 },
    ]) {
      const result = await start(input);
      expect(!result.ok && result.error.code).toBe("EXAMS_INVALID_INPUT");
    }
  });

  it("starts the retake, revalidates the exams and notebook routes and reports the generations left", async () => {
    await failedPage();
    const start = await action();
    const result = await start({ pageId: PAGE, count: 10 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ resumed: false, remainingToday: 4 });
    expect(current.checks).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/notebooks", "layout");

    const { getExamStartAction } = await import("./session-actions");
    const view = await getExamStartAction({ pageId: PAGE });
    expect(view.ok && view.value).toMatchObject({
      retakePending: true,
      failedRootCount: 4,
      openSessionId: null,
      openRetakeSessionId: result.value.sessionId,
    });
  });

  it("answers the daily limit with its reset time and calls no model", async () => {
    await failedPage();
    current.limit = { allowed: false, remaining: 0, resetAt: RESET };
    const generate = vi.fn(freshVariants);
    current.generate = generate;
    const result = await (await action())({ pageId: PAGE, count: 10 });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: AI_ERROR.DAILY_LIMIT_REACHED,
        resetAt: RESET.toISOString(),
      }),
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("answers EXAMS_RETAKE_VARIANT_MISSING when the variants cannot be generated", async () => {
    await failedPage();
    current.generate = async () =>
      err(new DomainError(AI_ERROR.NO_PROVIDER_AVAILABLE, "none"));
    const result = await (await action())({ pageId: PAGE, count: 10 });
    expect(!result.ok && result.error.code).toBe(
      "EXAMS_RETAKE_VARIANT_MISSING",
    );
    expect(current.checks).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("never throws: an unexpected failure is reported and answered as EXAMS_UNEXPECTED", async () => {
    await failedPage();
    current.generate = async () => {
      throw new Error("socket hang up");
    };
    const result = await (await action())({ pageId: PAGE, count: 10 });
    expect(!result.ok && result.error.code).toBe("EXAMS_UNEXPECTED");
    expect(captureException).toHaveBeenCalled();
  });
});
