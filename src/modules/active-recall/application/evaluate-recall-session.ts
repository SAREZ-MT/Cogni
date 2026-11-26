import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  buildEvaluateRecallAnswersPrompt,
  EVALUATE_RECALL_ANSWER_PROMPT_VERSION,
  EVALUATION_PROMPT_TOKEN_BUDGET,
  type EvaluatedRecallAnswer,
  estimateTokens,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  type RecallEvaluationOutput,
  recallEvaluationsOutput,
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
import { checkEvaluation } from "../domain/evaluation-check";
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
  // AI_DAILY_EVALUATIONS: one unit per session the model evaluated.
  limiter: GenerationRateLimiter;
  // Keyed by session id (the ai module's evaluationRunLimiter): one unit
  // per run that calls the model, so "Reintentar" cannot call it without
  // end on a session already charged (review F5).
  runLimiter: Pick<GenerationRateLimiter, "check">;
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
  // AI_PAGE_TOKEN_CAP: shared by the page fragments of one evaluation call.
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

// A written answer sent to the model, with the short key of its item.
interface ModelAnswer {
  readonly key: string;
  readonly answer: RecallAnswer;
  readonly question: RecallQuestion;
}

// Resolves an answer that needs no model: a skipped one gets the skipped
// record (ai score 0, no unit; user decision 2026-10-06, ADR 0007), and one
// whose question is gone fails. Null: the model evaluates it.
function resolveWithoutModel(
  answer: RecallAnswer,
  question: RecallQuestion | undefined,
): RecallEvaluationResult | null {
  if (isSkippedAnswer(answer.answerText)) {
    return done(answer, 0, skippedEvaluation(), null);
  }
  if (!question) return failed(RECALL_ERROR.QUESTION_NOT_IN_SESSION);
  return null;
}

function evaluatedItem(
  { key, answer, question }: ModelAnswer,
  pageFragment: string,
): EvaluatedRecallAnswer {
  return {
    id: key,
    question: question.prompt,
    keyConcepts: question.rubric.keyConcepts,
    acceptableAnswerSummary: question.rubric.acceptableAnswerSummary,
    pageFragment,
    answer: answer.answerText,
  };
}

// Smallest page fragment an answer of a batch gets (~110 words, a few
// sentences), so a crowded batch still sends each answer some context.
export const MIN_FRAGMENT_TOKENS = 150;

// Token cap of each page fragment of one evaluation call, given how many
// answers it carries, the page cap (AI_PAGE_TOKEN_CAP) and the estimated
// tokens of the prompt without fragments.
// - One answer is not batched: its fragment keeps the whole page cap. The
//   prompt may then pass Groq's ceiling and simply skips Groq
//   (`maxPromptTokens`) for a larger provider.
// - Two or more share what the rest of the prompt leaves of
//   EVALUATION_PROMPT_TOKEN_BUDGET (never more than the page cap), so the
//   call fits a small tokens-per-minute provider (Groq, 8K TPM). The
//   estimate is additive (a fragment of k tokens adds at most k), so the
//   budget holds for the sum.
// - When that share falls below MIN_FRAGMENT_TOKENS (or the rest of the
//   prompt alone is over the budget) every fragment gets the minimum, capped
//   by its share of the page cap: the cap shrinks smoothly as the answers
//   grow, never to zero and never jumping back up. The prompt can then pass
//   the budget by at most the minimums and skips Groq like a single answer.
// A non-numeric page cap stays NaN, which selects no fragment.
export function fragmentTokenCap(
  count: number,
  tokenCap: number,
  promptTokensWithoutFragments: number,
): number {
  if (count <= 1) return tokenCap;
  const left = EVALUATION_PROMPT_TOKEN_BUDGET - promptTokensWithoutFragments;
  const share = Math.floor(Math.min(tokenCap, left) / count);
  const minimum = Math.min(MIN_FRAGMENT_TOKENS, Math.floor(tokenCap / count));
  return Math.max(minimum, share);
}

