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
  // The page's questions that can still be shown (not retired), oldest
  // first (createdAt, then id).
  listActiveByPage(pageId: string, ownerId: string): Promise<ExamQuestion[]>;
  // Every question of a root's lineage, retired ones included, oldest
  // first: what newVariant compares a new wording against (§7.5.1).
  listLineage(rootId: string, ownerId: string): Promise<ExamQuestion[]>;
  // Retires the question. Idempotent: an already retired question keeps
  // its original retiredAt. Returns the question, or null when the owner
  // has no such question.
  retire(id: string, ownerId: string, now: Date): Promise<ExamQuestion | null>;
}
