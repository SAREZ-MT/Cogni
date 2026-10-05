import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "./errors";
import { EXAM_OPTION_COUNT } from "./exam-question";

// The student picks N in [10, 30] questions, 10 by default (user decision
// 2026-10-05, refining §3.3). An exam passes iff score >= 0.70 (§7.5).
export const EXAM_MIN_QUESTIONS = 10;
export const EXAM_MAX_QUESTIONS = 30;
export const EXAM_DEFAULT_QUESTIONS = 10;
export const EXAM_PASS_THRESHOLD = 0.7;

export function isValidQuestionCount(count: number): boolean {
  return (
    Number.isInteger(count) &&
    count >= EXAM_MIN_QUESTIONS &&
    count <= EXAM_MAX_QUESTIONS
  );
}

// One exam attempt on a page (documento-maestro §6.1). The result fields are
// null until the session is finished; an abandoned session stays open.
export interface ExamSession {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly requestedCount: number;
  readonly isRetake: boolean;
  readonly retakeOfSessionId: string | null;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly total: number | null;
  readonly correct: number | null;
  // correct / total, 0 to 1.
  readonly score: number | null;
  readonly passed: boolean | null;
}

export interface NewExamSessionInput {
  id: string;
  ownerId: string;
  pageId: string;
  requestedCount: number;
  // The failed session this one retakes; null for an ordinary attempt.
  retakeOfSessionId: string | null;
}

export interface ExamSessionResult {
  total: number;
  correct: number;
  score: number;
  passed: boolean;
}

export function newExamSession(
  input: NewExamSessionInput,
  now: Date,
): Result<ExamSession, DomainError> {
  if (!isValidQuestionCount(input.requestedCount)) {
    return err(invalidCount(input.requestedCount));
  }
  return ok({
    ...input,
    isRetake: input.retakeOfSessionId !== null,
    startedAt: now,
    finishedAt: null,
    total: null,
    correct: null,
    score: null,
    passed: null,
  });
}

export function finishExamSession(
  session: ExamSession,
  result: ExamSessionResult,
  now: Date,
): Result<ExamSession, DomainError> {
  if (session.finishedAt !== null) {
    return err(
      new DomainError(
        EXAM_ERROR.SESSION_FINISHED,
        `exam session ${session.id} is already finished`,
      ),
    );
  }
  return ok({ ...session, ...result, finishedAt: now });
}

// Elapsed time shown by the results screen (user decision 2026-10-05: the
// only place a time metric is shown). Null while the session is open.
export function examSessionDurationMs(session: ExamSession): number | null {
  if (session.finishedAt === null) return null;
  return session.finishedAt.getTime() - session.startedAt.getTime();
}

// One graded answer. `questionId` is the wording actually shown (maybe a
// variant); `rootId` is the lineage whose StudyItem the answer feeds.
export interface ExamAnswer {
  readonly sessionId: string;
  readonly questionId: string;
  readonly rootId: string;
  readonly selectedIndex: number;
  readonly isCorrect: boolean;
  readonly answeredAt: Date;
}

export interface GradeExamAnswerInput {
  sessionId: string;
  question: { id: string; rootId: string; correctIndex: number };
  selectedIndex: number;
  answeredAt: Date;
}

// Deterministic correction (§3.3): correct iff the chosen option is the
// question's correct index.
export function gradeExamAnswer(
  input: GradeExamAnswerInput,
): Result<ExamAnswer, DomainError> {
  const { selectedIndex } = input;
  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= EXAM_OPTION_COUNT
  ) {
    return err(
      new DomainError(
        EXAM_ERROR.INVALID_ANSWER,
        `selected index must be 0 to ${EXAM_OPTION_COUNT - 1}`,
      ),
    );
  }
  return ok({
    sessionId: input.sessionId,
    questionId: input.question.id,
    rootId: input.question.rootId,
    selectedIndex,
    isCorrect: selectedIndex === input.question.correctIndex,
    answeredAt: input.answeredAt,
  });
}

// Per-page exam state (§6.1): whether a retake is pending, the roots failed
// in the last failed exam, and the last passing session.
export interface ExamPageState {
  readonly pageId: string;
  readonly ownerId: string;
  readonly retakePending: boolean;
  readonly failedRootIds: readonly string[];
  readonly lastPassedSessionId: string | null;
}

export function initialExamPageState(
  pageId: string,
  ownerId: string,
): ExamPageState {
  return {
    pageId,
    ownerId,
    retakePending: false,
    failedRootIds: [],
    lastPassedSessionId: null,
  };
}

export function invalidCount(count: number): DomainError {
  return new DomainError(
    EXAM_ERROR.INVALID_QUESTION_COUNT,
    `an exam holds ${EXAM_MIN_QUESTIONS} to ${EXAM_MAX_QUESTIONS} questions, got ${count}`,
  );
}