// Every written answer of the run in one generateStructured call
// (evaluate_recall_answer/v3): each answer is an item with its own rubric
// and page fragment, sized by fragmentTokenCap. The batched output is
// checked deterministically: an invalid one, or one with an id that was not
// sent or comes back twice, fails every answer; an answer left without an
// evaluation fails alone. No answer passes without its own evaluation.
//
// The daily limit counts sessions: it is peeked once before the call and
// one unit is consumed only when at least one answer is done, so a failed
// call costs nothing. A reached limit fails the answers (never leaves them
// pending): the session ends partial and "Reintentar" evaluates them once
// the window resets. A session already `charged` (an earlier run consumed
// its unit) is neither peeked nor charged again (review F2). Every run that
// passes the daily limit also spends one of the session's evaluation runs,
// before the call and whatever its outcome (a provider outage counts); with
// none left the answers fail the same way, with that window's reset
// (review F5).
async function evaluateWithModel(
  pending: readonly ModelAnswer[],
  context: {
    plainText: string;
    pageId: string;
    sessionId: string;
    charged: boolean;
  },
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
): Promise<Map<string, RecallEvaluationResult>> {
  const failAll = (result: RecallEvaluationResult) =>
    new Map(pending.map(({ answer }) => [answer.id, result]));

  if (!context.charged) {
    const limit = await deps.limiter.peek(ownerId);
    if (!limit.allowed) {
      return failAll(failed(AI_ERROR.DAILY_LIMIT_REACHED, null, limit.resetAt));
    }
  }
  const runs = await deps.runLimiter.check(context.sessionId);
  if (!runs.allowed) {
    return failAll(failed(AI_ERROR.DAILY_LIMIT_REACHED, null, runs.resetAt));
  }

  const bare = buildEvaluateRecallAnswersPrompt(
    pending.map((model) => evaluatedItem(model, "")),
  );
  const fragmentCap = fragmentTokenCap(
    pending.length,
    deps.tokenCap,
    estimateTokens(`${bare.system}\n${bare.prompt}`),
  );
  const prompt = buildEvaluateRecallAnswersPrompt(
    pending.map((model) =>
      evaluatedItem(
        model,
        selectRelevantFragment(context.plainText, model.question, fragmentCap),
      ),
    ),
  );
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
    return failAll(failed(generated.error.code, generationId));
  }
  const { generation } = generated.value;
  const parsed = recallEvaluationsOutput.safeParse(generated.value.object);
  const byKey = new Map<string, RecallEvaluationOutput>();
  const sent = new Set(pending.map(({ key }) => key));
  let valid = parsed.success;
  for (const { questionId, ...evaluation } of parsed.success
    ? parsed.data.evaluations
    : []) {
    if (!sent.has(questionId) || byKey.has(questionId)) valid = false;
    byKey.set(questionId, evaluation);
  }
  if (!valid) return failAll(failed(AI_ERROR.GENERATION_FAILED, generation.id));

  const results = new Map<string, RecallEvaluationResult>();
  for (const { key, answer, question } of pending) {
    const evaluation = byKey.get(key);
    if (!evaluation) {
      results.set(answer.id, failed(AI_ERROR.GENERATION_FAILED, generation.id));
      continue;
    }
    // S2: the stored evaluation is the checked one (rubric concepts only,
    // score bounded by the model's own concept lists).
    const checked = checkEvaluation(evaluation, question.rubric.keyConcepts);
    results.set(answer.id, done(answer, checked.score, checked, generation.id));
  }

  if (
    !context.charged &&
    [...results.values()].some((result) => result.status === "done")
  ) {
    try {
      const consumed = await deps.limiter.check(ownerId);
      if (!consumed.allowed) {
        // A concurrent evaluation spent the last unit after this run's peek
        // (review R3-002): the evaluation already happened, so it stands;
        // the overage is reported.
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
  }
  return results;
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

// Whether an earlier run already consumed the session's unit, read from the
// stored answers: a unit is consumed exactly when a run leaves an answer
// done by the model, and only a model evaluation keeps a generation id on a
// done answer (a skipped one has none). The answers this run claimed are
// still pending, so every done one is an earlier run's.
async function alreadyCharged(
  session: RecallSession,
  deps: EvaluateRecallSessionDeps,
  ownerId: string,
): Promise<boolean> {
  const answers = await deps.answers.listBySession(session.id, ownerId);
  return answers.some(
    (answer) =>
      answer.evaluationStatus === "done" && answer.generationId !== null,
  );
}

// The asynchronous evaluation of a finished session (§8.5, SAD §10.4, CU-09),
// run after the finish through `after()` and again by "Reintentar". It
// claims the session's pending answers (a claim older than the lease is
// taken over), evaluates them — a skipped answer gets the skipped record
// without the model; the written ones share one generateStructured call,
// each with its rubric and the page fragment closest to its question — and
// stores the raw evaluation of each: the model output with the ai score and the
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
    const results = new Map<string, RecallEvaluationResult>();
    const pending: ModelAnswer[] = [];
    for (const answer of claimed) {
      const question = questions.get(answer.questionId);
      const resolved = resolveWithoutModel(answer, question);
      if (resolved) results.set(answer.id, resolved);
      else if (question) {
        pending.push({ key: `q${pending.length + 1}`, answer, question });
      }
    }
    if (pending.length > 0) {
      try {
        const evaluated = await evaluateWithModel(
          pending,
          {
            plainText,
            pageId: session.pageId,
            sessionId: session.id,
            charged: await alreadyCharged(session, deps, ownerId),
          },
          deps,
          ownerId,
        );
        for (const [id, result] of evaluated) results.set(id, result);
      } catch (error) {
        deps.onError?.(error);
        for (const { answer } of pending) {
          results.set(answer.id, failed(RECALL_ERROR.UNEXPECTED));
        }
      }
    }
    for (const answer of claimed) {
      const saved = await deps.answers.saveEvaluation(
        answer.id,
        ownerId,
        results.get(answer.id) ?? failed(RECALL_ERROR.UNEXPECTED),
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
