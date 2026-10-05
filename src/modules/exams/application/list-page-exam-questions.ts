import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamQuestionRepository } from "../domain/exam-question-repository";

// The questions of a page that can still be shown (retired ones excluded),
// oldest first, for the owner. Another owner's page reads as empty: the
// repository is owner-scoped.
export async function listPageExamQuestions(
  input: { pageId: string },
  deps: { questions: Pick<ExamQuestionRepository, "listActiveByPage"> },
  ownerId: string,
): Promise<Result<ExamQuestion[], DomainError>> {
  return ok(await deps.questions.listActiveByPage(input.pageId, ownerId));
}
