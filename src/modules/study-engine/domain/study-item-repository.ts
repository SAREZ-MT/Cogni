import type { StudyItem, StudyItemKind } from "./study-item";

// Persistence port for StudyItem (documento-maestro §6.1). Every method is
// owner-scoped: another owner's items are invisible and untouchable.
export interface StudyItemRepository {
  // Inserts the item or replaces the SM-2 state of an existing one (same
  // id and owner). Used on creation and after every graded review.
  save(item: StudyItem): Promise<void>;
  findById(id: string, ownerId: string): Promise<StudyItem | null>;
  // The item that schedules a given flashcard, root exam question or recall
  // question; there is at most one per (kind, sourceId).
  findBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<StudyItem | null>;
  // Non-suspended items with dueAt <= now, oldest due first; limited to one
  // page when pageId is given. Items of archived pages and of pages in
  // archived notebooks are never due.
  listDue(ownerId: string, now: Date, pageId?: string): Promise<StudyItem[]>;
  // Every item of the page, suspended ones included (computeMastery skips
  // them), ordered by creation.
  listByPage(pageId: string, ownerId: string): Promise<StudyItem[]>;
  // Takes the item out of scheduling (its source was archived). Idempotent:
  // an already suspended item keeps its original suspendedAt. Returns the
  // item, or null when the owner has no such item.
  suspend(id: string, ownerId: string, now: Date): Promise<StudyItem | null>;
  // Serializes concurrent grades of one item until the surrounding unit of
  // work ends (row lock), so a double submit cannot apply SM-2 twice to the
  // same state. A no-op outside a transaction and in memory.
  lock(id: string, ownerId: string): Promise<void>;
}
