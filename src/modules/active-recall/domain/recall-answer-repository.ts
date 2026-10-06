import type { RecallAnswer } from "./recall-answer";

// The resolved AI evaluation of one answer (§8.5): `done` carries the AI
// score and the combined quality; `failed` keeps the raw failed attempt and
// invents no score (user decision 2026-10-06). The raw evaluation is
// always kept for audit.
export type RecallEvaluationResult =
  | {
      readonly status: "done";
      readonly aiEvaluation: unknown;
      readonly aiScore: number;
      readonly combinedQuality: number;
      readonly generationId: string | null;
    }
  | {
      readonly status: "failed";
      readonly aiEvaluation: unknown;
      readonly generationId: string | null;
    };

// Persistence port for RecallAnswer (documento-maestro §6.1); owner-scoped.
// A session holds at most one answer per question.
export interface RecallAnswerRepository {
  // Saves the student's answer to a question of the session as it is given.
  // Inserts it, or replaces the text and self-rating (and updatedAt) of
  // the stored answer to that question, keeping its id and createdAt. An
  // answer already claimed for evaluation or resolved is read back
  // unchanged. Rejects (writing nothing) a session or question that is not
  // the owner's, or a question that is not on the session's page. Returns
  // the stored answer.
  upsert(answer: RecallAnswer): Promise<RecallAnswer>;
  // The session's answers, oldest first (createdAt, then id).
  listBySession(sessionId: string, ownerId: string): Promise<RecallAnswer[]>;
  // Claims the session's pending answers for one evaluation run and returns
  // them, oldest first. A pending answer is claimable when no run claimed
  // it or its claim is older than `staleBefore` (the run died); the claim
  // is stamped `now`. Concurrent runs never claim the same answer twice.
  claimPendingForEvaluation(
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<RecallAnswer[]>;
  // Resolves a pending answer with its evaluation and releases its claim.
  // An already resolved answer is read back unchanged. Rejects a score or
  // combined quality outside the integers 0–5. Returns the stored answer,
  // or null when the owner has no such answer.
  saveEvaluation(
    id: string,
    ownerId: string,
    result: RecallEvaluationResult,
    now: Date,
  ): Promise<RecallAnswer | null>;
  // Moves the session's failed answers back to pending, unclaimed, keeping
  // their raw failed attempt until a new evaluation replaces it
  // ("Reintentar", CU-09 alternate flow). Returns how many moved.
  requeueFailed(sessionId: string, ownerId: string, now: Date): Promise<number>;
  // "No estoy de acuerdo": records the disagreement and never touches the
  // score (§8.5). Idempotent. Returns the stored answer, or null when the
  // owner has no such answer.
  markDisagreed(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<RecallAnswer | null>;
}
