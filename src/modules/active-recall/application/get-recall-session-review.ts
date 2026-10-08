import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import type { RecallAnswerRepository } from "../domain/recall-answer-repository";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";
import type { RecallSessionRepository } from "../domain/recall-session-repository";

// One answered (or skipped) question of a past session, as the results
// view lists it.
export interface RecallReviewRecord {
  questionId: string;
  prompt: string;
  answerText: string;
  selfRating: number;
}

export interface RecallSessionReview {
  sessionId: string;
  pageId: string;
  // In answer order (oldest first).
  records: RecallReviewRecord[];
}

export interface RecallSessionReviewDeps {
  sessions: Pick<RecallSessionRepository, "findById">;
  answers: Pick<RecallAnswerRepository, "listBySession">;
  questions: Pick<RecallQuestionRepository, "listByIds">;
}

// A past session's questions and answers (documento-maestro §3.3: a
// finished session is a durable record), so its results can be opened
// again from the notebook view; the evaluation itself is polled by the
// results view (getRecallSessionResults). Questions archived since keep
// showing. An unknown, foreign or still open session, or one of another
// page: RECALL_SESSION_NOT_FOUND.
export async function getRecallSessionReview(
  input: { pageId: string; sessionId: string },
  deps: RecallSessionReviewDeps,
  ownerId: string,
): Promise<Result<RecallSessionReview, DomainError>> {
  const session = await deps.sessions.findById(input.sessionId, ownerId);
  if (!session || session.pageId !== input.pageId || !session.finishedAt) {
    return err(
      new DomainError(
        RECALL_ERROR.SESSION_NOT_FOUND,
        `recall session ${input.sessionId} not found`,
      ),
    );
  }
  const answers = await deps.answers.listBySession(session.id, ownerId);
  const questions = await deps.questions.listByIds(
    answers.map((answer) => answer.questionId),
    ownerId,
  );
  const promptOf = new Map(questions.map((q) => [q.id, q.prompt]));
  return ok({
    sessionId: session.id,
    pageId: session.pageId,
    records: answers.flatMap((answer) => {
      const prompt = promptOf.get(answer.questionId);
      if (prompt === undefined) return [];
      return [
        {
          questionId: answer.questionId,
          prompt,
          answerText: answer.answerText,
          selfRating: answer.selfRating,
        },
      ];
    }),
  });
}
