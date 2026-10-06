import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "./errors";

// pending → the AI evaluation has not resolved yet; done → it produced a
// score; failed → every provider failed, the raw attempt is kept and no
// combined quality is invented (user decision 2026-10-06).
export type RecallEvaluationStatus = "pending" | "done" | "failed";

// What the student wrote, how they rated it and how the AI judged it
// (documento-maestro §6.1, §7.4). The raw, self and combined values are all
// kept for audit (§8.5).
export interface RecallAnswer {
  readonly id: string;
  readonly ownerId: string;
  readonly sessionId: string;
  readonly questionId: string;
  readonly answerText: string;
  // 0 = impossible, 5 = trivial.
  readonly selfRating: number;
  readonly evaluationStatus: RecallEvaluationStatus;
  // The raw model output, the failed attempt or the skipped record (jsonb).
  readonly aiEvaluation: unknown;
  readonly aiScore: number | null;
  readonly combinedQuality: number | null;
  // "No estoy de acuerdo": recorded, never changes the score (§8.5).
  readonly disagreed: boolean;
  readonly generationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewRecallAnswer {
  id: string;
  ownerId: string;
  sessionId: string;
  questionId: string;
  answerText: string;
  selfRating: number;
}

// An AI score and a self-rating share the 0–5 integer scale of SM-2.
export function isRecallScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

// The text the player stores for a question left without an answer: both
// "Saltar" (with rating 0) and "Calificar" on a blank answer produce it.
export const SKIPPED_ANSWER_TEXT = "(sin respuesta)";

// True for the skip marker or a blank text: there is nothing to evaluate,
// so the model is never called for it.
export function isSkippedAnswer(answerText: string): boolean {
  const text = answerText.trim();
  return text.length === 0 || text === SKIPPED_ANSWER_TEXT;
}

export interface SkippedEvaluation {
  readonly source: "skipped";
  readonly score: 0;
  readonly justification: string;
}

// The explicit, auditable ai_evaluation of a skipped answer: ai score 0
// without a model call (user decision 2026-10-06, ADR 0007).
export function skippedEvaluation(): SkippedEvaluation {
  return {
    source: "skipped",
    score: 0,
    justification: "Pregunta sin responder.",
  };
}

// combined = round(0.6 · ai + 0.4 · self) (§7.4, RF-AR-04).
export function combinedQuality(
  aiScore: number,
  selfRating: number,
): Result<number, DomainError> {
  const invalid = invalidScores(aiScore, selfRating);
  if (invalid) return err(invalid);
  return ok(Math.round(0.6 * aiScore + 0.4 * selfRating));
}

export type Calibration = "overconfident" | "underconfident" | "calibrated";

// The metacognitive signal of §7.4 (RF-AR-05), derived and never stored:
// self ≥ 4 with ai ≤ 2 is overconfidence, self ≤ 1 with ai ≥ 4 is
// underconfidence.
export function calibrationOf(
  selfRating: number,
  aiScore: number,
): Result<Calibration, DomainError> {
  const invalid = invalidScores(aiScore, selfRating);
  if (invalid) return err(invalid);
  if (selfRating >= 4 && aiScore <= 2) return ok("overconfident");
  if (selfRating <= 1 && aiScore >= 4) return ok("underconfident");
  return ok("calibrated");
}

// A new answer awaits its evaluation. A blank text is stored as the skip
// marker so every skipped answer reads the same.
export function newRecallAnswer(
  input: NewRecallAnswer,
  now: Date,
): Result<RecallAnswer, DomainError> {
  if (!isRecallScore(input.selfRating)) {
    return err(
      new DomainError(
        RECALL_ERROR.INVALID_ANSWER,
        `a self-rating is an integer from 0 to 5, got ${input.selfRating}`,
      ),
    );
  }
  const text = input.answerText.trim();
  return ok({
    ...input,
    answerText: text.length === 0 ? SKIPPED_ANSWER_TEXT : text,
    evaluationStatus: "pending",
    aiEvaluation: null,
    aiScore: null,
    combinedQuality: null,
    disagreed: false,
    generationId: null,
    createdAt: now,
    updatedAt: now,
  });
}

function invalidScores(aiScore: number, selfRating: number) {
  if (isRecallScore(aiScore) && isRecallScore(selfRating)) return null;
  return new DomainError(
    RECALL_ERROR.INVALID_SCORE,
    `scores are integers from 0 to 5, got ai ${aiScore} and self ${selfRating}`,
  );
}
