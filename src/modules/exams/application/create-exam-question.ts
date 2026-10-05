import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { type ExamQuestion, newExamQuestion } from "../domain/exam-question";
import { type ExamUnitOfWork, runExamWork } from "./exam-unit-of-work";

export interface ExamQuestionContent {
  stem: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  concept: string;
}

export interface CreateExamQuestionDeps {
  pages: PageTextReader;
  uow: ExamUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Adds a hand-written question to a page (§3.3 "creadas manualmente"): a
// new root together with its StudyItem(kind = "exam_question", sourceId =
// root id), in one unit of work, so every root is scheduled from the
// moment it exists and recordExamReviews always finds its item.
export async function createExamQuestion(
  input: { pageId: string } & ExamQuestionContent,
  deps: CreateExamQuestionDeps,
  ownerId: string,
): Promise<Result<ExamQuestion, DomainError>> {
  // Missing, archived or another owner's page: PAGE_NOT_FOUND, no write.
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;

  const now = deps.clock.now();
  const question = newExamQuestion(
    {
      id: deps.ids.next(),
      ownerId,
      pageId: input.pageId,
      stem: input.stem,
      options: input.options,
      correctIndex: input.correctIndex,
      explanation: input.explanation,
      concept: input.concept,
      origin: "manual",
      generationId: null,
    },
    now,
  );
  if (!question.ok) return question;

  return runExamWork(deps.uow, async ({ questions, studyItems }) => {
    await questions.save(question.value);
    await studyItems.save(
      newStudyItem({
        id: deps.ids.next(),
        ownerId,
        pageId: input.pageId,
        kind: "exam_question",
        sourceId: question.value.rootId,
        now,
      }),
    );
    return ok(question.value);
  });
}
