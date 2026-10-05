import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import type { ExamSession } from "../domain/exam-session";
import { gradeExamAnswer } from "../domain/exam-session";
import {
  composeSessionQuestions,
  type ExamSessionRepositories,
  type ExamSessionUnitOfWork,
} from "./exam-session-work";
import { runExamWork } from "./exam-unit-of-work";

export interface AnswerExamQuestionDeps {
  uow: ExamSessionUnitOfWork;
  clock: Clock;
}

export interface AnsweredExamQuestion {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  // Revealed once answered: the player shows right/wrong per question.
  correctIndex: number;
  explanation: string;
  concept: string;
}

// Grades one answer of an open session (§3.3, deterministic correction) and
// stores it. The session row is locked first, so an answer and a finish of
// the same session queue: no answer lands in a finished session. One answer
// per question (and per root); the question must be one of the session's.
// SM-2 is untouched here: the reviews are recorded when the session ends.
export async function answerExamQuestion(
  input: { sessionId: string; questionId: string; selectedIndex: number },
  deps: AnswerExamQuestionDeps,
  ownerId: string,
): Promise<Result<AnsweredExamQuestion, DomainError>> {
  return runExamWork(deps.uow, async (repos) => {
    const session = await lockOpenSession(input.sessionId, ownerId, repos);
    if (!session.ok) return session;

    const questions = await composeSessionQuestions(session.value, repos);
    if (!questions.ok) return questions;
    const question = questions.value.find((q) => q.id === input.questionId);
    if (!question) {
      return err(
        new DomainError(
          EXAM_ERROR.QUESTION_NOT_IN_SESSION,
          `question ${input.questionId} is not in session ${input.sessionId}`,
        ),
      );
    }
    const answers = await repos.answers.listBySession(input.sessionId, ownerId);
    if (answers.some((answer) => answer.rootId === question.rootId)) {
      return err(
        new DomainError(
          EXAM_ERROR.DUPLICATE_ANSWER,
          `question ${question.id} was already answered`,
        ),
      );
    }

    const graded = gradeExamAnswer({
      sessionId: input.sessionId,
      question,
      selectedIndex: input.selectedIndex,
      answeredAt: deps.clock.now(),
    });
    if (!graded.ok) return graded;
    await repos.answers.saveMany([graded.value], ownerId);
    return ok({
      questionId: question.id,
      selectedIndex: graded.value.selectedIndex,
      isCorrect: graded.value.isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      concept: question.concept,
    });
  });
}

// The owner's session, row-locked, refused when missing or finished.
export async function lockOpenSession(
  sessionId: string,
  ownerId: string,
  repos: Pick<ExamSessionRepositories, "sessions">,
): Promise<Result<ExamSession, DomainError>> {
  const session = await repos.sessions.lockById(sessionId, ownerId);
  if (!session) {
    return err(
      new DomainError(
        EXAM_ERROR.SESSION_NOT_FOUND,
        `exam session ${sessionId} not found`,
      ),
    );
  }
  if (session.finishedAt !== null) {
    return err(
      new DomainError(
        EXAM_ERROR.SESSION_FINISHED,
        `exam session ${sessionId} is already finished`,
      ),
    );
  }
  return ok(session);
}
