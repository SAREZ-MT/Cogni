import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "./errors";
import {
  EXAM_PASS_THRESHOLD,
  type ExamAnswer,
  type ExamPageState,
} from "./exam-session";

// The threshold as whole percent, so `passed` is decided with integers and
// never by a float product such as 0.7 * 30 = 20.999… (§7.5: >= 0.70).
const PASS_PERCENT = Math.round(EXAM_PASS_THRESHOLD * 100);

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
  // Roots answered wrong, once each, in answer order. Reported on a pass
  // too (the feedback explains them); only a failure keeps them pending.
  readonly failedRootIds: readonly string[];
  readonly nextState: ExamPageState;
}

// Scores a finished exam and derives the page's next ExamPageState (§7.5):
//   score < 0.70  → retake pending with the failed roots; the last pass stays.
//   score >= 0.70 → nothing pending; this session becomes the last pass.
export function scoreExam(
  input: ScoreExamInput,
): Result<ExamScore, DomainError> {
  const { answers, previous, sessionId } = input;
  if (answers.length === 0) {
    return err(
      new DomainError(EXAM_ERROR.NO_ANSWERS, "an exam needs answers to score"),
    );
  }
  const foreign = answers.find((answer) => answer.sessionId !== sessionId);
  if (foreign) {
    return err(
      new DomainError(
        EXAM_ERROR.INVALID_ANSWER,
        `answer to ${foreign.questionId} belongs to session ${foreign.sessionId}`,
      ),
    );
  }

  const total = answers.length;
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const passed = correct * 100 >= total * PASS_PERCENT;
  const failedRootIds = [
    ...new Set(answers.filter((a) => !a.isCorrect).map((a) => a.rootId)),
  ];

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
