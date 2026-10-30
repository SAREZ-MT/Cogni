import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  buildEvaluateRecallAnswerPrompt,
  EVALUATE_RECALL_ANSWER_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  recallEvaluationOutput,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import type {
  DueCutoff,
  RecordedRecallReviews,
  RecordRecallReviewsInput,
} from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import { selectRelevantFragment } from "../domain/fragment";
import {
  combinedQuality,
  isSkippedAnswer,
  type RecallAnswer,
  skippedEvaluation,
} from "../domain/recall-answer";
import type {
  RecallAnswerRepository,
  RecallEvaluationResult,
} from "../domain/recall-answer-repository";
import type { RecallQuestion } from "../domain/recall-question";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";
import {
  type RecallSession,
  sessionEvaluationStatus,
} from "../domain/recall-session";
import type { RecallSessionRepository } from "../domain/recall-session-repository";
import { runRecallWork, type UnitOfWorkOf } from "./recall-unit-of-work";

// What the final status write needs: the session row lock and a fresh read
// of the answers, in one unit of work (RecallSessionUnitOfWork fits).
export type RecallStatusUnitOfWork = UnitOfWorkOf<{
  readonly sessions: Pick<
    RecallSessionRepository,
    "lockById" | "setEvaluationStatus"
  >;
  readonly answers: Pick<RecallAnswerRepository, "listBySession">;
}>;

// How long a run's claim on an answer holds. Longer than the function
// budget (maxDuration 300 s, ADR 0003): a claim this old belongs to a run
// that died, and the next run takes the answer over.
export const EVALUATION_CLAIM_LEASE_MS = 6 * 60 * 1000;

// The auditable ai_evaluation of an answer whose evaluation failed: the
// error code, the last audited ai_generations attempt (if any) and, for the
// daily limit, when it resets. No score is invented (user decision
// 2026-10-06).
export interface FailedEvaluation {
  readonly source: "failed";
  readonly code: string;
  readonly generationId: string | null;
  readonly resetAt?: string;
}

