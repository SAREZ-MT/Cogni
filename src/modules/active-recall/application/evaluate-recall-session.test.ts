import { describe, expect, it } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  type GenerateStructuredInput,
  type GenerationRateLimit,
  type GenerationRateLimiter,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import type {
  RecordedRecallReviews,
  RecordRecallReviewsInput,
} from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallAnswer, skippedEvaluation } from "../domain/recall-answer";
import { newRecallSession } from "../domain/recall-session";
import {
  EVALUATION_CLAIM_LEASE_MS,
  type EvaluateRecallSessionDeps,
  evaluateRecallSession,
} from "./evaluate-recall-session";
import { InMemoryRecallSessionUnitOfWork } from "./testing/in-memory-recall-session-unit-of-work";
import {
  at,
  NOW,
  OWNER,
  PAGE,
  seedQuestions,
} from "./testing/session-fixtures";

const SESSION = "session-1";
const RESET = new Date("2026-10-08T00:00:00.000Z");
const PAGE_TEXT =
  "El núcleo guarda el ADN. La mitocondria produce ATP para la célula.";
// Evaluation time: a day after the session started.
const EVAL_AT = at(1);

class StubLimiter implements GenerationRateLimiter {
  checks = 0;
  peeks = 0;
  constructor(public remaining = 60) {}
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

// Answers containing "FALLA" fail on every provider; "EXPLOTA" throws. Any
// other answer scores 4.
class StubAi {
  calls: GenerateStructuredInput[] = [];
  async generateStructured(
    input: GenerateStructuredInput,
  ): Promise<
    Result<{ object: unknown; generation: AiGeneration }, DomainError>
  > {
    this.calls.push(input);
    const n = this.calls.length;
    if (input.prompt.includes("EXPLOTA")) throw new Error("boom");
    if (input.prompt.includes("FALLA")) {
      return err(new AiGenerationFailedError(`gen-failed-${n}`));
    }
    return ok({
      object: {
        score: 4,
        presentConcepts: ["ATP"],
        missingConcepts: [],
        misconceptions: [],
        justification: "Explicaste bien el ATP.",
      },
      generation: { id: `gen-${n}` } as AiGeneration,
    });
  }
}

class StubReviews {
  calls: RecordRecallReviewsInput[] = [];
  recorded = new Set<string>();
  failFor = new Set<string>();
  async record(
    input: RecordRecallReviewsInput,
  ): Promise<Result<RecordedRecallReviews, DomainError>> {
    this.calls.push(input);
    if (input.reviews.some((r) => this.failFor.has(r.questionId))) {
      return err(new DomainError("ITEM_NOT_FOUND", "no item"));
    }
    const reviewed: string[] = [];
    const already: string[] = [];
    for (const { questionId } of input.reviews) {
      if (this.recorded.has(questionId)) already.push(questionId);
      else {
        this.recorded.add(questionId);
        reviewed.push(questionId);
      }
    }
    return ok({
      reviewedQuestionIds: reviewed,
      skippedQuestionIds: [],
      alreadyRecordedQuestionIds: already,
      mastery: {} as RecordedRecallReviews["mastery"],
    });
  }
}

const pages: PageTextReader = {
  async getPageText(pageId, ownerId) {
    return pageId === PAGE && ownerId === OWNER
      ? ok({ title: "Célula", plainText: PAGE_TEXT })
      : err(new DomainError("PAGE_NOT_FOUND", pageId));
  },
};

interface SeedAnswer {
  questionId: string;
  text: string;
  self: number;
}

async function setup(
  answers: SeedAnswer[],
  options: { finished?: boolean; limiter?: StubLimiter } = {},
) {
  const uow = new InMemoryRecallSessionUnitOfWork();
  await seedQuestions(uow, [
    { id: "q-1" },
    { id: "q-2" },
    { id: "q-3" },
    { id: "q-4" },
  ]);
  const { questions, sessions, answers: answerRepo } = uow.repos;
  await sessions.create(
    newRecallSession({ id: SESSION, ownerId: OWNER, pageId: PAGE }, NOW),
  );
  let n = 0;
  for (const seed of answers) {
    n += 1;
    const created = newRecallAnswer(
      {
        id: `answer-${n}`,
        ownerId: OWNER,
        sessionId: SESSION,
        questionId: seed.questionId,
        answerText: seed.text,
        selfRating: seed.self,
      },
      new Date(NOW.getTime() + n),
    );
    if (!created.ok) throw created.error;
    await answerRepo.upsert(created.value);
  }
  if (options.finished !== false) {
    await sessions.finish(SESSION, OWNER, new Date(NOW.getTime() + 60_000));
  }
  const ai = new StubAi();
  const reviews = new StubReviews();
  const limiter = options.limiter ?? new StubLimiter();
  const errors: unknown[] = [];
  const deps: EvaluateRecallSessionDeps = {
    sessions,
    answers: answerRepo,
    questions,
    pages,
    ai,
    limiter,
    reviews,
    clock: createFixedClock(EVAL_AT),
    tokenCap: 12_000,
    onError: (error) => errors.push(error),
  };
  const run = (overrides: Partial<EvaluateRecallSessionDeps> = {}) =>
    evaluateRecallSession(
      { sessionId: SESSION },
      { ...deps, ...overrides },
      OWNER,
    );
  return { uow, deps, ai, reviews, limiter, errors, run };
}

async function stored(uow: InMemoryRecallSessionUnitOfWork) {
  return uow.repos.answers.listBySession(SESSION, OWNER);
}

describe("evaluateRecallSession", () => {
  it("evaluates each written answer once with the rubric, the page fragment and the answer", async () => {
    const { uow, ai, limiter, run } = await setup([
      { questionId: "q-1", text: "Produce ATP.", self: 3 },
    ]);

    const result = await run();

    expect(result.ok && result.value).toMatchObject({
      evaluated: 1,
      failed: 0,
      session: { evaluationStatus: "done" },
    });
    expect(ai.calls).toHaveLength(1);
    const [call] = ai.calls;
    expect(call).toMatchObject({
      purpose: "evaluate_recall_answer",
      pageId: PAGE,
      promptVersion: "evaluate_recall_answer/v1",
    });
    expect(call?.temperature).toBeLessThanOrEqual(0.3);
    expect(call?.prompt).toContain("Question: ¿Pregunta q-1?");
    expect(call?.prompt).toContain("Key concepts:\n- ATP");
    expect(call?.prompt).toContain(`<page_fragment>\n${PAGE_TEXT}\n`);
    expect(call?.prompt).toContain("<student_answer>\nProduce ATP.\n");

    const [answer] = await stored(uow);
    expect(answer).toMatchObject({
      evaluationStatus: "done",
      aiScore: 4,
      // round(0.6 · 4 + 0.4 · 3) = round(3.6)
      combinedQuality: 4,
      generationId: "gen-1",
      aiEvaluation: {
        score: 4,
        presentConcepts: ["ATP"],
        missingConcepts: [],
        misconceptions: [],
        justification: "Explicaste bien el ATP.",
      },
    });
    // One unit of AI_DAILY_EVALUATIONS per model evaluation.
    expect(limiter.checks).toBe(1);
  });

  it("stores the skipped record for a skipped answer without the model or the limiter", async () => {
    const { uow, ai, limiter, run } = await setup([
      { questionId: "q-1", text: "", self: 0 },
      { questionId: "q-2", text: "(sin respuesta)", self: 5 },
    ]);

    await run();

    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
    const answers = await stored(uow);
    expect(answers.map((a) => [a.evaluationStatus, a.aiScore])).toEqual([
      ["done", 0],
      ["done", 0],
    ]);
    expect(answers.map((a) => a.combinedQuality)).toEqual([0, 2]);
    expect(answers[0]?.aiEvaluation).toEqual(skippedEvaluation());
    expect(answers[0]?.generationId).toBeNull();
  });

  it("keeps the failed attempt of an answer every provider failed and marks the session partial", async () => {
    const { uow, reviews, limiter, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 4 },
      { questionId: "q-2", text: "FALLA", self: 4 },
    ]);

    const result = await run();

    expect(result.ok && result.value).toMatchObject({
      evaluated: 1,
      failed: 1,
      session: { evaluationStatus: "partial" },
    });
    const failed = (await stored(uow))[1];
    expect(failed).toMatchObject({
      evaluationStatus: "failed",
      aiScore: null,
      combinedQuality: null,
      generationId: "gen-failed-2",
      aiEvaluation: {
        source: "failed",
        code: AI_ERROR.GENERATION_FAILED,
        generationId: "gen-failed-2",
      },
    });
    // A failed evaluation consumes no unit and records no review.
    expect(limiter.checks).toBe(1);
    expect(reviews.calls.flatMap((c) => c.reviews)).toEqual([
      { questionId: "q-1", quality: 4 },
    ]);
  });

