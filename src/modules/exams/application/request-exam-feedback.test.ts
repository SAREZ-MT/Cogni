import { beforeEach, describe, expect, it } from "vitest";
import {
  type AiGeneration,
  AiGenerationFailedError,
  EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimit,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import {
  completeSessionFeedback,
  failSessionFeedback,
  newSessionFeedback,
  type SessionFeedback,
} from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import type { ExamQuestion } from "../domain/exam-question";
import {
  type ExamAnswer,
  finishExamSession,
  gradeExamAnswer,
  newExamSession,
} from "../domain/exam-session";
import {
  type RequestExamFeedbackDeps,
  readExamFeedback,
  requestExamFeedback,
  STALE_PENDING_MS,
} from "./request-exam-feedback";
import {
  NOW,
  OTHER,
  OWNER,
  PAGE,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";
import { InMemorySessionFeedback } from "./testing/in-memory-session-feedback";

const REQUESTED_AT = new Date("2026-10-07T12:00:00.000Z");
const RESET = new Date("2026-10-08T00:00:00.000Z");
const PAGE_TEXT = "La mitocondria produce ATP mediante la respiración celular.";

const FEEDBACK_OBJECT = {
  summary: "Buen intento.",
  strengths: ["Las preguntas de ADN"],
  toReinforce: ["La función de la mitocondria"],
  nextStepSuggestion: "Repasa la mitocondria y repite el examen.",
};

function generation(id = "gen-1"): AiGeneration {
  return {
    id,
    ownerId: OWNER,
    pageId: PAGE,
    purpose: "session_feedback",
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    promptVersion: EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: REQUESTED_AT,
    updatedAt: REQUESTED_AT,
  };
}

type AiOutcome = "ok" | "fail" | "throw" | "hang" | { object: unknown };

function makeAi(outcome: AiOutcome = "ok") {
  const calls: GenerateStructuredInput[] = [];
  return {
    calls,
    generateStructured: async (
      input: GenerateStructuredInput,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    > => {
      calls.push(input);
      if (outcome === "fail") return err(new AiGenerationFailedError("gen-x"));
      if (outcome === "throw") throw new Error("network down");
      if (outcome === "hang") return new Promise(() => {});
      const object = outcome === "ok" ? FEEDBACK_OBJECT : outcome.object;
      return ok({ object, generation: generation() });
    },
  };
}

function pageReader(text = PAGE_TEXT): PageTextReader {
  return {
    async getPageText(pageId, ownerId) {
      if (pageId !== PAGE || ownerId !== OWNER) {
        return err(new DomainError("PAGE_NOT_FOUND", pageId));
      }
      return ok({ title: "Mitocondria", plainText: text });
    },
  };
}

interface Fixture {
  uow: InMemoryExamSessionUnitOfWork;
  feedback: InMemorySessionFeedback;
  ai: ReturnType<typeof makeAi>;
  deps: RequestExamFeedbackDeps;
  questions: ExamQuestion[];
  peeks: number;
}

let nextId = 0;

async function build(
  options: {
    ai?: AiOutcome;
    allowed?: boolean;
    pageText?: string;
    tokenCap?: number;
  } = {},
): Promise<Fixture> {
  const uow = new InMemoryExamSessionUnitOfWork();
  const questions = await seedSessionQuestions(uow, 10);
  const feedback = new InMemorySessionFeedback();
  const ai = makeAi(options.ai);
  const fixture: Fixture = {
    uow,
    feedback,
    ai,
    questions,
    peeks: 0,
    deps: {
      uow,
      feedback,
      pages: pageReader(options.pageText),
      limiter: {
        peek: async (): Promise<GenerationRateLimit> => {
          fixture.peeks += 1;
          return {
            allowed: options.allowed ?? true,
            remaining: options.allowed === false ? 0 : 3,
            resetAt: RESET,
          };
        },
      },
      ai,
      clock: createFixedClock(REQUESTED_AT),
      ids: { next: () => `fb-${++nextId}` },
      tokenCap: options.tokenCap ?? 12_000,
      aiTimeoutMs: 50,
    },
  };
  return fixture;
}

// Stores a session over the seeded questions, the first `wrong` answered
// with option 1 (fixture questions are correct at 0); finished at
// `finishedAt` unless it is null (left open).
async function seedSession(
  fx: Fixture,
  id: string,
  options: { wrong: number; finishedAt: Date | null },
) {
  const startedAt = new Date(NOW.getTime() + 60_000);
  const created = newExamSession(
    {
      id,
      ownerId: OWNER,
      pageId: PAGE,
      requestedCount: 10,
      retakeOfSessionId: null,
      questionIds: fx.questions.map((q) => q.id),
    },
    startedAt,
  );
  if (!created.ok) throw created.error;
  await fx.uow.repos.sessions.create(created.value);
  const answers: ExamAnswer[] = fx.questions.map((question, n) => {
    const graded = gradeExamAnswer({
      sessionId: id,
      question,
      selectedIndex: n < options.wrong ? 1 : 0,
      answeredAt: startedAt,
    });
    if (!graded.ok) throw graded.error;
    return graded.value;
  });
  await fx.uow.repos.answers.saveMany(answers, OWNER);
  if (options.finishedAt === null) return created.value;
  const finished = finishExamSession(
    created.value,
    answers,
    options.finishedAt,
  );
  if (!finished.ok) throw finished.error;
  await fx.uow.repos.sessions.finish(finished.value);
  return finished.value;
}

function at(day: number): Date {
  return new Date(Date.UTC(2026, 9, day, 11));
}

function storedFeedback(
  sessionId: string,
  status: "done" | "failed" | "pending",
  updatedAt = at(5),
): SessionFeedback {
  const pending = newSessionFeedback({
    id: `stored-${sessionId}`,
    ownerId: OWNER,
    sessionKind: "exam",
    sessionId,
    now: updatedAt,
  });
  if (status === "pending") return pending;
  if (status === "failed") return failSessionFeedback(pending, null, updatedAt);
  return completeSessionFeedback(
    pending,
    { ...FEEDBACK_OBJECT, summary: `Feedback de ${sessionId}` },
    "gen-old",
    updatedAt,
  );
}

let fx: Fixture;

beforeEach(async () => {
  nextId = 0;
  fx = await build();
});

describe("requestExamFeedback", () => {
  it("generates feedback for a failed exam from its failed questions and the page text", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.reused).toBe(false);
    expect(result.value.feedback).toMatchObject({
      sessionKind: "exam",
      sessionId: "s-fail",
      status: "done",
      content: FEEDBACK_OBJECT,
      generationId: "gen-1",
    });
    expect(fx.ai.calls).toHaveLength(1);
    const call = fx.ai.calls[0];
    expect(call).toMatchObject({
      purpose: "session_feedback",
      pageId: PAGE,
      promptVersion: "session_feedback/v2",
    });
    expect(call.prompt).toContain("Questions answered: 10");
    expect(call.prompt).toContain("Correct: 6");
    expect(call.prompt).toContain("Result: below 70 %");
    expect(call.prompt).toContain(
      "Question 1 [Concepto q-01]: ¿Pregunta q-01?",
    );
    expect(call.prompt).toContain("  Student answered: ADN");
    expect(call.prompt).toContain("  Correct answer: ATP");
    expect(call.prompt).not.toContain("[Concepto q-05]");
    expect(call.prompt.endsWith(`Text:\n${PAGE_TEXT}`)).toBe(true);
    expect(fx.peeks).toBe(1);
    expect(
      (await fx.feedback.findBySession("exam", "s-fail", OWNER))?.status,
    ).toBe("done");
  });

  it("generates feedback for the first passing exam", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });
    await seedSession(fx, "s-pass", { wrong: 1, finishedAt: at(6) });

    const result = await requestExamFeedback(
      { sessionId: "s-pass" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: false,
      feedback: { sessionId: "s-pass", status: "done" },
    });
    expect(fx.ai.calls[0].prompt).toContain("Result: passed (70 % or more)");
  });

  it("reuses the last passing exam's feedback for a later pass, without calling the AI or storing a row", async () => {
    await seedSession(fx, "s-pass-1", { wrong: 0, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-pass-1", "done"));
    await seedSession(fx, "s-pass-2", { wrong: 2, finishedAt: at(6) });

    const result = await requestExamFeedback(
      { sessionId: "s-pass-2" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.reused).toBe(true);
    expect(result.value.feedback).toMatchObject({
      sessionId: "s-pass-1",
      status: "done",
      content: { summary: "Feedback de s-pass-1" },
    });
    expect(fx.ai.calls).toEqual([]);
    expect(fx.peeks).toBe(0);
    expect(fx.feedback.creates).toBe(0);
    expect(await fx.feedback.findBySession("exam", "s-pass-2", OWNER)).toBe(
      null,
    );
  });

  it("follows a chain of passes back to the feedback last generated, across failed attempts", async () => {
    await seedSession(fx, "s-pass-1", { wrong: 0, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-pass-1", "done"));
    // Reused s-pass-1's feedback: it has no row of its own.
    await seedSession(fx, "s-pass-2", { wrong: 0, finishedAt: at(6) });
    await seedSession(fx, "s-fail", { wrong: 5, finishedAt: at(7) });
    fx.feedback.put(storedFeedback("s-fail", "done"));
    await seedSession(fx, "s-pass-3", { wrong: 3, finishedAt: at(8) });

    const result = await requestExamFeedback(
      { sessionId: "s-pass-3" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: true,
      feedback: { sessionId: "s-pass-1" },
    });
    expect(fx.ai.calls).toEqual([]);
  });

  it("generates new feedback for a failed exam after a pass", async () => {
    await seedSession(fx, "s-pass", { wrong: 0, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-pass", "done"));
    await seedSession(fx, "s-fail", { wrong: 6, finishedAt: at(6) });

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: false,
      feedback: { sessionId: "s-fail", status: "done" },
    });
    expect(fx.ai.calls).toHaveLength(1);
  });

  it("generates when the last earlier pass has no stored feedback (its generation failed)", async () => {
    await seedSession(fx, "s-pass-1", { wrong: 0, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-pass-1", "failed"));
    await seedSession(fx, "s-pass-2", { wrong: 0, finishedAt: at(6) });

    const result = await requestExamFeedback(
      { sessionId: "s-pass-2" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: false,
      feedback: { sessionId: "s-pass-2", status: "done" },
    });
  });

  it("never reuses the feedback of a pass finished after the requested exam", async () => {
    await seedSession(fx, "s-pass-1", { wrong: 0, finishedAt: at(5) });
    await seedSession(fx, "s-pass-2", { wrong: 0, finishedAt: at(6) });
    fx.feedback.put(storedFeedback("s-pass-2", "done"));

    const result = await requestExamFeedback(
      { sessionId: "s-pass-1" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: false,
      feedback: { sessionId: "s-pass-1", status: "done" },
    });
  });

  it("refuses an open session and changes nothing", async () => {
    await seedSession(fx, "s-open", { wrong: 0, finishedAt: null });

    const result = await requestExamFeedback(
      { sessionId: "s-open" },
      fx.deps,
      OWNER,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.FEEDBACK_SESSION_OPEN);
    expect(fx.ai.calls).toEqual([]);
    expect(fx.feedback.creates).toBe(0);
  });

  it("refuses an unknown or another owner's session", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    for (const [sessionId, owner] of [
      ["missing", OWNER],
      ["s-fail", OTHER],
    ] as const) {
      const result = await requestExamFeedback({ sessionId }, fx.deps, owner);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe(EXAM_ERROR.SESSION_NOT_FOUND);
    }
    expect(fx.feedback.creates).toBe(0);
  });

  it.each([
    ["the provider fails", "fail" as const, "gen-x"],
    ["the AI call throws", "throw" as const, null],
    ["the AI does not answer in time", "hang" as const, null],
    ["the AI answer is invalid", { object: { summary: "" } }, "gen-1"],
  ])("stores failed feedback when %s and leaves the session as it was", async (_, outcome, generationId) => {
    fx = await build({ ai: outcome });
    const session = await seedSession(fx, "s-fail", {
      wrong: 4,
      finishedAt: at(5),
    });

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback).toMatchObject({
      status: "failed",
      content: null,
      generationId,
    });
    expect(await fx.uow.repos.sessions.findById("s-fail", OWNER)).toEqual(
      session,
    );
  });

  it("stores failed feedback without calling the AI when the daily limit is reached, and never consumes a unit", async () => {
    fx = await build({ allowed: false });
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback.status).toBe("failed");
    expect(fx.ai.calls).toEqual([]);
    // The limiter dependency only has `peek`: nothing can consume a unit.
    expect(Object.keys(fx.deps.limiter)).toEqual(["peek"]);
  });

  it("is idempotent per session: a later request reads the stored row back", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    const first = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );
    const second = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!first.ok || !second.ok) throw new Error("expected ok");
    expect(second.value).toEqual(first.value);
    expect(fx.ai.calls).toHaveLength(1);
    expect(fx.feedback.creates).toBe(1);
  });

  it("returns a fresh pending row of another request without calling the AI", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-fail", "pending", REQUESTED_AT));

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback.status).toBe("pending");
    expect(fx.ai.calls).toEqual([]);
  });

  it("reclaims a stale pending row and settles it", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });
    const staleAt = new Date(REQUESTED_AT.getTime() - STALE_PENDING_MS - 1);
    fx.feedback.put(storedFeedback("s-fail", "pending", staleAt));

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback).toMatchObject({
      id: "stored-s-fail",
      status: "done",
    });
    expect(fx.ai.calls).toHaveLength(1);
  });

  it("returns the failed outcome even when storing it fails", async () => {
    fx = await build({ ai: "fail" });
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });
    fx.feedback.failSettlesOf.add("failed");

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback.status).toBe("failed");
  });

  it("truncates the page text to the token cap", async () => {
    fx = await build({ pageText: "uno dos tres cuatro cinco", tokenCap: 4 });
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    await requestExamFeedback({ sessionId: "s-fail" }, fx.deps, OWNER);

    expect(fx.ai.calls[0].prompt.endsWith("Text:\nuno dos tres")).toBe(true);
  });

  it("still generates when the page text cannot be read", async () => {
    fx.deps = {
      ...fx.deps,
      pages: {
        getPageText: async () => err(new DomainError("PAGE_NOT_FOUND", "x")),
      },
    };
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    const result = await requestExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.feedback.status).toBe("done");
    expect(fx.ai.calls[0].prompt.endsWith("Text:\n")).toBe(true);
  });
});

