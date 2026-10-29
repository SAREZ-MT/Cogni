import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import { notFound } from "./edit-exam-question";
import { type ExamUnitOfWork, runExamWork } from "./exam-unit-of-work";

export interface DeleteExamQuestionResult {
  pageId: string;
  // Roots with an active question left on the page (always >= 1).
  remaining: number;
}

// Real delete of one question (Phase 8 H18, user 2026-10-29), as the edit
// page shows it: a concept is its root's lineage, so the whole lineage
// goes (the root, its reformulated variants and every answer to them, by
// cascade), with the root's StudyItem and, by cascade, its review logs.
// Open exams showing one of its questions and the root's place in a
// pending retake go first (ExamLineageReferences). Mastery and metrics no
// longer count it. The page's last active root cannot be deleted (the
// whole set goes with a separate action). The lineage is locked first, as
// retireExamQuestion does.
export async function deleteExamQuestion(
  input: { questionId: string },
  deps: { uow: ExamUnitOfWork },
  ownerId: string,
): Promise<Result<DeleteExamQuestionResult, DomainError>> {
  return runExamWork(
    deps.uow,
    async ({ questions, studyItems, lineageRefs }) => {
      const found = await questions.findById(input.questionId, ownerId);
      if (!found) return notFound(input.questionId);
      await questions.lockLineage(found.rootId, ownerId);

      const active = await questions.listActiveByPage(found.pageId, ownerId);
      const roots = new Set(active.map((question) => question.rootId));
      roots.delete(found.rootId);
      if (roots.size === 0) {
        return err(
          new DomainError(
            EXAM_ERROR.LAST_QUESTION,
            "A page with exam questions keeps at least one",
          ),
        );
      }

      const lineage = await questions.listLineage(found.rootId, ownerId);
      await lineageRefs.dropLineage(
        {
          pageId: found.pageId,
          rootId: found.rootId,
          questionIds: lineage.map((question) => question.id),
        },
        ownerId,
      );
      await studyItems.deleteBySource("exam_question", found.rootId, ownerId);
      await questions.deleteLineage(found.rootId, ownerId);
      return ok({ pageId: found.pageId, remaining: roots.size });
    },
  );
}