  it("records the SM-2 reviews of the done answers with their combined quality", async () => {
    const { reviews, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 1 },
      { questionId: "q-2", text: "", self: 0 },
    ]);

    await run();

    expect(reviews.calls).toEqual([
      {
        ownerId: OWNER,
        sessionId: SESSION,
        pageId: PAGE,
        // round(0.6 · 4 + 0.4 · 1) = 3; the skipped answer: 0.
        reviews: [
          { questionId: "q-1", quality: 3 },
          { questionId: "q-2", quality: 0 },
        ],
        now: EVAL_AT,
      },
    ]);
  });

  it("fails the model answers without calling the model once the daily evaluation limit is reached", async () => {
    const { uow, ai, reviews, run } = await setup(
      [
        { questionId: "q-1", text: "ATP", self: 3 },
        { questionId: "q-2", text: "", self: 0 },
        { questionId: "q-3", text: "Núcleo", self: 3 },
      ],
      { limiter: new StubLimiter(0) },
    );

    const result = await run();

    expect(ai.calls).toHaveLength(0);
    expect(result.ok && result.value.session.evaluationStatus).toBe("partial");
    const answers = await stored(uow);
    expect(answers.map((a) => a.evaluationStatus)).toEqual([
      "failed",
      "done",
      "failed",
    ]);
    expect(answers[0]?.aiEvaluation).toEqual({
      source: "failed",
      code: AI_ERROR.DAILY_LIMIT_REACHED,
      generationId: null,
      resetAt: RESET.toISOString(),
    });
    expect(reviews.calls.flatMap((c) => c.reviews)).toEqual([
      { questionId: "q-2", quality: 0 },
    ]);
  });

  it("is idempotent: a second run evaluates nothing again", async () => {
    const { uow, ai, limiter, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    await run();
    const before = await stored(uow);

    const again = await run();

    expect(again.ok && again.value).toMatchObject({
      evaluated: 0,
      failed: 0,
      session: { evaluationStatus: "done" },
    });
    expect(ai.calls).toHaveLength(1);
    expect(limiter.checks).toBe(1);
    expect(await stored(uow)).toEqual(before);
  });

  it("leaves answers another live run claimed to that run", async () => {
    const { uow, ai, reviews, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    const claimedAt = new Date(EVAL_AT.getTime() - 1_000);
    await uow.repos.answers.claimPendingForEvaluation(
      SESSION,
      OWNER,
      claimedAt,
      claimedAt,
    );

    const result = await run();

    expect(result.ok && result.value).toMatchObject({
      evaluated: 0,
      session: { evaluationStatus: "pending" },
    });
    expect(ai.calls).toHaveLength(0);
    expect(reviews.calls).toHaveLength(0);
  });

  it("takes over answers whose claim is older than the lease (the run died)", async () => {
    const { uow, ai, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    const claimedAt = new Date(
      EVAL_AT.getTime() - EVALUATION_CLAIM_LEASE_MS - 1,
    );
    await uow.repos.answers.claimPendingForEvaluation(
      SESSION,
      OWNER,
      claimedAt,
      claimedAt,
    );

    await run();

    expect(ai.calls).toHaveLength(1);
    expect((await stored(uow))[0]?.evaluationStatus).toBe("done");
  });

  it("re-evaluates only the requeued failed answers (Reintentar)", async () => {
    const { uow, ai, reviews, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
      { questionId: "q-2", text: "FALLA", self: 3 },
    ]);
    await run();
    // The provider is back: the same answer now succeeds.
    const original = ai.generateStructured.bind(ai);
    ai.generateStructured = (input) =>
      original({ ...input, prompt: input.prompt.replace("FALLA", "ATP") });
    await uow.repos.answers.requeueFailed(SESSION, OWNER, EVAL_AT);

    const retried = await run();

    expect(retried.ok && retried.value).toMatchObject({
      evaluated: 1,
      failed: 0,
      session: { evaluationStatus: "done" },
    });
    expect(ai.calls).toHaveLength(3);
    expect((await stored(uow)).map((a) => a.evaluationStatus)).toEqual([
      "done",
      "done",
    ]);
    // q-1 was recorded on the first run and is reported back, not twice.
    expect([...reviews.recorded]).toEqual(["q-1", "q-2"]);
  });

  it("leaves an open session alone", async () => {
    const { uow, ai, run } = await setup(
      [{ questionId: "q-1", text: "ATP", self: 3 }],
      { finished: false },
    );

    const result = await run();

    expect(result.ok && result.value.evaluated).toBe(0);
    expect(ai.calls).toHaveLength(0);
    expect((await stored(uow))[0]?.evaluationStatus).toBe("pending");
  });

  it("refuses an unknown or another owner's session", async () => {
    const { deps } = await setup([]);

    const missing = await evaluateRecallSession(
      { sessionId: "session-ghost" },
      deps,
      OWNER,
    );
    const foreign = await evaluateRecallSession(
      { sessionId: SESSION },
      deps,
      "owner-2",
    );

    for (const result of [missing, foreign]) {
      expect(!result.ok && result.error.code).toBe(
        RECALL_ERROR.SESSION_NOT_FOUND,
      );
    }
  });

  it("fails one answer whose evaluation throws, reports it and evaluates the rest", async () => {
    const { uow, errors, run } = await setup([
      { questionId: "q-1", text: "EXPLOTA", self: 3 },
      { questionId: "q-2", text: "ATP", self: 3 },
    ]);

    const result = await run();

    expect(result.ok && result.value.session.evaluationStatus).toBe("partial");
    const answers = await stored(uow);
    expect(answers[0]).toMatchObject({
      evaluationStatus: "failed",
      aiEvaluation: {
        source: "failed",
        code: RECALL_ERROR.UNEXPECTED,
        generationId: null,
      },
    });
    expect(answers[1]?.evaluationStatus).toBe("done");
    expect(errors).toHaveLength(1);
  });

  it("fails an answer whose question is gone without calling the model", async () => {
    const { uow, ai, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    const listByIds = uow.repos.questions.listByIds.bind(uow.repos.questions);
    const questions = {
      listByIds: async (ids: readonly string[], ownerId: string) =>
        (await listByIds(ids, ownerId)).filter((q) => q.id !== "q-1"),
    };

    await run({ questions });

    expect(ai.calls).toHaveLength(0);
    expect((await stored(uow))[0]?.aiEvaluation).toMatchObject({
      source: "failed",
      code: RECALL_ERROR.QUESTION_NOT_IN_SESSION,
    });
  });

  it("records the reviews one by one when the batch is refused, reporting the refused one", async () => {
    const { reviews, errors, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
      { questionId: "q-2", text: "ATP", self: 3 },
    ]);
    reviews.failFor.add("q-1");

    const result = await run();

    expect(result.ok && result.value.session.evaluationStatus).toBe("done");
    expect(reviews.calls.map((c) => c.reviews.length)).toEqual([2, 1, 1]);
    expect([...reviews.recorded]).toEqual(["q-2"]);
    expect(errors).toHaveLength(1);
  });

  it("reports a review recorder that throws and still stores the session status", async () => {
    const { errors, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    const reviews = {
      record: async () => {
        throw new Error("db down");
      },
    };

    const result = await run({ reviews });

    expect(result.ok && result.value.session.evaluationStatus).toBe("done");
    expect(errors).toHaveLength(1);
  });

  it("still evaluates with an empty fragment when the page cannot be read", async () => {
    const { ai, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);
    const broken: PageTextReader = {
      getPageText: async () => err(new DomainError("PAGE_NOT_FOUND", "gone")),
    };

    await run({ pages: broken });

    expect(ai.calls[0]?.prompt).toContain(
      "<page_fragment>\n(none)\n</page_fragment>",
    );
  });

  it("sends only the page fragment closest to the question when the page exceeds the cap", async () => {
    const { ai, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);

    // 10 tokens → 7 words: only the sentence about ATP fits.
    await run({ tokenCap: 10 });

    expect(ai.calls[0]?.prompt).toContain(
      "<page_fragment>\nLa mitocondria produce ATP para la célula.\n</page_fragment>",
    );
  });

  it("evaluates with no fragment when the configured cap is not a number", async () => {
    const { ai, run } = await setup([
      { questionId: "q-1", text: "ATP", self: 3 },
    ]);

    await run({ tokenCap: Number.NaN });

    expect(ai.calls[0]?.prompt).toContain(
      "<page_fragment>\n(none)\n</page_fragment>",
    );
  });

  it("answers what is left when consuming the unit fails after a done evaluation", async () => {
    const limiter = new StubLimiter();
    limiter.check = async () => {
      throw new Error("redis down");
    };
    const { uow, errors, run } = await setup(
      [{ questionId: "q-1", text: "ATP", self: 3 }],
      { limiter },
    );

    await run();

    expect((await stored(uow))[0]?.evaluationStatus).toBe("done");
    expect(errors).toHaveLength(1);
  });
});
