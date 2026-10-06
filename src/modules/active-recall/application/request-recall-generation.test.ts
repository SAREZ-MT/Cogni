import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  type GenerateStructuredInput,
  type GenerationRateLimit,
  type GenerationRateLimiter,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { newRecallQuestion } from "../domain/recall-question";
import {
  RECALL_GENERATION_COUNT,
  RecallDailyLimitReachedError,
  type RequestRecallGenerationDeps,
  requestRecallGeneration,
} from "./request-recall-generation";
import { InMemoryRecallUnitOfWork } from "./testing/in-memory-recall-unit-of-work";

const OWNER = "owner-1";
const PAGE = "page-1";
const NOW = new Date("2026-10-06T10:00:00.000Z");
const RESET = new Date("2026-10-07T00:00:00.000Z");
const TEXT = "La mitocondria produce ATP. El núcleo guarda el ADN.";

class StubLimiter implements GenerationRateLimiter {
  checks = 0;
  peeks = 0;
  constructor(public remaining = 5) {}
  async check(): Promise<GenerationRateLimit> {
    this.checks += 1;
    if (this.remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt: RESET };
    }
    this.remaining -= 1;
    return { allowed: true, remaining: this.remaining, resetAt: RESET };
  }
  async peek(): Promise<GenerationRateLimit> {
    this.peeks += 1;
    return {
      allowed: this.remaining > 0,
      remaining: this.remaining,
      resetAt: RESET,
    };
  }
}

function stubPages(text: string | null): PageTextReader {
  return {
    async getPageText(pageId, ownerId) {
      if (text === null || pageId !== PAGE || ownerId !== OWNER) {
        return err(new DomainError("PAGE_NOT_FOUND", pageId));
      }
      return ok({ title: "Mitocondria", plainText: text });
    },
  };
}

