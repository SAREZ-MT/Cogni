import type {
  StudyItemKind,
  StudyItemRepository,
} from "@/modules/study-engine";
import type { GenerationFingerprintRepository } from "@/shared/kernel/generation-fingerprints";
import type { Result } from "@/shared/kernel/result";
import type { ExamQuestionRepository } from "../domain/exam-question-repository";

// The slice of StudyItemRepository a question change needs: every root
// owns one StudyItem(kind = "exam_question", sourceId = rootId)
// (documento-maestro §6.1), created with the root and suspended when the
// root's lineage has no active question left.
export type ExamStudyItems = Pick<
  StudyItemRepository,
  "save" | "findBySource" | "suspend"
> & {
  // Removes the source's study item; its review logs cascade with it
  // (Phase 8 H18 deletes; study-engine has no delete of its own, so the
  // exams adapter adds it).
  deleteBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<void>;
};

// What else points at a lineage that is deleted (Phase 8 H18): an open
// exam showing one of its questions (its stored list would point at
// nothing, and it could never be finished) and the page's pending retake
// (its failed roots). dropLineage removes those open sessions, with their
// answers, and the root from the retake; finished exams keep their score
// as the record of that attempt.
export interface ExamLineageReferences {
  dropLineage(
    input: { pageId: string; rootId: string; questionIds: readonly string[] },
    ownerId: string,
  ): Promise<void>;
}

export interface ExamQuestionRepositories {
  readonly questions: ExamQuestionRepository;
  readonly studyItems: ExamStudyItems;
  // The "exam" paragraph fingerprints of a generation (Phase 6 T5c), stored
  // with its questions.
  readonly fingerprints: GenerationFingerprintRepository;
  readonly lineageRefs: ExamLineageReferences;
}

// Unit of work over a page's questions and their study items: everything
// `work` writes through the given repositories commits together or not at
// all (a thrown error rolls it back). Questions and study items live in
// two modules, so the transaction boundary is this port.
export type ExamUnitOfWork = UnitOfWorkOf<ExamQuestionRepositories>;

// A unit of work over some repositories R: everything `work` writes
// through them commits together, and a thrown error rolls it back.
export interface UnitOfWorkOf<R> {
  run<T>(work: (repositories: R) => Promise<T>): Promise<T>;
}

// Carries an err Result out of ExamUnitOfWork.run as a throw, so the unit
// of work rolls back; runExamWork turns it back into the Result.
class RollbackSignal<E> extends Error {
  constructor(readonly result: Result<never, E>) {
    super("exam unit of work rolled back by an err result");
    this.name = "RollbackSignal";
  }
}

// Runs a Result-returning work in one unit of work. Returning err from
// inside `run` would commit whatever was written before the refusal, so an
// err rolls everything back and is returned as is. Thrown errors propagate.
export async function runExamWork<R, T, E>(
  uow: UnitOfWorkOf<R>,
  work: (repositories: R) => Promise<Result<T, E>>,
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
