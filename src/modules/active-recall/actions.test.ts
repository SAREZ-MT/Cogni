import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  type GenerationRateLimit,
} from "@/modules/ai";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { InMemoryRecallUnitOfWork } from "./application/testing/in-memory-recall-unit-of-work";

// Session, composition roots, analytics and Sentry are mocked so this
// proves the generation Server Action boundary (session, Zod validation,
// ActionError mapping with resetAt, analytics, revalidation, never-throw)
// without a database or providers; same pattern as exams'
// generate-exam-questions-action.test.ts.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({
  serverEnv: () => ({
    AI_PAGE_TOKEN_CAP: 12000,
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  }),
}));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track }),
}));

const RESET = new Date("2026-10-07T00:00:00.000Z");
const generation: AiGeneration = {
  id: "0b1c2d3e-4f50-4617-8899-aabbccddeeff",
  ownerId: "o1",
  pageId: null,
  purpose: "generate_recall_questions",
  provider: "gemini-flash-lite",
  model: "gemini-3.5-flash-lite",
  promptVersion: "generate_recall_questions/v1",
  inputTokens: 1,
  outputTokens: 1,
  latencyMs: 1,
  status: "done",
  error: null,
  createdAt: RESET,
  updatedAt: RESET,
};

function questions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    prompt: `Explica la idea ${i + 1}.`,
    rubric: {
      keyConcepts: ["ATP", `Concepto ${i + 1}`],
      acceptableAnswerSummary: "Resumen aceptable.",
    },
  }));
}

let current: {
  uow: InMemoryRecallUnitOfWork;
  limit: GenerationRateLimit;
  checks: number;
  pageText: string | null;
  generate: () => Promise<unknown>;
  throwOnPageRead: boolean;
  checkFails: boolean;
};

vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({
    entries: [],
    generateStructured: () => current.generate(),
    generationLimiter: {
      check: async () => {
        current.checks += 1;
        if (current.checkFails) throw new Error("redis down");
        return current.limit;
      },
      peek: async () => current.limit,
    },
  }),
}));
vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string) => {
      if (current.throwOnPageRead) throw new Error("db down");
      return current.pageText === null
        ? err(new DomainError("PAGE_NOT_FOUND", pageId))
        : ok({ title: "Mitocondria", plainText: current.pageText });
    },
  }),
}));
vi.mock("./infrastructure", () => ({
  DrizzleRecallUnitOfWork: vi.fn(function DrizzleRecallUnitOfWork() {
    return current.uow;
  }),
  DrizzleRecallFingerprints: vi.fn(function DrizzleRecallFingerprints() {
    return current.uow.fingerprints;
  }),
  DrizzleRecallQuestionRepository: vi.fn(
    function DrizzleRecallQuestionRepository() {
      return current.uow.questions;
    },
  ),
}));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

async function action() {
  return (await import("./actions")).generateRecallQuestionsAction;
}

describe("generateRecallQuestionsAction", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    revalidatePath.mockClear();
    track.mockClear();
    current = {
      uow: new InMemoryRecallUnitOfWork(),
      limit: { allowed: true, remaining: 4, resetAt: RESET },
      checks: 0,
      pageText: "La mitocondria produce ATP.",
      generate: async () =>
        ok({ object: { questions: questions(10) }, generation }),
      throwOnPageRead: false,
      checkFails: false,
    };
  });

  it("generates the questions, returns plain views, tracks and revalidates the recall routes", async () => {
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      created: 10,
      skipped: 0,
      remainingToday: 4,
      truncated: false,
    });
    expect(result.value.questions[0]).toEqual({
      id: expect.any(String),
      pageId: PAGE,
      prompt: "Explica la idea 1.",
      keyConcepts: ["ATP", "Concepto 1"],
      acceptableAnswerSummary: "Resumen aceptable.",
      origin: "ai",
    });
    expect(current.uow.studyItems.all()).toHaveLength(10);
    expect(current.checks).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/active-recall", "layout");
    expect(track).toHaveBeenCalledWith("generation_requested", OWNER, {
      pageId: PAGE,
      purpose: "generate_recall_questions",
      provider: "gemini-flash-lite",
      model: "gemini-3.5-flash-lite",
      status: "done",
      truncated: false,
    });
  });

  it("answers with the stored questions and reports a limiter failure after the commit", async () => {
    current.checkFails = true;
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(result.ok && result.value.created).toBe(10);
    expect(result.ok && result.value.remainingToday).toBe(3);
    expect(captureException).toHaveBeenCalledWith(new Error("redis down"));
    expect(track).toHaveBeenCalledWith(
      "generation_requested",
      OWNER,
      expect.objectContaining({ status: "done" }),
    );
  });

  it("rejects an unauthenticated caller before doing anything", async () => {
    getCurrentUser.mockResolvedValue(null);
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("RECALL_SESSION_REQUIRED");
    expect(current.checks).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it.each([
    [{ pageId: "nope" }],
    [{}],
    [null],
  ])("rejects invalid input %j", async (input) => {
    const generate = await action();

    const result = await generate(input);

    expect(!result.ok && result.error.code).toBe("RECALL_INVALID_INPUT");
    expect(current.checks).toBe(0);
  });

  it("maps the daily limit to an ActionError with resetAt and tracks limit", async () => {
    current.limit = { allowed: false, remaining: 0, resetAt: RESET };
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: AI_ERROR.DAILY_LIMIT_REACHED,
      message: "The daily generation limit was reached",
      resetAt: RESET.toISOString(),
    });
    expect(track).toHaveBeenCalledWith(
      "generation_requested",
      OWNER,
      expect.objectContaining({ status: "limit", provider: null }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps an empty page and a failed generation to their codes, storing and consuming nothing", async () => {
    const generate = await action();

    current.pageText = "   ";
    const empty = await generate({ pageId: PAGE });
    current.pageText = "Texto";
    current.generate = async () => err(new AiGenerationFailedError("g"));
    const failed = await generate({ pageId: PAGE });

    expect(!empty.ok && empty.error.code).toBe(AI_ERROR.PAGE_EMPTY);
    expect(!failed.ok && failed.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(track).toHaveBeenCalledWith(
      "generation_requested",
      OWNER,
      expect.objectContaining({ status: "empty" }),
    );
    expect(track).toHaveBeenCalledWith(
      "generation_requested",
      OWNER,
      expect.objectContaining({ status: "failed" }),
    );
    expect(current.uow.studyItems.all()).toHaveLength(0);
    expect(current.checks).toBe(0);
  });

  it("answers RECALL_NO_NEW_CONTENT for an unchanged page, consuming nothing", async () => {
    const generate = await action();
    await generate({ pageId: PAGE });
    const checks = current.checks;

    const result = await generate({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("RECALL_NO_NEW_CONTENT");
    expect(current.checks).toBe(checks);
    expect(track).toHaveBeenLastCalledWith(
      "generation_requested",
      OWNER,
      expect.objectContaining({ status: "no_new_content" }),
    );
  });

  it("still answers with the result when analytics rejects", async () => {
    track.mockRejectedValueOnce(new Error("posthog down"));
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(result.ok).toBe(true);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("never throws: an unexpected failure is reported and answered generically", async () => {
    current.throwOnPageRead = true;
    const generate = await action();

    const result = await generate({ pageId: PAGE });

    expect(!result.ok && result.error.code).toBe("RECALL_UNEXPECTED");
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