function generation(id: string): AiGeneration {
  return {
    id,
    ownerId: OWNER,
    pageId: PAGE,
    purpose: "generate_recall_questions",
    provider: "gemini-flash-lite",
    model: "gemini-3.5-flash-lite",
    promptVersion: "generate_recall_questions/v1",
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rawQuestion(prompt: string, overrides: Record<string, unknown> = {}) {
  return {
    prompt,
    rubric: {
      keyConcepts: ["ATP", "respiración celular"],
      acceptableAnswerSummary: "La mitocondria produce ATP.",
    },
    ...overrides,
  };
}

function requestedCount(input: GenerateStructuredInput): number {
  return Number(/Number of questions: (\d+)/.exec(input.prompt)?.[1]);
}

// Answers with the scripted outcome; without one it returns as many
// distinct questions as the prompt asks for.
type Outcome = "fail" | unknown;
function makeAi(outcome?: Outcome) {
  const calls: GenerateStructuredInput[] = [];
  return {
    calls,
    generateStructured: async (
      input: GenerateStructuredInput,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    > => {
      calls.push(input);
      if (outcome === "fail") {
        return err(new AiGenerationFailedError("gen-failed"));
      }
      const object = outcome ?? {
        questions: Array.from({ length: requestedCount(input) }, (_, i) =>
          rawQuestion(`Explica la idea ${i + 1}.`),
        ),
      };
      return ok({ object, generation: generation("gen-1") });
    },
  };
}

let ids = 0;
function makeDeps(overrides: Partial<RequestRecallGenerationDeps> = {}) {
  const uow = new InMemoryRecallUnitOfWork();
  const limiter = new StubLimiter();
  const ai = makeAi();
  const deps: RequestRecallGenerationDeps = {
    limiter,
    pages: stubPages(TEXT),
    ai,
    questions: uow.questions,
    uow,
    clock: createFixedClock(NOW),
    ids: { next: () => `id-${++ids}` },
    tokenCap: 12000,
    ...overrides,
  };
  return { deps, uow, limiter, ai };
}

function activeQuestion(id: string, prompt: string) {
  const created = newRecallQuestion(
    {
      id,
      ownerId: OWNER,
      pageId: PAGE,
      prompt,
      rubric: { keyConcepts: ["c"], acceptableAnswerSummary: "s" },
      origin: "manual",
      generationId: null,
    },
    new Date(NOW.getTime() - 60_000),
  );
  if (!created.ok) throw created.error;
  return created.value;
}

describe("requestRecallGeneration", () => {
  beforeEach(() => {
    ids = 0;
  });

  it("generates 10 AI questions with one study item each and consumes one unit after storing", async () => {
    const { deps, uow, limiter, ai } = makeDeps();

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(RECALL_GENERATION_COUNT).toBe(10);
    expect(result.value.questions).toHaveLength(10);
    expect(result.value).toMatchObject({
      skipped: 0,
      remainingToday: 4,
      truncated: false,
      generationId: "gen-1",
      provider: "gemini-flash-lite",
      model: "gemini-3.5-flash-lite",
    });
    expect(result.value.questions[0]).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      prompt: "Explica la idea 1.",
      origin: "ai",
      generationId: "gen-1",
      rubric: {
        keyConcepts: ["ATP", "respiración celular"],
        acceptableAnswerSummary: "La mitocondria produce ATP.",
      },
    });
    // Stored in generation order, one millisecond apart.
    const stored = await uow.questions.listActiveByPage(PAGE, OWNER);
    expect(stored.map((q) => q.prompt)).toEqual(
      result.value.questions.map((q) => q.prompt),
    );
    expect(stored[1]?.createdAt.getTime()).toBe(NOW.getTime() + 1);

    const items = uow.studyItems.all();
    expect(items).toHaveLength(10);
    expect(items.every((item) => item.kind === "recall_question")).toBe(true);
    expect(new Set(items.map((item) => item.sourceId))).toEqual(
      new Set(stored.map((q) => q.id)),
    );
    expect(items[0]).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      dueAt: NOW,
    });

    expect(uow.runs).toBe(1);
    expect(limiter.checks).toBe(1);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]).toMatchObject({
      purpose: "generate_recall_questions",
      pageId: PAGE,
      promptVersion: "generate_recall_questions/v1",
    });
    expect(ai.calls[0]?.temperature).toBeLessThanOrEqual(0.7);
    expect(requestedCount(ai.calls[0] as GenerateStructuredInput)).toBe(10);
    expect(ai.calls[0]?.prompt.endsWith(`Text:\n${TEXT}`)).toBe(true);
  });

  it("lists the page's active questions in the prompt so the model avoids them", async () => {
    const { deps, uow, ai } = makeDeps();
    await uow.questions.saveMany([activeQuestion("q-old", "¿Qué es el ATP?")]);

    await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(ai.calls[0]?.prompt).toContain(
      "Existing questions:\n- ¿Qué es el ATP?",
    );
  });

  it("returns PAGE_NOT_FOUND for a missing or foreign page without touching the limit or the AI", async () => {
    const { deps, limiter, ai } = makeDeps({ pages: stubPages(null) });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    expect(limiter.peeks + limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("refuses a blank page with AI_PAGE_EMPTY before the limit and the AI", async () => {
    const { deps, limiter, ai } = makeDeps({ pages: stubPages(" \n ") });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.PAGE_EMPTY);
    expect(limiter.peeks + limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("refuses when the daily limit is spent, carrying resetAt, without calling the AI", async () => {
    const { deps, limiter, ai, uow } = makeDeps({
      limiter: new StubLimiter(0),
    });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(RecallDailyLimitReachedError);
    expect(result.error.code).toBe(AI_ERROR.DAILY_LIMIT_REACHED);
    expect((result.error as RecallDailyLimitReachedError).resetAt).toEqual(
      RESET,
    );
    expect((deps.limiter as StubLimiter).checks).toBe(0);
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
    expect(uow.runs).toBe(0);
  });

  it("stores nothing and does not consume the unit when the provider fails", async () => {
    const ai = makeAi("fail");
    const { deps, uow, limiter } = makeDeps({ ai });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(uow.runs).toBe(0);
    expect(limiter.checks).toBe(0);
    expect(limiter.remaining).toBe(5);
  });

  it("fails without storing or consuming when the output does not match the schema", async () => {
    const ai = makeAi({ questions: "nope" });
    const { deps, uow, limiter } = makeDeps({ ai });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AiGenerationFailedError);
    expect((result.error as AiGenerationFailedError).generationId).toBe(
      "gen-1",
    );
    expect(uow.runs).toBe(0);
    expect(limiter.checks).toBe(0);
  });

  it("skips invalid, duplicate and extra questions and keeps at most 10", async () => {
    const valid = Array.from({ length: 11 }, (_, i) =>
      rawQuestion(`Describe el paso ${i + 1}.`),
    );
    const ai = makeAi({
      questions: [
        rawQuestion("Explica el ciclo.", {
          rubric: { keyConcepts: [], acceptableAnswerSummary: "x" },
        }),
        rawQuestion("¿Qué es el ATP?"),
        valid[0],
        rawQuestion("  describe  el paso 1 "),
        ...valid.slice(1),
      ],
    });
    const { deps, uow } = makeDeps({ ai });
    await uow.questions.saveMany([activeQuestion("q-old", "¿Qué es el ATP?")]);

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions.map((q) => q.prompt)).toEqual(
      valid.slice(0, 10).map((q) => q.prompt),
    );
    // A rubric without key concepts (schema-valid, refused by the domain),
    // a duplicate of an active one, a duplicate of an earlier generated
    // one, and the 11th valid one. A blank prompt never gets here: the
    // output schema rejects the whole answer.
    expect(result.value.skipped).toBe(4);
    expect(uow.studyItems.all()).toHaveLength(10);
  });

  it("fails without consuming when no generated question is usable", async () => {
    const ai = makeAi({
      questions: [
        rawQuestion("Explica A.", {
          rubric: { keyConcepts: [], acceptableAnswerSummary: "x" },
        }),
      ],
    });
    const { deps, uow, limiter } = makeDeps({ ai });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(uow.runs).toBe(0);
    expect(limiter.checks).toBe(0);
  });

  it("drops questions that a concurrent writer stored during the model call", async () => {
    const ai = makeAi({
      questions: [rawQuestion("Explica A."), rawQuestion("Explica B.")],
    });
    const { deps, uow } = makeDeps({ ai });
    uow.beforeNextRun = async (questions) => {
      await questions.saveMany([activeQuestion("q-race", "explica a")]);
    };

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions.map((q) => q.prompt)).toEqual(["Explica B."]);
    expect(result.value.skipped).toBe(1);
    expect(uow.studyItems.all()).toHaveLength(1);
  });

  it("stores nothing and does not consume when every question was stored concurrently", async () => {
    const ai = makeAi({ questions: [rawQuestion("Explica A.")] });
    const { deps, uow, limiter } = makeDeps({ ai });
    uow.beforeNextRun = async (questions) => {
      await questions.saveMany([activeQuestion("q-race", "Explica A.")]);
    };

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(uow.studyItems.all()).toHaveLength(0);
    expect(limiter.checks).toBe(0);
  });

  it("rolls the questions back when a study item write fails, consuming nothing", async () => {
    const { deps, uow, limiter } = makeDeps();
    uow.studyItems.failNextSave = true;

    await expect(
      requestRecallGeneration({ pageId: PAGE }, deps, OWNER),
    ).rejects.toThrow("study item write failed");

    expect(await uow.questions.listActiveByPage(PAGE, OWNER)).toHaveLength(0);
    expect(uow.studyItems.all()).toHaveLength(0);
    expect(limiter.checks).toBe(0);
  });

  it("keeps the questions and reports 0 left when the limit ran out between the peek and the commit", async () => {
    const limiter = new StubLimiter(1);
    const { deps, uow } = makeDeps({ limiter });
    uow.beforeNextRun = async () => {
      limiter.remaining = 0;
    };

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.remainingToday).toBe(0);
    expect(uow.studyItems.all()).toHaveLength(10);
  });

  it("answers with the stored questions when consuming the unit fails after the commit", async () => {
    const limiter = new StubLimiter(3);
    const failure = new Error("redis down");
    limiter.check = async () => {
      throw failure;
    };
    const reported: unknown[] = [];
    const { deps, uow } = makeDeps({
      limiter,
      onLimiterFailure: (error) => reported.push(error),
    });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions).toHaveLength(10);
    // The unit could not be confirmed: the peeked count less this one.
    expect(result.value.remainingToday).toBe(2);
    expect(uow.studyItems.all()).toHaveLength(10);
    expect(reported).toEqual([failure]);
  });

  it("survives a limiter failure after the commit without a reporter", async () => {
    const limiter = new StubLimiter(0);
    limiter.peek = async () => ({
      allowed: true,
      remaining: 0,
      resetAt: RESET,
    });
    limiter.check = async () => {
      throw new Error("redis down");
    };
    const { deps } = makeDeps({ limiter });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.remainingToday).toBe(0);
  });

  it("truncates the page text to the token cap and reports it", async () => {
    const long = Array.from({ length: 50 }, (_, i) => `palabra${i}`).join(" ");
    const { deps, ai } = makeDeps({ pages: stubPages(long), tokenCap: 10 });

    const result = await requestRecallGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.truncated).toBe(true);
    expect(result.value.wordsTotal).toBe(50);
    expect(result.value.wordsUsed).toBeLessThan(50);
    expect(ai.calls[0]?.prompt).not.toContain("palabra49");
  });
});