describe("readExamFeedback", () => {
  it("reads nothing for a finished exam never asked for feedback", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });

    const result = await readExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    expect(result).toEqual(ok(null));
  });

  it("reads the session's own row", async () => {
    await seedSession(fx, "s-fail", { wrong: 4, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-fail", "failed"));

    const result = await readExamFeedback(
      { sessionId: "s-fail" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: false,
      feedback: { sessionId: "s-fail", status: "failed" },
    });
  });

  it("reads the reused feedback of the last earlier pass without calling the AI", async () => {
    await seedSession(fx, "s-pass-1", { wrong: 0, finishedAt: at(5) });
    fx.feedback.put(storedFeedback("s-pass-1", "done"));
    await seedSession(fx, "s-pass-2", { wrong: 0, finishedAt: at(6) });

    const result = await readExamFeedback(
      { sessionId: "s-pass-2" },
      fx.deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toMatchObject({
      reused: true,
      feedback: { sessionId: "s-pass-1" },
    });
    expect(fx.ai.calls).toEqual([]);
  });

  it("refuses an open or unknown session", async () => {
    await seedSession(fx, "s-open", { wrong: 0, finishedAt: null });

    const open = await readExamFeedback(
      { sessionId: "s-open" },
      fx.deps,
      OWNER,
    );
    const missing = await readExamFeedback(
      { sessionId: "missing" },
      fx.deps,
      OWNER,
    );

    expect(!open.ok && open.error.code).toBe(EXAM_ERROR.FEEDBACK_SESSION_OPEN);
    expect(!missing.ok && missing.error.code).toBe(
      EXAM_ERROR.SESSION_NOT_FOUND,
    );
  });
});
