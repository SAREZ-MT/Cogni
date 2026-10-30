import type { PageTextReader } from "@/modules/notebooks";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import { type ExamQuestion, newExamQuestion } from "../domain/exam-question";
import {
  createExamQuestion,
  type ExamQuestionContent,
} from "./create-exam-question";
import { deleteExamQuestion } from "./delete-exam-question";
import { editExamQuestion, notFound } from "./edit-exam-question";
import {
  type ExamQuestionRepositories,
  type ExamUnitOfWork,
  runExamWork,
} from "./exam-unit-of-work";

// What the edit page's "Guardar" sends (Phase 8 H18): the local draft
// reduced to operations on the page's active questions.
export interface ExamEdits {
  pageId: string;
  // `expectedUpdatedAt`: the item's updatedAt when the edit page loaded
  // (ISO); a different stored one refuses the save (CHANGED, V10).
  updates: readonly ({
    id: string;
    expectedUpdatedAt?: string;
  } & ExamQuestionContent)[];
  creates: readonly ExamQuestionContent[];
  deletes: readonly string[];
}

export interface ExamEditsResult {
  // The page's active questions after saving, oldest first.
  questions: ExamQuestion[];
}

export interface ApplyExamEditsDeps {
  pages: PageTextReader;
  uow: ExamUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Applies an edit page draft in ONE unit of work, all or nothing, through
// the single-question use cases (editExamQuestion, createExamQuestion,
// deleteExamQuestion) run on the open transaction. Every question is
// validated before anything is written. Order: edits, additions, then
// deletions, so a save may replace every question as long as one root is
// left (EXAMS_LAST_QUESTION otherwise). Every edited or deleted id must be
// an active question of this page (EXAMS_QUESTION_NOT_FOUND). Deleting a
// question deletes its lineage, so a second deleted question of the same
// lineage is already gone and skipped.
export async function applyExamEdits(
  input: ExamEdits,
  deps: ApplyExamEditsDeps,
  ownerId: string,
): Promise<Result<ExamEditsResult, DomainError>> {
  const invalid = firstInvalid(input, deps.clock.now());
  if (invalid) return invalid;

  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  // The page was read above; the single-item use cases reuse that answer,
  // so nothing inside the transaction asks for a second connection (the
  // app's pool holds one: a read there would wait for it forever).
  const checkedPage = { getPageText: async () => page };

  return runExamWork(deps.uow, async (repos) => {
    const uow = sameTransaction(repos);
    const ids = [...input.updates.map((u) => u.id), ...input.deletes];
    const found = await repos.questions.listByIds(ids, ownerId);
    for (const id of ids) {
      const question = found.find((q) => q.id === id);
      if (
        !question ||
        question.pageId !== input.pageId ||
        question.retiredAt !== null
      ) {
        return notFound(id);
      }
      const expected = input.updates.find(
        (u) => u.id === id,
      )?.expectedUpdatedAt;
      if (
        expected !== undefined &&
        question.updatedAt.toISOString() !== expected
      ) {
        return err(
          new DomainError(
            EXAM_ERROR.CHANGED,
            `Exam question ${id} changed after the edit page loaded`,
          ),
        );
      }
    }
    for (const { id, expectedUpdatedAt: _, ...content } of input.updates) {
      const edited = await editExamQuestion(
        { questionId: id, ...content },
        { uow, clock: deps.clock },
        ownerId,
      );
      if (!edited.ok) return edited;
    }
    for (const content of input.creates) {
      const created = await createExamQuestion(
        { pageId: input.pageId, ...content },
        { ...deps, pages: checkedPage, uow },
        ownerId,
      );
      if (!created.ok) return created;
    }
    for (const id of input.deletes) {
      if (!(await repos.questions.findById(id, ownerId))) continue;
      const deleted = await deleteExamQuestion(
        { questionId: id },
        { uow },
        ownerId,
      );
      if (!deleted.ok) return deleted;
    }
    return ok({
      questions: await repos.questions.listActiveByPage(input.pageId, ownerId),
    });
  });
}

// The single-question use cases run on this transaction's repositories;
// their own runExamWork then only maps results (the outer one rolls back).
function sameTransaction(repos: ExamQuestionRepositories): ExamUnitOfWork {
  return { run: (work) => work(repos) };
}

// The first edit or addition the domain refuses, checked with
// newExamQuestion's rules (the same as an edit's).
function firstInvalid(
  input: ExamEdits,
  now: Date,
): Result<never, DomainError> | null {
  for (const content of [...input.updates, ...input.creates]) {
    const checked = newExamQuestion(
      {
        ...content,
        id: "probe",
        ownerId: "probe",
        pageId: input.pageId,
        origin: "manual",
        generationId: null,
      },
      now,
    );
    if (!checked.ok) return err(checked.error);
  }
  return null;
}
