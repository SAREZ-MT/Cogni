import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  newRecallQuestion,
  type RecallQuestion,
} from "../domain/recall-question";
import type { RecallQuestionContent } from "./edit-recall-question";
import { type RecallUnitOfWork, runRecallWork } from "./recall-unit-of-work";

export interface CreateRecallQuestionDeps {
  pages: PageTextReader;
  uow: RecallUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Adds a hand-written question to a page together with its
// StudyItem(kind = "recall_question"), in one unit of work (Phase 8 H18,
// user 2026-10-29: questions are born from AI; the edit page may add one).
export async function createRecallQuestion(
  input: { pageId: string } & RecallQuestionContent,
  deps: CreateRecallQuestionDeps,
  ownerId: string,
): Promise<Result<RecallQuestion, DomainError>> {
  // Missing, archived or another owner's page: PAGE_NOT_FOUND, no write.
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;

  const now = deps.clock.now();
  const question = newRecallQuestion(
    {
      id: deps.ids.next(),
      ownerId,
      pageId: input.pageId,
      prompt: input.prompt,
      rubric: {
        keyConcepts: input.keyConcepts,
        acceptableAnswerSummary: input.acceptableAnswerSummary,
      },
      origin: "manual",
      generationId: null,
    },
    now,
  );
  if (!question.ok) return question;

  return runRecallWork(deps.uow, async ({ questions, studyItems }) => {
    await questions.saveMany([question.value]);
    await studyItems.save(
      newStudyItem({
        id: deps.ids.next(),
        ownerId,
        pageId: input.pageId,
        kind: "recall_question",
        sourceId: question.value.id,
        now,
      }),
    );
    return ok(question.value);
  });
}
