import { recallEvaluationOutput } from "@/modules/ai";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import type {
  RecallAnswer,
  RecallEvaluationStatus,
} from "../domain/recall-answer";
import type { RecallAnswerRepository } from "../domain/recall-answer-repository";
import {
  averageCombinedQuality,
  type RecallSession,
  type RecallSessionCalibration,
  sessionCalibration,
} from "../domain/recall-session";
import type { RecallSessionRepository } from "../domain/recall-session-repository";
import { EVALUATION_CLAIM_LEASE_MS } from "./evaluate-recall-session";

// What the student reads of one evaluation (§8.5). The concepts and
// misconceptions are kept in the payload even where the results view has no
// slot for them (Phase 6 UI freeze).
export interface RecallEvaluationFeedback {
  justification: string;
  presentConcepts: string[];
  missingConcepts: string[];
  misconceptions: string[];
}

// The feedback inside a stored ai_evaluation: a model output or the skipped
// record. A failed attempt, a pending answer or anything malformed has none.
export function evaluationFeedbackOf(
  aiEvaluation: unknown,
): RecallEvaluationFeedback | null {
  const model = recallEvaluationOutput.safeParse(aiEvaluation);
  if (model.success) {
    const { justification, presentConcepts, missingConcepts, misconceptions } =
      model.data;
    return { justification, presentConcepts, missingConcepts, misconceptions };
  }
  if (
    typeof aiEvaluation === "object" &&
    aiEvaluation !== null &&
    "source" in aiEvaluation &&
    aiEvaluation.source === "skipped" &&
    "justification" in aiEvaluation &&
    typeof aiEvaluation.justification === "string"
  ) {
    return {
      justification: aiEvaluation.justification,
      presentConcepts: [],
      missingConcepts: [],
      misconceptions: [],
    };
  }
  return null;
}

export interface RecallAnswerResult {
  id: string;
  questionId: string;
  answerText: string;
  selfRating: number;
  evaluationStatus: RecallEvaluationStatus;
  aiScore: number | null;
  combinedQuality: number | null;
  disagreed: boolean;
  feedback: RecallEvaluationFeedback | null;
}

export interface RecallSessionResults {
  session: RecallSession;
  // In answer order (oldest first).
  answers: RecallAnswerResult[];
  // Average combined quality of the done answers, unrounded; null when none.
  averageCombinedQuality: number | null;
  calibration: RecallSessionCalibration;
  // True when a finished session is still pending and no pending answer
  // was saved or claimed within the claim lease: no run can be live, so a
  // poll may schedule one (a run that died). Otherwise the live run, or
  // the claim it holds, finishes the job (review part 2 R3-001).
  evaluationRunNeeded: boolean;
}

export interface RecallResultsDeps {
  sessions: Pick<RecallSessionRepository, "findById" | "setEvaluationStatus">;
  answers: Pick<
    RecallAnswerRepository,
    "listBySession" | "requeueFailed" | "markDisagreed"
  >;
  clock: Clock;
}

function sessionNotFound(sessionId: string): DomainError {
  return new DomainError(
    RECALL_ERROR.SESSION_NOT_FOUND,
    `recall session ${sessionId} not found`,
  );
}

function toResult(answer: RecallAnswer): RecallAnswerResult {
  return {
    id: answer.id,
    questionId: answer.questionId,
    answerText: answer.answerText,
    selfRating: answer.selfRating,
    evaluationStatus: answer.evaluationStatus,
    aiScore: answer.aiScore,
    combinedQuality: answer.combinedQuality,
    disagreed: answer.disagreed,
    feedback:
      answer.evaluationStatus === "done"
        ? evaluationFeedbackOf(answer.aiEvaluation)
        : null,
  };
}

// The results page's polling read (§8.5): the session status, every
// answer with its evaluation, the derived combined average and calibration
// counts, and whether a new evaluation run is needed. Read only. Missing or another owner's session:
// RECALL_SESSION_NOT_FOUND.
export async function getRecallSessionResults(
  input: { sessionId: string },
  deps: Pick<RecallResultsDeps, "sessions" | "answers" | "clock">,
  ownerId: string,
): Promise<Result<RecallSessionResults, DomainError>> {
  const session = await deps.sessions.findById(input.sessionId, ownerId);
  if (!session) return err(sessionNotFound(input.sessionId));
  const answers = await deps.answers.listBySession(session.id, ownerId);
  const liveSince = deps.clock.now().getTime() - EVALUATION_CLAIM_LEASE_MS;
  const pending = answers.filter((a) => a.evaluationStatus === "pending");
  return ok({
    evaluationRunNeeded:
      session.finishedAt !== null &&
      session.evaluationStatus === "pending" &&
      pending.every((a) => a.updatedAt.getTime() < liveSince),
    session,
    answers: answers.map(toResult),
    averageCombinedQuality: averageCombinedQuality(answers),
    calibration: sessionCalibration(answers),
  });
}

// "Reintentar" (CU-09 alternate flow): moves the failed answers back to
// pending, keeping their failed attempt until a new evaluation replaces it,
// and the session back to pending with them so the results poll again. The
// caller then runs evaluateRecallSession. Missing or another owner's
// session: RECALL_SESSION_NOT_FOUND.
export async function retryRecallEvaluation(
  input: { sessionId: string },
  deps: RecallResultsDeps,
  ownerId: string,
): Promise<Result<{ session: RecallSession; requeued: number }, DomainError>> {
  const session = await deps.sessions.findById(input.sessionId, ownerId);
  if (!session) return err(sessionNotFound(input.sessionId));
  const now = deps.clock.now();
  const requeued = await deps.answers.requeueFailed(session.id, ownerId, now);
  if (requeued === 0 || session.evaluationStatus === "pending") {
    return ok({ session, requeued });
  }
  const stored =
    (await deps.sessions.setEvaluationStatus(
      session.id,
      ownerId,
      "pending",
      now,
    )) ?? session;
  return ok({ session: stored, requeued });
}

// "No estoy de acuerdo" (§8.5): recorded, never changes the score.
// Idempotent. Missing or another owner's answer: RECALL_ANSWER_NOT_FOUND.
export async function disagreeRecallAnswer(
  input: { answerId: string },
  deps: Pick<RecallResultsDeps, "answers" | "clock">,
  ownerId: string,
): Promise<Result<RecallAnswer, DomainError>> {
  const answer = await deps.answers.markDisagreed(
    input.answerId,
    ownerId,
    deps.clock.now(),
  );
  if (!answer) {
    return err(
      new DomainError(
        RECALL_ERROR.ANSWER_NOT_FOUND,
        `recall answer ${input.answerId} not found`,
      ),
    );
  }
  return ok(answer);
}
