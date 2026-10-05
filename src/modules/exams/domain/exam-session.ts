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

// The threshold as whole percent, so a pass is decided with integers and
// never by a float product such as 0.7 * 30 = 20.999… (§7.5: >= 0.70).
const PASS_PERCENT = Math.round(EXAM_PASS_THRESHOLD * 100);

export function isPassingScore(correct: number, total: number): boolean {
  return correct * 100 >= total * PASS_PERCENT;
}

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
  // The questions shown, in order, fixed at the start (composeExam for a
  // normal exam, the fresh variants for a retake): answering, finishing
  // and reading the session use this list only, never a new composition.
  readonly questionIds: readonly string[];
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
  // 1 to requestedCount distinct question ids, in the order shown.
  questionIds: readonly string[];
}

export function newExamSession(
  input: NewExamSessionInput,
  now: Date,
): Result<ExamSession, DomainError> {
  if (!isValidQuestionCount(input.requestedCount)) {
    return err(invalidCount(input.requestedCount));
  }
  const { questionIds } = input;
  if (
    questionIds.length === 0 ||
    questionIds.length > input.requestedCount ||
    new Set(questionIds).size !== questionIds.length
  ) {
    return err(
      new DomainError(
        EXAM_ERROR.INVALID_SESSION_QUESTIONS,
        `an exam session holds 1 to ${input.requestedCount} distinct questions, got ${questionIds.length}`,
      ),
    );
  }
  return ok({
    ...input,
    questionIds: [...questionIds],
    isRetake: input.retakeOfSessionId !== null,
    startedAt: now,
    finishedAt: null,
    total: null,
    correct: null,
    score: null,
    passed: null,
  });
}

// Closes the session with the result derived from its answers, so the
// stored total, correct, score and passed can never disagree. Refuses a
// session already finished, no answers, an answer of another session, two
// answers to one question or root, more answers than requested questions
// (fewer is fine: the exam holds min(N, roots)), and a finish before the
// start.
export function finishExamSession(
  session: ExamSession,
  answers: readonly ExamAnswer[],
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
  const tally = tallyAnswers(session.id, answers);
  if (!tally.ok) return tally;
  const { total, correct } = tally.value;
  if (total > session.requestedCount) {
    return invalidFinish(
      `exam session ${session.id} requested ${session.requestedCount} questions, got ${total} answers`,
    );
  }
  if (now.getTime() < session.startedAt.getTime()) {
    return invalidFinish(
      `exam session ${session.id} cannot finish before it started`,
    );
  }
  return ok({
    ...session,
    finishedAt: now,
    total,
    correct,
    score: correct / total,
    passed: isPassingScore(correct, total),
  });
}

export interface AnswerTally {
  readonly total: number;
  readonly correct: number;
}

// Checks the answers of one session and counts them: at least one, all of
// `sessionId`, and one per question and per root.
export function tallyAnswers(
  sessionId: string,
  answers: readonly ExamAnswer[],
): Result<AnswerTally, DomainError> {
  if (answers.length === 0) {
    return err(
      new DomainError(EXAM_ERROR.NO_ANSWERS, "an exam needs answers to score"),
    );
  }
  const questions = new Set<string>();
  const roots = new Set<string>();
  for (const answer of answers) {
    if (answer.sessionId !== sessionId) {
      return err(
        new DomainError(
          EXAM_ERROR.INVALID_ANSWER,
          `answer to ${answer.questionId} belongs to session ${answer.sessionId}`,
        ),
      );
    }
    if (questions.has(answer.questionId) || roots.has(answer.rootId)) {
      return err(
        new DomainError(
          EXAM_ERROR.DUPLICATE_ANSWER,
          `session ${sessionId} has two answers to question ${answer.questionId} or root ${answer.rootId}`,
        ),
      );
    }
    questions.add(answer.questionId);
    roots.add(answer.rootId);
  }
  return ok({
    total: answers.length,
    correct: answers.filter((answer) => answer.isCorrect).length,
  });
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

function invalidFinish(message: string) {
  return err(new DomainError(EXAM_ERROR.INVALID_SESSION_FINISH, message));
}

export function invalidCount(count: number): DomainError {
  return new DomainError(
    EXAM_ERROR.INVALID_QUESTION_COUNT,
    `an exam holds ${EXAM_MIN_QUESTIONS} to ${EXAM_MAX_QUESTIONS} questions, got ${count}`,
  );
}
