import { describe, expect, it } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  type GenerateStructuredInput,
  type GenerationRateLimit,
  type GenerationRateLimiter,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import { type ExamQuestion, newVariant } from "../domain/exam-question";
import { finishExamSession, newExamSession } from "../domain/exam-session";
import { answerExamQuestion } from "./answer-exam-question";
import { completeExamSession } from "./complete-exam-session";
import {
  type ClearedExamRetake,
  type StartExamRetakeDeps,
  type StartedExamRetake,
  startExamRetake,
} from "./start-exam-retake";
import { startExamSession } from "./start-exam-session";
import {
  LATER,
  NOW,
  OWNER,
  PAGE,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

const RESET = new Date("2026-10-07T00:00:00.000Z");
const RETAKE_AT = new Date("2026-10-07T10:00:00.000Z");
const FAILED_SESSION = "failed-session";

class StubLimiter implements GenerationRateLimiter {
  checks = 0;
  peeks = 0;
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
    this.peeks += 1;
    return {
      allowed: this.remaining > 0,
      remaining: this.remaining,
      resetAt: RESET,
    };
  }
}

const pages: PageTextReader = {
  async getPageText(pageId, ownerId) {
    if (pageId !== PAGE || ownerId !== OWNER) {
      return err(new DomainError("PAGE_NOT_FOUND", pageId));
    }
    return ok({
      title: "Mitocondria",
      plainText: "La mitocondria produce ATP.",
    });
  },
};

