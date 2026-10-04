import type { StudyItem, StudyItemKind } from "../../domain/study-item";
import type { StudyItemRepository } from "../../domain/study-item-repository";

// In-memory StudyItemRepository for unit tests; satisfies the shared
// contract (study-item-repository.contract.ts). Rows are keyed by id.
export class InMemoryStudyItemRepository implements StudyItemRepository {
  private readonly rows = new Map<string, StudyItem>();

  async save(item: StudyItem): Promise<void> {
    const existing = this.rows.get(item.id);
    if (existing && existing.ownerId !== item.ownerId) return;
    // Mirrors the database's unique (kind, source_id): one item per source.
    for (const row of this.rows.values()) {
      if (
        row.id !== item.id &&
        row.kind === item.kind &&
        row.sourceId === item.sourceId
      ) {
        throw new Error("duplicate study item for (kind, sourceId)");
      }
    }
    this.rows.set(item.id, item);
  }

  async findById(id: string, ownerId: string): Promise<StudyItem | null> {
    const item = this.rows.get(id);
    return item && item.ownerId === ownerId ? item : null;
  }

  async findBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<StudyItem | null> {
    for (const item of this.rows.values()) {
      if (
        item.kind === kind &&
        item.sourceId === sourceId &&
        item.ownerId === ownerId
      ) {
        return item;
      }
    }
    return null;
  }

  async listDue(
    ownerId: string,
    now: Date,
    pageId?: string,
  ): Promise<StudyItem[]> {
    return this.owned(ownerId)
      .filter(
        (item) =>
          item.suspendedAt === null &&
          item.dueAt.getTime() <= now.getTime() &&
          (pageId === undefined || item.pageId === pageId),
      )
      .sort(
        (a, b) =>
          a.dueAt.getTime() - b.dueAt.getTime() || compareIds(a.id, b.id),
      );
  }

  async listByPage(pageId: string, ownerId: string): Promise<StudyItem[]> {
    return this.owned(ownerId)
      .filter((item) => item.pageId === pageId)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          compareIds(a.id, b.id),
      );
  }

  async suspend(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<StudyItem | null> {
    const item = await this.findById(id, ownerId);
    if (!item) return null;
    if (item.suspendedAt !== null) return item;
    const suspended = { ...item, suspendedAt: now, updatedAt: now };
    this.rows.set(id, suspended);
    return suspended;
  }

  // Single-threaded in memory: nothing to serialize.
  async lock(_id: string, _ownerId: string): Promise<void> {}

  private owned(ownerId: string): StudyItem[] {
    return [...this.rows.values()].filter((item) => item.ownerId === ownerId);
  }
}

// Code-unit order, the same order Postgres gives uuid columns.
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
