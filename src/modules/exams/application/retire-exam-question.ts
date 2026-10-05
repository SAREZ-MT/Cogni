import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { ExamQuestion } from "../domain/exam-question";
import { notFound } from "./edit-exam-question";
import { type ExamUnitOfWork, runExamWork } from "./exam-unit-of-work";

// Logical delete of one question (§6.1: questions are retired, never
// deleted, so answers and lineages keep their rows). When the question's
// lineage has no active question left, the root's StudyItem is suspended
// in the same unit of work, so the concept leaves "Hoy". Idempotent: an
// already retired question keeps its first retiredAt and answers ok.
export async function retireExamQuestion(
  input: { questionId: string },
  deps: { uow: ExamUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<ExamQuestion, DomainError>> {
  return runExamWork(deps.uow, async ({ questions, studyItems }) => {
    const now = deps.clock.now();
    const retired = await questions.retire(input.questionId, ownerId, now);
    if (!retired) return notFound(input.questionId);

    const lineage = await questions.listLineage(retired.rootId, ownerId);
    if (lineage.every((question) => question.retiredAt !== null)) {
      const item = await studyItems.findBySource(
        "exam_question",
        retired.rootId,
        ownerId,
      );
      if (item) await studyItems.suspend(item.id, ownerId, now);
    }
    return ok(retired);
  });
}
