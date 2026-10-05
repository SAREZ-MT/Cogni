import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  type ExamAnswer,
  type ExamPageState,
  isPassingScore,
  tallyAnswers,
} from "./exam-session";

export interface ScoreExamInput {
  sessionId: string;
  answers: readonly ExamAnswer[];
  previous: ExamPageState;
}

export interface ExamScore {
  readonly total: number;
  readonly correct: number;
  readonly score: number;
  readonly passed: boolean;
  // Roots answered wrong, in answer order (one answer per root). Reported
  // on a pass too (the feedback explains them); only a failure keeps them
  // pending.
  readonly failedRootIds: readonly string[];
  readonly nextState: ExamPageState;
}

// Scores a finished exam and derives the page's next ExamPageState (§7.5):
//   score < 0.70  → retake pending with the failed roots; the last pass stays.
//   score >= 0.70 → nothing pending; this session becomes the last pass.
// Refuses no answers, an answer of another session and two answers to one
// question or root (see tallyAnswers).
export function scoreExam(
  input: ScoreExamInput,
): Result<ExamScore, DomainError> {
  const { answers, previous, sessionId } = input;
  const tally = tallyAnswers(sessionId, answers);
  if (!tally.ok) return tally;
  const { total, correct } = tally.value;
  const passed = isPassingScore(correct, total);
  const failedRootIds = answers
    .filter((answer) => !answer.isCorrect)
    .map((answer) => answer.rootId);

  const nextState: ExamPageState = passed
    ? {
        ...previous,
        retakePending: false,
        failedRootIds: [],
        lastPassedSessionId: sessionId,
      }
    : { ...previous, retakePending: true, failedRootIds };

  return ok({
    total,
    correct,
    score: correct / total,
    passed,
    failedRootIds,
    nextState,
  });
}
