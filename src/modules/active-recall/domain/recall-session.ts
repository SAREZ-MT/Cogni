import {
  calibrationOf,
  type RecallAnswer,
  type RecallEvaluationStatus,
} from "./recall-answer";

// pending → some answer still awaits its evaluation; done → every answer
// resolved with a score; partial → none pending but some failed (CU-09
// alternate flow: "Reintentar" evaluates them later).
export type RecallSessionEvaluationStatus = "pending" | "done" | "partial";

// One active-recall session on a page (documento-maestro §6.1). Closing it
// never waits for the AI: the evaluation runs afterwards (§8.5).
export interface RecallSession {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly evaluationStatus: RecallSessionEvaluationStatus;
}

export interface NewRecallSessionInput {
  id: string;
  ownerId: string;
  pageId: string;
}

// A new session is pending: nothing has been evaluated yet.
export function newRecallSession(
  input: NewRecallSessionInput,
  now: Date,
): RecallSession {
  return {
    ...input,
    startedAt: now,
    finishedAt: null,
    evaluationStatus: "pending",
  };
}

// The session status derived from its answers' statuses. A session
// without answers has nothing left to evaluate, so it is done.
export function sessionEvaluationStatus(
  answers: readonly { evaluationStatus: RecallEvaluationStatus }[],
): RecallSessionEvaluationStatus {
  const statuses = new Set(answers.map((answer) => answer.evaluationStatus));
  if (statuses.has("pending")) return "pending";
  if (statuses.has("failed")) return "partial";
  return "done";
}

export interface RecallSessionScore {
  // AI score ≥ 4.
  readonly correct: number;
  // AI score 2–3.
  readonly partial: number;
  // AI score ≤ 1.
  readonly incorrect: number;
  // round(average combined quality × 20); null when nothing was evaluated.
  readonly percentage: number | null;
}

// The per-session score shown in the hub and results (user decision
// 2026-10-06). Failed and pending answers carry no score and are left out.
export function sessionScore(
  answers: readonly Pick<RecallAnswer, "aiScore" | "combinedQuality">[],
): RecallSessionScore {
  let correct = 0;
  let partial = 0;
  let incorrect = 0;
  let combinedSum = 0;
  let combinedCount = 0;
  for (const { aiScore, combinedQuality } of answers) {
    if (aiScore !== null) {
      if (aiScore >= 4) correct += 1;
      else if (aiScore >= 2) partial += 1;
      else incorrect += 1;
    }
    if (combinedQuality !== null) {
      combinedSum += combinedQuality;
      combinedCount += 1;
    }
  }
  const percentage =
    combinedCount === 0 ? null : Math.round((combinedSum / combinedCount) * 20);
  return { correct, partial, incorrect, percentage };
}

// The average combined quality (0–5) of the evaluated answers, unrounded;
// null when nothing was evaluated. The results view shows it as "x,x / 5".
export function averageCombinedQuality(
  answers: readonly Pick<RecallAnswer, "combinedQuality">[],
): number | null {
  const scores = answers.flatMap(({ combinedQuality }) =>
    combinedQuality === null ? [] : [combinedQuality],
  );
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export interface RecallSessionCalibration {
  readonly overconfident: number;
  readonly underconfident: number;
}

// How many evaluated answers show over- or underconfidence (§7.4, RF-AR-05;
// calibrationOf). Derived, never stored. Answers without an AI score
// (pending or failed) are left out.
export function sessionCalibration(
  answers: readonly Pick<RecallAnswer, "selfRating" | "aiScore">[],
): RecallSessionCalibration {
  let overconfident = 0;
  let underconfident = 0;
  for (const { selfRating, aiScore } of answers) {
    if (aiScore === null) continue;
    const calibration = calibrationOf(selfRating, aiScore);
    if (!calibration.ok) continue;
    if (calibration.value === "overconfident") overconfident += 1;
    if (calibration.value === "underconfident") underconfident += 1;
  }
  return { overconfident, underconfident };
}
