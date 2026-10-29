import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import { questionNotFound } from "./edit-recall-question";
import { type RecallUnitOfWork, runRecallWork } from "./recall-unit-of-work";

export interface DeleteRecallQuestionResult {
  pageId: string;
  // Active questions left on the page (always >= 1).
  remaining: number;
}

// Real delete of one question (Phase 8 H18, user 2026-10-29): the question,
// its answers (ON DELETE CASCADE), its StudyItem and, by cascade, the
// item's review logs, in one unit of work, so mastery and metrics stop
// counting it. The page's last active question cannot be deleted (the
// whole set goes with a separate action).
export async function deleteRecallQuestion(
  input: { questionId: string },
  deps: { uow: RecallUnitOfWork },
  ownerId: string,
): Promise<Result<DeleteRecallQuestionResult, DomainError>> {
  return runRecallWork(deps.uow, async ({ questions, studyItems }) => {
    const [question] = await questions.listByIds([input.questionId], ownerId);
    if (!question || question.archivedAt !== null) {
      return questionNotFound(input.questionId);
    }
    const active = await questions.listActiveByPage(question.pageId, ownerId);
    if (active.length <= 1) {
      return err(
        new DomainError(
          RECALL_ERROR.LAST_QUESTION,
          "A page with recall questions keeps at least one",
        ),
      );
    }
    await studyItems.deleteBySource("recall_question", question.id, ownerId);
    await questions.delete(question.id, ownerId);
    return ok({ pageId: question.pageId, remaining: active.length - 1 });
  });
}