export interface EvaluateRecallSessionDeps {
  // The final status write (review R3-001): overlapping runs (the finish's
  // and a "Reintentar") each derive the status from the answers as they
  // are under the session lock, so a stale run never overwrites a newer
  // status.
  uow: RecallStatusUnitOfWork;
  sessions: Pick<RecallSessionRepository, "findById">;
  answers: Pick<
    RecallAnswerRepository,
    "claimPendingForEvaluation" | "saveEvaluation" | "listBySession"
  >;
  questions: Pick<RecallQuestionRepository, "listByIds">;
  pages: PageTextReader;
  ai: {
    generateStructured(
      input: GenerateStructuredInput,
      ownerId: string,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    >;
  };
  // AI_DAILY_EVALUATIONS: one unit per answer the model evaluated.
  limiter: GenerationRateLimiter;
  // study-engine's recordRecallReviews (replay-safe per session and item).
  reviews: {
    record(
      input: RecordRecallReviewsInput,
    ): Promise<Result<RecordedRecallReviews, DomainError>>;
  };
  clock: Clock;
  // The owner's per-day "due" bound (start of their next local day),
  // resolved in the request that scheduled the run: a passing quality on
  // a question due later today reviews it.
  dueCutoff: DueCutoff;
  // AI_PAGE_TOKEN_CAP: the page fragment is trimmed to it.
  tokenCap: number;
  // Told about every unexpected failure (the action reports it to Sentry);
  // none of them stops the run.
  onError?: (error: unknown) => void;
}

export interface EvaluatedRecallSession {
  session: RecallSession;
  // Answers this run resolved as done (model or skipped) and as failed.
  evaluated: number;
  failed: number;
}

function failed(
  code: string,
  generationId: string | null = null,
  resetAt?: Date,
): RecallEvaluationResult {
  const aiEvaluation: FailedEvaluation = {
    source: "failed",
    code,
    generationId,
    ...(resetAt ? { resetAt: resetAt.toISOString() } : {}),
  };
  return { status: "failed", aiEvaluation, generationId };
}

function done(
  answer: RecallAnswer,
  aiScore: number,
  aiEvaluation: unknown,
  generationId: string | null,
): RecallEvaluationResult {
  const combined = combinedQuality(aiScore, answer.selfRating);
  if (!combined.ok) return failed(combined.error.code, generationId);
  return {
    status: "done",
    aiEvaluation,
    aiScore,
    combinedQuality: combined.value,
    generationId,
  };
}

interface RunState {
  // Set once the daily evaluation limit is known to be reached.
  limitResetAt: Date | null;
}

async function evaluateAnswer(
  answer: RecallAnswer,
  context: {
    question: RecallQuestion | undefined;
    plainText: string;
    pageId: string;
    state: RunState;
  },
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
): Promise<RecallEvaluationResult> {
  // A skipped answer: ai score 0 with the auditable skipped record, no
  // model call and no unit (user decision 2026-10-06, ADR 0007).
  if (isSkippedAnswer(answer.answerText)) {
    return done(answer, 0, skippedEvaluation(), null);
  }
  const { question, state } = context;
  if (!question) return failed(RECALL_ERROR.QUESTION_NOT_IN_SESSION);

  // The daily limit is peeked before the call and consumed only after a
  // done evaluation, so a failed attempt costs nothing. A reached limit
  // fails the answer (never leaves it pending): the session ends partial
  // and "Reintentar" evaluates it once the window resets.
  if (state.limitResetAt === null) {
    const limit = await deps.limiter.peek(ownerId);
    if (!limit.allowed) state.limitResetAt = limit.resetAt;
  }
  if (state.limitResetAt !== null) {
    return failed(AI_ERROR.DAILY_LIMIT_REACHED, null, state.limitResetAt);
  }

  const prompt = buildEvaluateRecallAnswerPrompt({
    question: question.prompt,
    keyConcepts: question.rubric.keyConcepts,
    acceptableAnswerSummary: question.rubric.acceptableAnswerSummary,
    pageFragment: selectRelevantFragment(
      context.plainText,
      question,
      deps.tokenCap,
    ),
    answer: answer.answerText,
  });
  const generated = await deps.ai.generateStructured(
    {
      purpose: "evaluate_recall_answer",
      pageId: context.pageId,
      promptVersion: EVALUATE_RECALL_ANSWER_PROMPT_VERSION,
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: prompt.temperature,
    },
    ownerId,
  );
  if (!generated.ok) {
    const generationId =
      generated.error instanceof AiGenerationFailedError
        ? generated.error.generationId
        : null;
    return failed(generated.error.code, generationId);
  }
  const { generation } = generated.value;
  const parsed = recallEvaluationOutput.safeParse(generated.value.object);
  if (!parsed.success) {
    return failed(AI_ERROR.GENERATION_FAILED, generation.id);
  }
  try {
    const consumed = await deps.limiter.check(ownerId);
    if (!consumed.allowed) {
      // A concurrent evaluation spent the last unit after this run's peek
      // (review R3-002): the evaluation already happened, so it stands; the
      // overage is reported and the rest of the run calls no model.
      state.limitResetAt = consumed.resetAt;
      deps.onError?.(
        new DomainError(
          AI_ERROR.DAILY_LIMIT_REACHED,
          "the daily evaluation limit ran out after this evaluation was allowed",
        ),
      );
    }
  } catch (error) {
    // The evaluation stands; at worst the unit stays unconsumed.
    deps.onError?.(error);
  }
  return done(answer, parsed.data.score, parsed.data, generation.id);
}

// Feeds every done answer of the session to SM-2 with its combined quality
// (§7.4). Replay-safe: answers recorded by an earlier run are reported back
// by study-engine and left alone, so a run also heals one that died after
// saving. A refused batch is retried one answer at a time so one bad item
// never blocks the others; failures are reported, never thrown.
async function recordReviews(
  session: RecallSession,
  answers: readonly RecallAnswer[],
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
  now: Date,
): Promise<void> {
  const reviews = answers.flatMap((answer) =>
    answer.evaluationStatus === "done" && answer.combinedQuality !== null
      ? [{ questionId: answer.questionId, quality: answer.combinedQuality }]
      : [],
  );
  if (reviews.length === 0) return;
  const record = async (batch: typeof reviews) => {
    try {
      const result = await deps.reviews.record({
        ownerId,
        sessionId: session.id,
        pageId: session.pageId,
        reviews: batch,
        now,
        dueBefore: deps.dueCutoff(now),
      });
      return result.ok ? null : result.error;
    } catch (error) {
      return error;
    }
  };
  const batchError = await record(reviews);
  if (batchError === null) return;
  if (reviews.length === 1) {
    deps.onError?.(batchError);
    return;
  }
  for (const review of reviews) {
    const error = await record([review]);
    if (error !== null) deps.onError?.(error);
  }
}

// Stores the session status derived from its answers as they are now:
// the session row is locked first and the answers are read after the lock,
// so two overlapping runs write in turn and the later one sees every answer
// the earlier one saved (review R3-001). Writes only a change.
async function storeSessionStatus(
  session: RecallSession,
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
): Promise<RecallSession> {
  const written = await runRecallWork<
    Parameters<Parameters<RecallStatusUnitOfWork["run"]>[0]>[0],
    RecallSession,
    never
  >(deps.uow, async ({ sessions, answers }) => {
    const locked = await sessions.lockById(session.id, ownerId);
    if (!locked) return ok(session);
    const status = sessionEvaluationStatus(
      await answers.listBySession(session.id, ownerId),
    );
    if (status === locked.evaluationStatus) return ok(locked);
    return ok(
      (await sessions.setEvaluationStatus(
        session.id,
        ownerId,
        status,
        deps.clock.now(),
      )) ?? locked,
    );
  });
  return written.ok ? written.value : session;
}

// The asynchronous evaluation of a finished session (§8.5, SAD §10.4, CU-09),
// run after the finish through `after()` and again by "Reintentar". It
// claims the session's pending answers (a claim older than the lease is
// taken over), evaluates each one — a skipped answer gets the skipped
// record without the model; a written one gets one generateStructured call
// with the rubric and the page fragment closest to the question — and
// stores the raw evaluation: the model output with the ai score and the
// combined quality (done), or the failed attempt (failed: no score, no
// SM-2 review, so the question stays due). Then it records the SM-2 reviews
// of the done answers and stores the session status derived from all the
// answers, read again under the session lock. Idempotent and safe to re-run: resolved answers are never
// evaluated again, and answers another live run claimed are left to it. An
// open session is left alone. Missing or another owner's session:
// RECALL_SESSION_NOT_FOUND.
export async function evaluateRecallSession(
  input: { sessionId: string },
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
): Promise<Result<EvaluatedRecallSession, DomainError>> {
  const session = await deps.sessions.findById(input.sessionId, ownerId);
  if (!session) {
    return err(
      new DomainError(
        RECALL_ERROR.SESSION_NOT_FOUND,
        `recall session ${input.sessionId} not found`,
      ),
    );
  }
  if (session.finishedAt === null) {
    return ok({ session, evaluated: 0, failed: 0 });
  }

  const now = deps.clock.now();
  const claimed = await deps.answers.claimPendingForEvaluation(
    session.id,
    ownerId,
    new Date(now.getTime() - EVALUATION_CLAIM_LEASE_MS),
    now,
  );

  let evaluated = 0;
  let failedCount = 0;
  if (claimed.length === 0) {
    // Another live run holds the pending answers: it finishes the job.
    const current = await deps.answers.listBySession(session.id, ownerId);
    if (current.some((answer) => answer.evaluationStatus === "pending")) {
      return ok({ session, evaluated, failed: failedCount });
    }
  } else {
    const page = await deps.pages.getPageText(session.pageId, ownerId);
    const plainText = page.ok ? page.value.plainText : "";
    const questions = new Map(
      (
        await deps.questions.listByIds(
          claimed.map((answer) => answer.questionId),
          ownerId,
        )
      ).map((question) => [question.id, question]),
    );
    const state: RunState = { limitResetAt: null };
    for (const answer of claimed) {
      let result: RecallEvaluationResult;
      try {
        result = await evaluateAnswer(
          answer,
          {
            question: questions.get(answer.questionId),
            plainText,
            pageId: session.pageId,
            state,
          },
          deps,
          ownerId,
        );
      } catch (error) {
        deps.onError?.(error);
        result = failed(RECALL_ERROR.UNEXPECTED);
      }
      const saved = await deps.answers.saveEvaluation(
        answer.id,
        ownerId,
        result,
        deps.clock.now(),
      );
      if (saved?.evaluationStatus === "done") evaluated += 1;
      if (saved?.evaluationStatus === "failed") failedCount += 1;
    }
  }

  const answers = await deps.answers.listBySession(session.id, ownerId);
  await recordReviews(session, answers, deps, ownerId, now);
  const stored = await storeSessionStatus(session, deps, ownerId);
  return ok({ session: stored, evaluated, failed: failedCount });
}