function generation(id: string): AiGeneration {
  return {
    id,
    ownerId: OWNER,
    pageId: PAGE,
    purpose: "generate_exam_variants",
    provider: "gemini-flash-lite",
    model: "gemini-3.5-flash-lite",
    promptVersion: "generate_exam_variants/v1",
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// The roots listed by the variants prompt ("Root <id> [<concept>]").
function promptRoots(prompt: string): string[] {
  return [...prompt.matchAll(/^Root (\S+) \[/gm)].map((m) => m[1] as string);
}

type Respond = (
  rootIds: string[],
  call: number,
) => Result<unknown, DomainError>;

// One fresh wording per listed root, unless `respond` says otherwise.
const freshVariants: Respond = (rootIds, call) =>
  ok({
    variants: rootIds.map((rootId) => ({
      forRootId: rootId,
      stem: `¿Reformulación ${call} de ${rootId}?`,
      options: ["Energía", "ADN", "Lípidos", "Almidón"],
      correctIndex: 0,
      explanation: "Produce energía.",
    })),
  });

class StubAi {
  readonly calls: GenerateStructuredInput[] = [];
  constructor(public respond: Respond = freshVariants) {}
  async generateStructured(input: GenerateStructuredInput) {
    this.calls.push(input);
    const object = this.respond(promptRoots(input.prompt), this.calls.length);
    if (!object.ok) return object;
    return ok({
      object: object.value,
      generation: generation(`gen-${this.calls.length}`),
    });
  }
}

function setup(
  options: { remaining?: number; respond?: Respond; now?: Date } = {},
) {
  const uow = new InMemoryExamSessionUnitOfWork();
  const limiter = new StubLimiter(options.remaining ?? 5);
  const ai = new StubAi(options.respond);
  let n = 0;
  const deps: StartExamRetakeDeps = {
    pages,
    limiter,
    ai,
    uow,
    clock: createFixedClock(options.now ?? RETAKE_AT),
    ids: {
      // Valid-looking but deterministic ids, ordered by creation.
      next: () => `new-${String(++n).padStart(3, "0")}`,
    },
    tokenCap: 12_000,
  };
  return { uow, limiter, ai, deps };
}

// A finished, failed exam of the first `asked` seeded questions whose
// first `failed` roots were answered wrong, and the page state it left.
async function seedFailedExam(
  uow: InMemoryExamSessionUnitOfWork,
  options: { seeded?: number; asked?: number; failed?: number } = {},
): Promise<ExamQuestion[]> {
  const questions = await seedSessionQuestions(uow, options.seeded ?? 12);
  const asked = questions.slice(0, options.asked ?? 10);
  const failedCount = options.failed ?? 4;
  const session = newExamSession(
    {
      id: FAILED_SESSION,
      ownerId: OWNER,
      pageId: PAGE,
      requestedCount: Math.max(10, asked.length),
      retakeOfSessionId: null,
      questionIds: asked.map((q) => q.id),
    },
    NOW,
  );
  if (!session.ok) throw session.error;
  await uow.repos.sessions.create(session.value);
  const answers = asked.map((q, i) => ({
    sessionId: FAILED_SESSION,
    questionId: q.id,
    rootId: q.rootId,
    selectedIndex: i < failedCount ? 1 : 0,
    isCorrect: i >= failedCount,
    answeredAt: NOW,
  }));
  await uow.repos.answers.saveMany(answers, OWNER);
  const finished = finishExamSession(session.value, answers, LATER);
  if (!finished.ok) throw finished.error;
  await uow.repos.sessions.finish(finished.value);
  await uow.repos.pageStates.upsert({
    pageId: PAGE,
    ownerId: OWNER,
    retakePending: true,
    failedRootIds: asked.slice(0, failedCount).map((q) => q.rootId),
    lastPassedSessionId: null,
  });
  return questions;
}

async function storedState(uow: InMemoryExamSessionUnitOfWork) {
  return {
    questions: uow.repos.questions.snapshot(),
    sessions: uow.repos.sessions.snapshot(),
  };
}

// The started retake of an ok result (not a cleared one).
function startedOf(
  result: Result<StartedExamRetake | ClearedExamRetake, DomainError>,
): StartedExamRetake {
  if (!result.ok) throw result.error;
  if (result.value.kind !== "started") throw new Error("retake was cleared");
  return result.value;
}

function expectError(result: Result<unknown, DomainError>, code: string) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
}

describe("startExamRetake", () => {
  it("refuses a page without a pending retake, before any AI call", async () => {
    const { uow, ai, limiter, deps } = setup();
    await seedSessionQuestions(uow, 12);
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(result, EXAM_ERROR.NO_RETAKE_PENDING);
    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
  });

  it("refuses another owner's page", async () => {
    const { uow, deps } = setup();
    await seedFailedExam(uow);
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      "someone-else",
    );
    expectError(result, "PAGE_NOT_FOUND");
  });

  it("refuses N below the number of failed roots or outside 10 to 30, before any AI call", async () => {
    const { uow, ai, deps } = setup();
    await seedFailedExam(uow, { seeded: 14, asked: 14, failed: 11 });
    for (const requestedCount of [10, 9, 31]) {
      const result = await startExamRetake(
        { pageId: PAGE, requestedCount },
        deps,
        OWNER,
      );
      expectError(result, EXAM_ERROR.INVALID_QUESTION_COUNT);
    }
    expect(ai.calls).toHaveLength(0);
  });

  it("stores the reformulated variants, retires the failed wordings and starts the retake with the variants first", async () => {
    const { uow, ai, limiter, deps } = setup();
    const seeded = await seedFailedExam(uow, { failed: 4 });
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    const started = startedOf(result);
    const { session } = started;
    expect(started.resumed).toBe(false);
    expect(started.remainingToday).toBe(4);
    expect(session).toMatchObject({
      pageId: PAGE,
      requestedCount: 10,
      isRetake: true,
      retakeOfSessionId: FAILED_SESSION,
      startedAt: RETAKE_AT,
      finishedAt: null,
    });
    expect(session.questionIds).toHaveLength(10);

    // One AI call, one unit consumed after success.
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]?.purpose).toBe("generate_exam_variants");
    expect(ai.calls[0]?.promptVersion).toBe("generate_exam_variants/v1");
    expect(limiter.checks).toBe(1);

    const failed = seeded.slice(0, 4);
    const variants = await uow.repos.questions.listByIds(
      session.questionIds.slice(0, 4),
      OWNER,
    );
    const byId = new Map(variants.map((v) => [v.id, v]));
    session.questionIds.slice(0, 4).forEach((id, i) => {
      const previous = failed[i] as ExamQuestion;
      expect(byId.get(id)).toMatchObject({
        origin: "ai_variant",
        rootId: previous.rootId,
        variantOf: previous.id,
        concept: previous.concept,
        generationId: "gen-1",
        retiredAt: null,
      });
      expect(byId.get(id)?.stem).not.toBe(previous.stem);
    });
    for (const previous of failed) {
      const stored = await uow.repos.questions.findById(previous.id, OWNER);
      expect(stored?.retiredAt).toEqual(RETAKE_AT);
      expect(session.questionIds).not.toContain(previous.id);
    }
    // The rest of the page follows: none of the failed roots again.
    const rest = await uow.repos.questions.listByIds(
      session.questionIds.slice(4),
      OWNER,
    );
    expect(rest.map((q) => q.rootId)).not.toEqual(
      expect.arrayContaining([failed[0]?.rootId]),
    );
    expect(new Set(rest.map((q) => q.rootId)).size).toBe(6);
    // Every failed lineage was locked, in id order.
    expect(uow.repos.questions.lockedLineages).toEqual(
      failed.map((q) => q.rootId).sort(),
    );
  });

  it("sends every earlier wording of each failed root to the model", async () => {
    const { uow, ai, deps } = setup();
    const seeded = await seedFailedExam(uow, { failed: 4 });
    await startExamRetake({ pageId: PAGE, requestedCount: 10 }, deps, OWNER);
    const prompt = ai.calls[0]?.prompt ?? "";
    for (const q of seeded.slice(0, 4)) {
      expect(prompt).toContain(`Root ${q.rootId} [${q.concept}]`);
      expect(prompt).toContain(`Previous wording: ${q.stem}`);
    }
    expect(prompt).not.toContain(`Root ${seeded[4]?.rootId}`);
  });

  it("resumes the page's open retake without another AI call", async () => {
    const { uow, ai, limiter, deps } = setup();
    await seedFailedExam(uow, { failed: 4 });
    const first = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    const again = startedOf(
      await startExamRetake({ pageId: PAGE, requestedCount: 12 }, deps, OWNER),
    );
    expect(again.resumed).toBe(true);
    expect(again.session).toEqual(startedOf(first).session);
    expect(ai.calls).toHaveLength(1);
    expect(limiter.checks).toBe(1);
  });

  it("refuses when the daily limit is exhausted, without calling the AI or storing anything", async () => {
    const { uow, ai, limiter, deps } = setup({ remaining: 0 });
    await seedFailedExam(uow);
    const before = await storedState(uow);
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(result, AI_ERROR.DAILY_LIMIT_REACHED);
    expect(ai.calls).toHaveLength(0);
    expect(limiter.checks).toBe(0);
    expect(await storedState(uow)).toEqual(before);
  });

  it("blocks the retake when every provider fails: nothing stored and no unit consumed", async () => {
    const { uow, limiter, deps } = setup({
      respond: () =>
        err(new DomainError(AI_ERROR.GENERATION_FAILED, "all failed")),
    });
    await seedFailedExam(uow);
    const before = await storedState(uow);
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(result, EXAM_ERROR.RETAKE_VARIANT_MISSING);
    expect(limiter.checks).toBe(0);
    expect(await storedState(uow)).toEqual(before);
  });

  it("blocks the retake when a failed root gets no variant or a repeated wording", async () => {
    const cases: Respond[] = [
      // A root left out.
      (rootIds, call) => {
        const answer = freshVariants(rootIds.slice(1), call);
        return answer;
      },
      // The previous wording again, with other punctuation and case.
      (rootIds, call) =>
        ok({
          variants: rootIds.map((rootId, i) => ({
            forRootId: rootId,
            stem:
              i === 0
                ? `pregunta ${rootId}.`
                : `¿Reformulación ${call} de ${rootId}?`,
            options: ["Energía", "ADN", "Lípidos", "Almidón"],
            correctIndex: 0,
            explanation: "Produce energía.",
          })),
        }),
      // Not the variants schema.
      () => ok({ questions: [] }),
    ];
    for (const respond of cases) {
      const { uow, limiter, deps } = setup({ respond });
      await seedFailedExam(uow);
      const before = await storedState(uow);
      const result = await startExamRetake(
        { pageId: PAGE, requestedCount: 10 },
        deps,
        OWNER,
      );
      expectError(result, EXAM_ERROR.RETAKE_VARIANT_MISSING);
      expect(limiter.checks).toBe(0);
      expect(await storedState(uow)).toEqual(before);
    }
  });

  it("splits more than 15 failed roots into calls of at most 15 and still consumes one unit", async () => {
    const { uow, ai, limiter, deps } = setup();
    await seedFailedExam(uow, { seeded: 20, asked: 20, failed: 16 });
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 20 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(true);
    expect(ai.calls.map((c) => promptRoots(c.prompt).length)).toEqual([8, 8]);
    expect(limiter.checks).toBe(1);
  });

  it("reuses unshown variants that already exist for every failed root, without an AI call", async () => {
    const { uow, ai, limiter, deps } = setup();
    const seeded = await seedFailedExam(uow, { failed: 4 });
    const variantIds: string[] = [];
    for (const previous of seeded.slice(0, 4)) {
      const lineage = await uow.repos.questions.listLineage(
        previous.rootId,
        OWNER,
      );
      const variant = newVariant(
        previous,
        lineage,
        {
          id: `pre-${previous.id}`,
          stem: `¿Ya reformulada ${previous.id}?`,
          options: ["Energía", "ADN", "Lípidos", "Almidón"],
          correctIndex: 0,
          explanation: "",
          generationId: "gen-earlier",
        },
        LATER,
      );
      if (!variant.ok) throw variant.error;
      await uow.repos.questions.save(variant.value);
      await uow.repos.questions.retire(previous.id, OWNER, LATER);
      variantIds.push(variant.value.id);
    }
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    const started = startedOf(result);
    expect(started.session.questionIds.slice(0, 4)).toEqual(variantIds);
    expect(started.remainingToday).toBeNull();
    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
  });

  it("stores nothing and consumes no unit when the transaction fails", async () => {
    const { uow, limiter, deps } = setup();
    await seedFailedExam(uow);
    const before = await storedState(uow);
    uow.repos.sessions.create = async () => {
      throw new Error("connection lost");
    };
    await expect(
      startExamRetake({ pageId: PAGE, requestedCount: 10 }, deps, OWNER),
    ).rejects.toThrow("connection lost");
    expect(limiter.checks).toBe(0);
    expect(await storedState(uow)).toEqual(before);
  });

  it("finishes a retake like any exam: a fail reformulates the new failed roots again, never with an earlier wording, and a pass clears", async () => {
    const { uow, ai, deps } = setup();
    const seeded = await seedFailedExam(uow, { failed: 4 });
    const original = seeded[0] as ExamQuestion;

    const takeRetake = async (wrong: number, at: Date) => {
      const started = ok(
        startedOf(
          await startExamRetake(
            { pageId: PAGE, requestedCount: 10 },
            { ...deps, clock: createFixedClock(at) },
            OWNER,
          ),
        ),
      );
      const questions = await uow.repos.questions.listByIds(
        started.value.session.questionIds,
        OWNER,
      );
      const byId = new Map(questions.map((q) => [q.id, q]));
      for (const [i, id] of started.value.session.questionIds.entries()) {
        const q = byId.get(id) as ExamQuestion;
        const answered = await answerExamQuestion(
          {
            sessionId: started.value.session.id,
            questionId: id,
            selectedIndex:
              i < wrong ? (q.correctIndex + 1) % 4 : q.correctIndex,
          },
          { uow, clock: createFixedClock(at) },
          OWNER,
        );
        if (!answered.ok) throw answered.error;
      }
      const done = await completeExamSession(
        { sessionId: started.value.session.id },
        { uow, clock: createFixedClock(new Date(at.getTime() + 60_000)) },
        OWNER,
      );
      if (!done.ok) throw done.error;
      return started.value.session;
    };

    // First retake: the 4 variants answered wrong → retake pending again.
    const first = await takeRetake(4, RETAKE_AT);
    const state = await uow.repos.pageStates.get(PAGE, OWNER);
    expect(state?.retakePending).toBe(true);
    expect(state?.failedRootIds).toEqual(
      seeded.slice(0, 4).map((q) => q.rootId),
    );

    // A model that answers the root's original wording is refused: the
    // whole lineage counts, not only the last shown question.
    ai.respond = (rootIds, call) =>
      rootIds[0] === original.rootId
        ? ok({
            variants: rootIds.map((rootId) => ({
              forRootId: rootId,
              stem:
                rootId === original.rootId
                  ? original.stem
                  : `¿Otra ${rootId} ${call}?`,
              options: ["Energía", "ADN", "Lípidos", "Almidón"],
              correctIndex: 0,
              explanation: "",
            })),
          })
        : freshVariants(rootIds, call);
    const refused = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      { ...deps, clock: createFixedClock(new Date("2026-10-08T10:00:00Z")) },
      OWNER,
    );
    expectError(refused, EXAM_ERROR.RETAKE_VARIANT_MISSING);

    // Second retake with fresh wordings: the variants replace the first
    // retake's ones (variant of a variant, same root) and it passes.
    ai.respond = freshVariants;
    const second = await takeRetake(0, new Date("2026-10-08T11:00:00Z"));
    expect(second.retakeOfSessionId).toBe(first.id);
    const head = await uow.repos.questions.findById(
      second.questionIds[0] as string,
      OWNER,
    );
    expect(head).toMatchObject({
      rootId: original.rootId,
      variantOf: first.questionIds[0],
    });
    const cleared = await uow.repos.pageStates.get(PAGE, OWNER);
    expect(cleared).toMatchObject({
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: second.id,
    });
  });
});

