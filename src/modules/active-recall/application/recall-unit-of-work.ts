import type { StudyItemRepository } from "@/modules/study-engine";
import type { Result } from "@/shared/kernel/result";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";

// The slice of StudyItemRepository a question generation needs: every
// question owns one StudyItem(kind = "recall_question", sourceId =
// question id) (documento-maestro §6.1), created with it.
export type RecallStudyItems = Pick<StudyItemRepository, "save">;

export interface RecallQuestionRepositories {
  readonly questions: RecallQuestionRepository;
  readonly studyItems: RecallStudyItems;
}

// Unit of work over a page's questions and their study items: everything
// `work` writes through the given repositories commits together, and a
// thrown error rolls it back. Questions and study items live in two
// modules, so the transaction boundary is this port.
export interface RecallUnitOfWork {
  run<T>(
    work: (repositories: RecallQuestionRepositories) => Promise<T>,
  ): Promise<T>;
}

// Carries an err Result out of RecallUnitOfWork.run as a throw, so the
// unit of work rolls back; runRecallWork turns it back into the Result.
class RollbackSignal<E> extends Error {
  constructor(readonly result: Result<never, E>) {
    super("recall unit of work rolled back by an err result");
    this.name = "RollbackSignal";
  }
}

// Runs a Result-returning work in one unit of work. Returning err from
// inside `run` would commit whatever was written before the refusal, so an
// err rolls everything back and is returned as is. Thrown errors propagate.
export async function runRecallWork<T, E>(
  uow: RecallUnitOfWork,
  work: (repositories: RecallQuestionRepositories) => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
  try {
    return await uow.run(async (repositories) => {
      const result = await work(repositories);
      if (!result.ok) throw new RollbackSignal<E>(result);
      return result;
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.result as Result<T, E>;
    throw error;
  }
}
