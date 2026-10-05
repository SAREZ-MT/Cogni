import type { ExamQuestion } from "./exam-question";

// Persistence port for ExamQuestion (documento-maestro §6.1). Every method
// is owner-scoped: another owner's questions are invisible and untouchable.
export interface ExamQuestionRepository {
  // Inserts a new question (an original or a variant). Rejects a duplicate id.
  save(question: ExamQuestion): Promise<void>;
  // Writes an in-place edit: stem, options, correct index, explanation,
  // concept and updatedAt. Identity, lineage, origin and retiredAt never
  // change here. Returns the stored question, or null when the owner has
  // no such question.
  update(question: ExamQuestion): Promise<ExamQuestion | null>;
  findById(id: string, ownerId: string): Promise<ExamQuestion | null>;
  // The owner's questions among `ids`, retired ones included, in no given
  // order; unknown ids and other owners' questions are left out. An exam
  // session reads its stored question list with it.
  listByIds(ids: readonly string[], ownerId: string): Promise<ExamQuestion[]>;
  // The page's questions that can still be shown (not retired), oldest
  // first (createdAt, then id).
  listActiveByPage(pageId: string, ownerId: string): Promise<ExamQuestion[]>;
  // The page's questions that could be shown at instant `at`: created at
  // or before it and not retired by then (retiredAt null or after `at`),
  // oldest first. An exam session's questions are composed from this
  // snapshot at its start, so later edits of the page's question set never
  // change an open session's questions.
  listShownAt(
    pageId: string,
    ownerId: string,
    at: Date,
  ): Promise<ExamQuestion[]>;
  // Every question of a root's lineage, retired ones included, oldest
  // first: what newVariant compares a new wording against (§7.5.1).
  listLineage(rootId: string, ownerId: string): Promise<ExamQuestion[]>;
  // Locks every question row of a root's lineage until the surrounding
  // unit of work ends, so concurrent changes of one lineage (e.g. two
  // retires deciding whether the root's study item is suspended) queue
  // instead of each reading the other's uncommitted state. Resolves for
  // an unknown root too (nothing to lock).
  lockLineage(rootId: string, ownerId: string): Promise<void>;
  // Retires the question. Idempotent: an already retired question keeps
  // its original retiredAt. Returns the question, or null when the owner
  // has no such question.
  retire(id: string, ownerId: string, now: Date): Promise<ExamQuestion | null>;
}
