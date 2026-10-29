import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import {
  editRecallQuestion as editQuestion,
  type RecallQuestion,
} from "../domain/recall-question";
import { type RecallUnitOfWork, runRecallWork } from "./recall-unit-of-work";

// What the edit page holds per question (Phase 8 H18): the prompt and its
// rubric, flattened.
export interface RecallQuestionContent {
  prompt: string;
  keyConcepts: readonly string[];
  acceptableAnswerSummary: string;
}

// Rewrites one question's prompt and rubric in place (Phase 8 H18 edit
// page): same id, origin and generation, so its study item and its review
// history stay attached. An archived question or another owner's reads as
// not found.
export async function editRecallQuestion(
  input: { questionId: string } & RecallQuestionContent,
  deps: { uow: RecallUnitOfWork; clock: Clock },
  ownerId: string,
): Promise<Result<RecallQuestion, DomainError>> {
  return runRecallWork(deps.uow, async ({ questions }) => {
    const [stored] = await questions.listByIds([input.questionId], ownerId);
    if (!stored || stored.archivedAt !== null) {
      return questionNotFound(input.questionId);
    }
    const edited = editQuestion(
      stored,
      {
        prompt: input.prompt,
        rubric: {
          keyConcepts: input.keyConcepts,
          acceptableAnswerSummary: input.acceptableAnswerSummary,
        },
      },
      deps.clock.now(),
    );
    if (!edited.ok) return edited;
    const saved = await questions.update(edited.value);
    if (!saved) return questionNotFound(input.questionId);
    return ok(saved);
  });
}

export function questionNotFound(questionId: string) {
  return err(new DomainError(RECALL_ERROR.QUESTION_NOT_FOUND, questionId));
}
