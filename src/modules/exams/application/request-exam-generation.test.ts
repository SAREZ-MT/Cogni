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
import { EXAM_ERROR } from "../domain/errors";
import {
  EXAM_GENERATION_BATCH_SIZE,
  ExamDailyLimitReachedError,
  type RequestExamGenerationDeps,
  requestExamGeneration,
  splitIntoBatches,
} from "./request-exam-generation";
import { CONTENT, NOW, OWNER, PAGE, question } from "./testing/fixtures";
import { InMemoryExamUnitOfWork } from "./testing/in-memory-exam-unit-of-work";

const RESET = new Date("2026-10-06T00:00:00.000Z");
const TEXT = "La mitocondria produce ATP. El núcleo guarda el ADN.";

class StubLimiter implements GenerationRateLimiter {
  checks = 0;
  constructor(private remaining = 5) {}
  async check(): Promise<GenerationRateLimit> {
    this.checks += 1;
    if (this.remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt: RESET };
    }
    this.remaining -= 1;
    return { allowed: true, remaining: this.remaining, resetAt: RESET };
  }
  async peek(): Promise<GenerationRateLimit> {
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
    purpose: "generate_exam_questions",
    provider: "gemini-flash-lite",
    model: "gemini-3.5-flash-lite",
    promptVersion: "generate_exam_questions/v1",
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rawQuestion(stem: string, overrides: Record<string, unknown> = {}) {
  return {
    stem,
    options: ["Opción A", "Opción B", "Opción C", "Opción D"],
    correctIndex: 1,
    explanation: "Porque el texto lo dice.",
    concept: `Concepto ${stem}`,
    ...overrides,
  };
}

function requestedCount(input: GenerateStructuredInput): number {
  return Number(/Number of questions: (\d+)/.exec(input.prompt)?.[1]);
}

// Each call answers with the next scripted outcome; past the script it
// returns as many distinct questions as the prompt asks for.
type Outcome = "fail" | { questions: unknown[] } | unknown;
function makeAi(script: Outcome[] = []) {
  const calls: GenerateStructuredInput[] = [];
  return {
    calls,
    generateStructured: async (
      input: GenerateStructuredInput,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    > => {
      calls.push(input);
      const n = calls.length;
      const outcome = script[n - 1];
      if (outcome === "fail") {
        return err(new AiGenerationFailedError(`gen-failed-${n}`));
      }
      const object =
        outcome ??
        ({
          questions: Array.from({ length: requestedCount(input) }, (_, i) =>
            rawQuestion(`¿Pregunta ${n}.${i + 1}?`),
          ),
        } as const);
      return ok({ object, generation: generation(`gen-${n}`) });
    },
  };
}

let ids = 0;
function makeDeps(overrides: Partial<RequestExamGenerationDeps> = {}) {
  const uow = new InMemoryExamUnitOfWork();
  const limiter = new StubLimiter();
  const ai = makeAi();
  const deps: RequestExamGenerationDeps = {
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

async function stored(uow: InMemoryExamUnitOfWork) {
  return uow.questions.listActiveByPage(PAGE, OWNER);
}

describe("splitIntoBatches", () => {
  it.each([
    [10, [10]],
    [15, [15]],
    [16, [8, 8]],
    [25, [13, 12]],
    [30, [15, 15]],
  ])("splits %i questions into calls of at most 15: %j", (count, batches) => {
    expect(splitIntoBatches(count, EXAM_GENERATION_BATCH_SIZE)).toEqual(
      batches,
    );
  });
});

describe("requestExamGeneration", () => {
  beforeEach(() => {
    ids = 0;
  });

  it("generates the default 10 AI roots, each with its study item, in one call and one unit", async () => {
    const { deps, uow, limiter, ai } = makeDeps();

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions).toHaveLength(10);
    expect(result.value.skipped).toBe(0);
    expect(result.value.remainingToday).toBe(4);
    expect(result.value).toMatchObject({
      truncated: false,
      provider: "gemini-flash-lite",
      model: "gemini-3.5-flash-lite",
      generationIds: ["gen-1"],
    });
    expect(limiter.checks).toBe(1);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]).toMatchObject({
      purpose: "generate_exam_questions",
      pageId: PAGE,
      promptVersion: "generate_exam_questions/v1",
    });
    expect(ai.calls[0]?.prompt).toContain("Number of questions: 10");
    expect(ai.calls[0]?.prompt).toContain(TEXT);

    const saved = await stored(uow);
    expect(saved).toHaveLength(10);
    for (const q of saved) {
      expect(q).toMatchObject({
        origin: "ai",
        generationId: "gen-1",
        variantOf: null,
        retiredAt: null,
      });
      expect(q.rootId).toBe(q.id);
    }
    expect(
      uow.studyItems
        .all()
        .map((item) => item.sourceId)
        .sort(),
    ).toEqual(saved.map((q) => q.rootId).sort());
    expect(uow.studyItems.all()[0]).toMatchObject({
      kind: "exam_question",
      pageId: PAGE,
      ownerId: OWNER,
      dueAt: NOW,
    });
    expect(uow.runs).toBe(1);
  });

  it("keeps the generation order when the page lists its questions", async () => {
    const { deps, uow } = makeDeps();
    // Ids that sort against the generation order.
    let n = 100;
    deps.ids = { next: () => `id-${n--}` };

    await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect((await stored(uow)).map((q) => q.stem)).toEqual(
      Array.from({ length: 10 }, (_, i) => `¿Pregunta 1.${i + 1}?`),
    );
  });

  it("lists the page's active questions in the prompt", async () => {
    const { deps, uow, ai } = makeDeps();
    await uow.questions.save(question("q-old"));

    await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(ai.calls[0]?.prompt).toContain(
      `- [${CONTENT.concept}] ${CONTENT.stem}`,
    );
  });

  it.each([
    9, 31, 10.5,
  ])("refuses a count of %s before reading the page or consuming a unit", async (count) => {
    const { deps, limiter, ai } = makeDeps();

    const result = await requestExamGeneration(
      { pageId: PAGE, count },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      EXAM_ERROR.INVALID_QUESTION_COUNT,
    );
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("refuses a missing or foreign page without consuming a unit", async () => {
    const { deps, limiter } = makeDeps({ pages: stubPages(null) });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    expect(limiter.checks).toBe(0);
  });

  it("refuses an empty page without consuming a unit", async () => {
    const { deps, limiter, ai } = makeDeps({ pages: stubPages("  \n ") });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.PAGE_EMPTY);
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("refuses when the daily limit is reached, with the reset instant, and calls no model", async () => {
    const { deps, ai } = makeDeps({ limiter: new StubLimiter(0) });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(ExamDailyLimitReachedError);
    expect(result.error.code).toBe(AI_ERROR.DAILY_LIMIT_REACHED);
    expect((result.error as ExamDailyLimitReachedError).resetAt).toEqual(RESET);
    expect(ai.calls).toHaveLength(0);
  });

  it("stores nothing when the provider fails (the unit stays consumed, as in flashcards)", async () => {
    const ai = makeAi(["fail"]);
    const { deps, uow, limiter } = makeDeps({ ai });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(limiter.checks).toBe(1);
    expect(await stored(uow)).toHaveLength(0);
    expect(uow.studyItems.all()).toHaveLength(0);
    expect(uow.runs).toBe(0);
  });

  it("fails as a generation failure when the object does not fit the schema", async () => {
    const ai = makeAi([{ cards: [] }]);
    const { deps, uow } = makeDeps({ ai });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AiGenerationFailedError);
    expect((result.error as AiGenerationFailedError).generationId).toBe(
      "gen-1",
    );
    expect(await stored(uow)).toHaveLength(0);
  });

  it("skips invalid questions and duplicates of active or same-batch stems", async () => {
    const ai = makeAi([
      {
        questions: [
          rawQuestion("¿Qué produce la mitocondria?"),
          rawQuestion("¿Pregunta válida?"),
          rawQuestion("  pregunta VÁLIDA "),
          rawQuestion("¿Opciones repetidas?", {
            options: ["Igual", "igual.", "Otra", "Más"],
          }),
          rawQuestion("¿Concepto largo?", { concept: "x".repeat(121) }),
          rawQuestion("¿Otra válida?"),
        ],
      },
    ]);
    const { deps, uow } = makeDeps({ ai });
    await uow.questions.save(question("q-old"));

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions.map((q) => q.stem)).toEqual([
      "¿Pregunta válida?",
      "¿Otra válida?",
    ]);
    expect(result.value.skipped).toBe(4);
    expect(await stored(uow)).toHaveLength(3);
    expect(uow.studyItems.all()).toHaveLength(2);
  });

  it("keeps at most the requested number of questions per call", async () => {
    const ai = makeAi([
      {
        questions: Array.from({ length: 12 }, (_, i) =>
          rawQuestion(`¿Extra ${i}?`),
        ),
      },
    ]);
    const { deps, uow } = makeDeps({ ai });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions).toHaveLength(10);
    expect(result.ok && result.value.skipped).toBe(2);
    expect(await stored(uow)).toHaveLength(10);
  });

  it("fails without storing anything when no generated question is usable", async () => {
    const ai = makeAi([
      { questions: [rawQuestion("¿Qué produce la mitocondria?")] },
    ]);
    const { deps, uow } = makeDeps({ ai });
    await uow.questions.save(question("q-old"));

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(await stored(uow)).toHaveLength(1);
    expect(uow.studyItems.all()).toHaveLength(0);
  });

  it("splits 30 questions into two calls, telling the second about the first's stems, under one unit", async () => {
    const { deps, uow, limiter, ai } = makeDeps();

    const result = await requestExamGeneration(
      { pageId: PAGE, count: 30 },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(limiter.checks).toBe(1);
    expect(ai.calls.map(requestedCount)).toEqual([15, 15]);
    expect(ai.calls[1]?.prompt).toContain("¿Pregunta 1.15?");
    expect(result.value.questions).toHaveLength(30);
    expect(result.value.generationIds).toEqual(["gen-1", "gen-2"]);
    const saved = await stored(uow);
    expect(saved).toHaveLength(30);
    expect(saved.filter((q) => q.generationId === "gen-2")).toHaveLength(15);
    expect(uow.studyItems.all()).toHaveLength(30);
    expect(uow.runs).toBe(1);
  });

  it("stores nothing when a later call of the same request fails", async () => {
    const ai = makeAi([undefined, "fail"]);
    const { deps, uow } = makeDeps({ ai });

    const result = await requestExamGeneration(
      { pageId: PAGE, count: 20 },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(ai.calls).toHaveLength(2);
    expect(await stored(uow)).toHaveLength(0);
    expect(uow.studyItems.all()).toHaveLength(0);
  });

  it("rolls every question back when a study item write fails", async () => {
    const { deps, uow } = makeDeps();
    uow.studyItems.failNextSave = true;

    await expect(
      requestExamGeneration({ pageId: PAGE }, deps, OWNER),
    ).rejects.toThrow("study item write failed");

    expect(await stored(uow)).toHaveLength(0);
    expect(uow.studyItems.all()).toHaveLength(0);
  });

  it("drops a question that a concurrent change stored meanwhile", async () => {
    const { deps, uow } = makeDeps();
    const original = deps.ai.generateStructured;
    deps.ai = {
      generateStructured: async (input, ownerId) => {
        const result = await original(input, ownerId);
        // A manual question with the same stem lands during the AI call.
        await uow.questions.save(
          question("q-manual", { stem: "¿Pregunta 1.1?" }),
        );
        return result;
      },
    };

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions).toHaveLength(9);
    expect(result.ok && result.value.skipped).toBe(1);
  });

  it("sends only the text within the token cap and reports the truncation", async () => {
    const long = Array.from({ length: 50 }, (_, i) => `palabra${i}`).join(" ");
    const { deps, ai } = makeDeps({ pages: stubPages(long), tokenCap: 20 });

    const result = await requestExamGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.truncated).toBe(true);
    expect(ai.calls[0]?.prompt).not.toContain("palabra49");
  });
});
