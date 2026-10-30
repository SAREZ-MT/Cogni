import type { DueCutoff } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import {
  type ExamSession,
  finishExamSession,
  initialExamPageState,
} from "../domain/exam-session";
import { scoreExam } from "../domain/scoring";
import { lockOpenSession } from "./answer-exam-question";
import type { ExamSessionUnitOfWork } from "./exam-session-work";
import { runExamWork } from "./exam-unit-of-work";

export interface CompleteExamSessionDeps {
  uow: ExamSessionUnitOfWork;
  clock: Clock;
  // The owner's per-day "due" bound (start of their next local day): a
  // correct answer to a root due later today reviews it.
  dueCutoff: DueCutoff;
}

export interface CompletedExamSession {
  session: ExamSession;
  // Roots answered wrong, in answer order.
  failedRootIds: readonly string[];
}

// Ends an exam (§7.5) in one transaction:
//   1. lock the session row (FOR UPDATE) and refuse a missing or finished
//      one (EXAMS_SESSION_FINISHED), so two finishes never both score it;
//   2. every question of the session's stored list must be answered
//      (EXAMS_SESSION_INCOMPLETE): the player reveals each answer as it is
//      given, so an exam ends only when all its questions are answered and
//      score = correct / total counts every question of the exam;
//   3. derive the result from the answers (finishExamSession) and the next
//      ExamPageState (scoreExam: < 70 % → retake pending with the failed
//      roots; otherwise cleared and this session is the last pass);
//   4. record every answered root on the SM-2 engine (recordExamReviews,
//      wrong → q = 1, correct → q = 4 only if due) in the same transaction.
// Any refusal or failure rolls all of it back: the session stays open.
export async function completeExamSession(
  input: { sessionId: string },
  deps: CompleteExamSessionDeps,
  ownerId: string,
): Promise<Result<CompletedExamSession, DomainError>> {
  return runExamWork(deps.uow, async (repos) => {
    const session = await lockOpenSession(input.sessionId, ownerId, repos);
    if (!session.ok) return session;
    const { pageId } = session.value;

    const answers = await repos.answers.listBySession(input.sessionId, ownerId);
    const answered = new Set(answers.map((answer) => answer.questionId));
    const missing = session.value.questionIds.filter(
      (id) => !answered.has(id),
    ).length;
    if (missing > 0) {
      return err(
        new DomainError(
          EXAM_ERROR.SESSION_INCOMPLETE,
          `exam session ${input.sessionId} has ${missing} unanswered questions`,
        ),
      );
    }

    const now = deps.clock.now();
    const finished = finishExamSession(session.value, answers, now);
    if (!finished.ok) return finished;
    const previous =
      (await repos.pageStates.get(pageId, ownerId)) ??
      initialExamPageState(pageId, ownerId);
    const score = scoreExam({
      sessionId: input.sessionId,
      answers,
      previous,
    });
    if (!score.ok) return score;

    await repos.sessions.finish(finished.value);
    await repos.pageStates.upsert(score.value.nextState);
    const reviews = await repos.reviews.record({
      ownerId,
      sessionId: input.sessionId,
      pageId,
      answers: answers.map((answer) => ({
        rootId: answer.rootId,
        correct: answer.isCorrect,
      })),
      now,
      dueBefore: deps.dueCutoff(now),
    });
    if (!reviews.ok) return reviews;
    return ok({
      session: finished.value,
      failedRootIds: score.value.failedRootIds,
    });
  });
}
