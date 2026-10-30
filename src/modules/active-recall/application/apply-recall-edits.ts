import type { PageTextReader } from "@/modules/notebooks";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import {
  editRecallQuestion as editQuestion,
  type RecallQuestion,
} from "../domain/recall-question";
import { createRecallQuestion } from "./create-recall-question";
import { deleteRecallQuestion } from "./delete-recall-question";
import {
  editRecallQuestion,
  questionNotFound,
  type RecallQuestionContent,
} from "./edit-recall-question";
import {
  type RecallQuestionRepositories,
  type RecallUnitOfWork,
  runRecallWork,
} from "./recall-unit-of-work";

// What the edit page's "Guardar" sends (Phase 8 H18): the local draft
// reduced to operations on the page's recall questions.
export interface RecallEdits {
  pageId: string;
  // `expectedUpdatedAt`: the item's updatedAt when the edit page loaded
  // (ISO); a different stored one refuses the save (CHANGED, V10).
  updates: readonly ({
    id: string;
    expectedUpdatedAt?: string;
  } & RecallQuestionContent)[];
  creates: readonly RecallQuestionContent[];
  deletes: readonly string[];
}

export interface RecallEditsResult {
  // The page's active questions after saving, oldest first.
  questions: RecallQuestion[];
}

export interface ApplyRecallEditsDeps {
  pages: PageTextReader;
  uow: RecallUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

// Applies an edit page draft in ONE unit of work, all or nothing, through
// the single-question use cases (editRecallQuestion, createRecallQuestion,
// deleteRecallQuestion) run on the open transaction. Every question is
// validated before anything is written. Order: edits, additions, then
// deletions, so a save may replace every question as long as one is left
// (RECALL_LAST_QUESTION otherwise). Every edited or deleted id must be an
// active question of this page (RECALL_QUESTION_NOT_FOUND).
export async function applyRecallEdits(
  input: RecallEdits,
  deps: ApplyRecallEditsDeps,
  ownerId: string,
): Promise<Result<RecallEditsResult, DomainError>> {
  const invalid = firstInvalid(input, deps.clock.now());
  if (invalid) return invalid;

  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  // The page was read above; the single-item use cases reuse that answer,
  // so nothing inside the transaction asks for a second connection (the
  // app's pool holds one: a read there would wait for it forever).
  const checkedPage = { getPageText: async () => page };

  return runRecallWork(deps.uow, async (repos) => {
    const uow = sameTransaction(repos);
    await repos.questions.lockPage(input.pageId, ownerId);
    const ids = [...input.updates.map((u) => u.id), ...input.deletes];
    const found = await repos.questions.listByIds(ids, ownerId);
    for (const id of ids) {
      const question = found.find((q) => q.id === id);
      if (
        !question ||
        question.pageId !== input.pageId ||
        question.archivedAt !== null
      ) {
        return questionNotFound(id);
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
            RECALL_ERROR.CHANGED,
            `Recall question ${id} changed after the edit page loaded`,
          ),
        );
      }
    }
    for (const { id, expectedUpdatedAt: _, ...content } of input.updates) {
      const edited = await editRecallQuestion(
        { questionId: id, ...content },
        { uow, clock: deps.clock },
        ownerId,
      );
      if (!edited.ok) return edited;
    }
    for (const content of input.creates) {
      const created = await createRecallQuestion(
        { pageId: input.pageId, ...content },
        { ...deps, pages: checkedPage, uow },
        ownerId,
      );
      if (!created.ok) return created;
    }
    for (const id of input.deletes) {
      const deleted = await deleteRecallQuestion(
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
// their own runRecallWork then only maps results (the outer one rolls back).
function sameTransaction(repos: RecallQuestionRepositories): RecallUnitOfWork {
  return { run: (work) => work(repos) };
}

// The first edit or addition the domain refuses, checked with
// editRecallQuestion's rules on a throwaway question.
function firstInvalid(
  input: RecallEdits,
  now: Date,
): Result<never, DomainError> | null {
  const probe: RecallQuestion = {
    id: "probe",
    ownerId: "probe",
    pageId: input.pageId,
    prompt: "x",
    rubric: { keyConcepts: ["x"], acceptableAnswerSummary: "x" },
    origin: "manual",
    generationId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  for (const content of [...input.updates, ...input.creates]) {
    const checked = editQuestion(
      probe,
      {
        prompt: content.prompt,
        rubric: {
          keyConcepts: content.keyConcepts,
          acceptableAnswerSummary: content.acceptableAnswerSummary,
        },
      },
      now,
    );
    if (!checked.ok) return err(checked.error);
  }
  return null;
}
