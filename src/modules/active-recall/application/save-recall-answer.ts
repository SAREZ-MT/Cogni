import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallAnswer, type RecallAnswer } from "../domain/recall-answer";
import {
  lockSession,
  type RecallSessionUnitOfWork,
} from "./recall-session-work";
import { runRecallWork } from "./recall-unit-of-work";

export interface SaveRecallAnswerDeps {
  uow: RecallSessionUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

export interface SaveRecallAnswerInput {
  sessionId: string;
  questionId: string;
  // A blank text or the skip marker is stored as the skip marker ("Saltar").
  answerText: string;
  // 0 = impossible, 5 = trivial.
  selfRating: number;
}

// Saves one answer of an open session as it is given (§8.5: answers are
// persisted before any evaluation, so progress survives a provider
// failure). One answer per (session, question): saving again replaces its
// text and self-rating. The session row is locked first, so a save and a
// finish of the same session queue and no answer lands in a finished one.
//
// - Missing or another owner's session: RECALL_SESSION_NOT_FOUND.
// - Finished session: RECALL_SESSION_FINISHED.
// - The question must be the owner's and on the session's page (a question
//   archived after the session showed it still counts):
//   RECALL_QUESTION_NOT_IN_SESSION.
// - A self-rating outside the integers 0–5: RECALL_INVALID_ANSWER.
// Nothing is written on a refusal.
export async function saveRecallAnswer(
  input: SaveRecallAnswerInput,
  deps: SaveRecallAnswerDeps,
  ownerId: string,
): Promise<Result<RecallAnswer, DomainError>> {
  return runRecallWork(deps.uow, async (repos) => {
    const session = await lockSession(input.sessionId, ownerId, repos);
    if (!session.ok) return session;
    if (session.value.finishedAt !== null) {
      return err(
        new DomainError(
          RECALL_ERROR.SESSION_FINISHED,
          `recall session ${input.sessionId} is already finished`,
        ),
      );
    }
    const [question] = await repos.questions.listByIds(
      [input.questionId],
      ownerId,
    );
    if (!question || question.pageId !== session.value.pageId) {
      return err(
        new DomainError(
          RECALL_ERROR.QUESTION_NOT_IN_SESSION,
          `question ${input.questionId} is not on the page of session ${input.sessionId}`,
        ),
      );
    }
    const answer = newRecallAnswer(
      {
        id: deps.ids.next(),
        ownerId,
        sessionId: input.sessionId,
        questionId: input.questionId,
        answerText: input.answerText,
        selfRating: input.selfRating,
      },
      deps.clock.now(),
    );
    if (!answer.ok) return answer;
    return ok(await repos.answers.upsert(answer.value));
  });
}
