import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamAnswer, ExamSession } from "../domain/exam-session";
import {
  composeSessionQuestions,
  type ExamSessionUnitOfWork,
} from "./exam-session-work";

export interface ExamSessionQuestion {
  question: ExamQuestion;
  // Null while the question is unanswered.
  answer: ExamAnswer | null;
}

export interface ExamSessionDetail {
  session: ExamSession;
  questions: ExamSessionQuestion[];
}

// One of the owner's sessions with its questions in order: an open session
// in its composed order with the answers given so far (the player); a
// finished one from its answers, in answer order (the results; every
// question of a finished exam was answered). Questions retired after the
// exam still show. Read-only.
export async function readExamSession(
  input: { sessionId: string },
  deps: { uow: ExamSessionUnitOfWork },
  ownerId: string,
): Promise<Result<ExamSessionDetail, DomainError>> {
  return deps.uow.run(async (repos) => {
    const session = await repos.sessions.findById(input.sessionId, ownerId);
    if (!session) {
      return err(
        new DomainError(
          EXAM_ERROR.SESSION_NOT_FOUND,
          `exam session ${input.sessionId} not found`,
        ),
      );
    }
    const answers = await repos.answers.listBySession(session.id, ownerId);

    if (session.finishedAt !== null) {
      const questions: ExamSessionQuestion[] = [];
      for (const answer of answers) {
        const question = await repos.questions.findById(
          answer.questionId,
          ownerId,
        );
        if (question) questions.push({ question, answer });
      }
      return ok({ session, questions });
    }

    const composed = await composeSessionQuestions(session, repos);
    if (!composed.ok) return composed;
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
    return ok({
      session,
      questions: composed.value.map((question) => ({
        question,
        answer: byQuestion.get(question.id) ?? null,
      })),
    });
  });
}

export interface ExamPageOverview {
  // Roots with an active question: an exam needs at least 10.
  activeQuestionCount: number;
  retakePending: boolean;
  openSession: ExamSession | null;
  lastFinishedSession: ExamSession | null;
}

// What the exam start screen of a page needs. Owner-scoped: another
// owner's page reads as empty (the route checks the page first).
export async function getExamPageOverview(
  input: { pageId: string },
  deps: { uow: ExamSessionUnitOfWork },
  ownerId: string,
): Promise<Result<ExamPageOverview, DomainError>> {
  return deps.uow.run(async (repos) => {
    const active = await repos.questions.listActiveByPage(
      input.pageId,
      ownerId,
    );
    const state = await repos.pageStates.get(input.pageId, ownerId);
    const openSession = await repos.sessions.findOpenByPage(
      input.pageId,
      ownerId,
    );
    const finished = await repos.sessions.listFinishedByPage(
      input.pageId,
      ownerId,
    );
    return ok({
      activeQuestionCount: new Set(active.map((q) => q.rootId)).size,
      retakePending: state?.retakePending ?? false,
      openSession,
      lastFinishedSession: finished.at(-1) ?? null,
    });
  });
}
