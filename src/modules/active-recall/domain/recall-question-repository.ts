import type { RecallQuestion } from "./recall-question";

// Persistence port for RecallQuestion (documento-maestro §6.1). Every read
// is owner-scoped: another owner's questions are invisible.
export interface RecallQuestionRepository {
  // Inserts every question or none: rejects (writing nothing) a duplicate
  // id, inside `questions` or already stored. One AI generation stores its
  // whole batch with it.
  saveMany(questions: readonly RecallQuestion[]): Promise<void>;
  // The page's questions that can still enter a session (not archived),
  // oldest first (createdAt, then id).
  listActiveByPage(pageId: string, ownerId: string): Promise<RecallQuestion[]>;
  // The owner's questions among `ids`, archived ones included, oldest
  // first (createdAt, then id); unknown ids and other owners' questions
  // are left out. A session reads the questions it showed with it.
  listByIds(ids: readonly string[], ownerId: string): Promise<RecallQuestion[]>;
}
