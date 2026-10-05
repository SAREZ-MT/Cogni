import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import {
  type ExamQuestion,
  editExamQuestion as editQuestion,
} from "../domain/exam-question";
import type { ExamQuestionContent } from "./create-exam-question";
import { type ExamUnitOfWork, runExamWork } from "./exam-unit-of-work";

// A manual edit changes the question in place (§6.1): same id, root and
// origin, so the root's SM-2 history stays attached. A retired question
// cannot be edited; another owner's question reads as not found.
export async function editExamQuestion(
  input: { questionId: string } & ExamQuestionContent,
  deps: { uow: ExamUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<ExamQuestion, DomainError>> {
  return runExamWork(deps.uow, async ({ questions }) => {
    const stored = await questions.findById(input.questionId, ownerId);
    if (!stored) return notFound(input.questionId);

    const edited = editQuestion(
      stored,
      {
        stem: input.stem,
        options: input.options,
        correctIndex: input.correctIndex,
        explanation: input.explanation,
        concept: input.concept,
      },
      deps.clock.now(),
    );
    if (!edited.ok) return edited;

    const saved = await questions.update(edited.value);
    if (!saved) return notFound(input.questionId);
    return ok(saved);
  });
}

export function notFound(questionId: string) {
  return err(new DomainError(EXAM_ERROR.QUESTION_NOT_FOUND, questionId));
}