// The student may retire questions after failing (R3-retake-ai-before-
// composition, user decision 2026-10-05): a retake that can no longer be
// built is refused before any AI call, and a retake whose failed concepts
// all left the page is cleared so the page can hold a normal exam again.
describe("startExamRetake after questions were retired", () => {
  async function retire(
    uow: InMemoryExamSessionUnitOfWork,
    questions: readonly ExamQuestion[],
  ) {
    for (const q of questions) {
      await uow.repos.questions.retire(q.id, OWNER, LATER);
    }
  }

  it("refuses a retake below 10 questions before any AI call: nothing stored, no unit consumed", async () => {
    const { uow, ai, limiter, deps } = setup();
    const seeded = await seedFailedExam(uow, {
      seeded: 10,
      asked: 10,
      failed: 4,
    });
    // One non-failed concept left the page: 9 roots remain.
    await retire(uow, seeded.slice(9, 10));
    const before = await storedState(uow);
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(result, EXAM_ERROR.NOT_ENOUGH_QUESTIONS);
    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
    expect(await storedState(uow)).toEqual(before);
    expect((await uow.repos.pageStates.get(PAGE, OWNER))?.retakePending).toBe(
      true,
    );
  });

  it("refuses before any AI call when a retired failed concept leaves fewer than 10 roots", async () => {
    const { uow, ai, limiter, deps } = setup();
    const seeded = await seedFailedExam(uow, {
      seeded: 10,
      asked: 10,
      failed: 4,
    });
    await retire(uow, seeded.slice(0, 1));
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(result, EXAM_ERROR.NOT_ENOUGH_QUESTIONS);
    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
  });

  it("clears the retake when every failed concept was retired, keeping the last pass, and lets a normal exam start", async () => {
    const { uow, ai, limiter, deps } = setup();
    const seeded = await seedFailedExam(uow, { seeded: 14, failed: 4 });
    await uow.repos.pageStates.upsert({
      pageId: PAGE,
      ownerId: OWNER,
      retakePending: true,
      failedRootIds: seeded.slice(0, 4).map((q) => q.rootId),
      lastPassedSessionId: "passed-before",
    });
    await retire(uow, seeded.slice(0, 4));

    const blocked = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expectError(blocked, EXAM_ERROR.RETAKE_PENDING);

    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expect(result).toEqual(ok({ kind: "cleared" }));
    expect(ai.calls).toHaveLength(0);
    expect(limiter.peeks + limiter.checks).toBe(0);
    expect(await uow.repos.pageStates.get(PAGE, OWNER)).toEqual({
      pageId: PAGE,
      ownerId: OWNER,
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: "passed-before",
    });
    expect(uow.repos.sessions.snapshot()).toHaveLength(1);

    const normal = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expect(normal.ok).toBe(true);
    if (!normal.ok) return;
    expect(normal.value.session.isRetake).toBe(false);
  });

  it("retakes only the failed concepts that are still on the page", async () => {
    const { uow, ai, deps } = setup();
    const seeded = await seedFailedExam(uow, { seeded: 12, failed: 4 });
    await retire(uow, seeded.slice(0, 1));
    const result = await startExamRetake(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    const { session } = startedOf(result);
    expect(ai.calls).toHaveLength(1);
    expect(
      promptRoots((ai.calls[0] as GenerateStructuredInput).prompt),
    ).toEqual(seeded.slice(1, 4).map((q) => q.rootId));
    const head = await uow.repos.questions.listByIds(
      session.questionIds.slice(0, 3),
      OWNER,
    );
    expect(head.map((q) => q.rootId).sort()).toEqual(
      seeded
        .slice(1, 4)
        .map((q) => q.rootId)
        .sort(),
    );
    expect(session.questionIds).toHaveLength(10);
    const roots = (
      await uow.repos.questions.listByIds(session.questionIds, OWNER)
    ).map((q) => q.rootId);
    expect(roots).not.toContain(seeded[0]?.rootId);
  });
});
