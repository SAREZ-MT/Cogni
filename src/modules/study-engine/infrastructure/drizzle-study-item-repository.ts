import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type StudyItemRow, studyItems } from "@/shared/db/schema";
import type { StudyItem, StudyItemKind } from "../domain/study-item";
import type { StudyItemRepository } from "../domain/study-item-repository";

function toStudyItem(row: StudyItemRow): StudyItem {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    kind: row.kind,
    sourceId: row.sourceId,
    easiness: row.easiness,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    dueAt: row.dueAt,
    lastQuality: row.lastQuality,
    lastReviewedAt: row.lastReviewedAt,
    lapses: row.lapses,
    suspendedAt: row.suspendedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of StudyItemRepository; every query filters by
// owner_id (documento-maestro §6.1).
export class DrizzleStudyItemRepository implements StudyItemRepository {
  constructor(private readonly db: DbExecutor) {}

  async save(item: StudyItem): Promise<void> {
    const state = {
      easiness: item.easiness,
      intervalDays: item.intervalDays,
      repetitions: item.repetitions,
      lapses: item.lapses,
      dueAt: item.dueAt,
      lastQuality: item.lastQuality,
      lastReviewedAt: item.lastReviewedAt,
      suspendedAt: item.suspendedAt,
      updatedAt: item.updatedAt,
    };
    // The WHERE on the conflict branch makes a save with another owner's
    // id a no-op instead of a takeover.
    await this.db
      .insert(studyItems)
      .values({
        id: item.id,
        ownerId: item.ownerId,
        pageId: item.pageId,
        kind: item.kind,
        sourceId: item.sourceId,
        createdAt: item.createdAt,
        ...state,
      })
      .onConflictDoUpdate({
        target: studyItems.id,
        set: state,
        setWhere: eq(studyItems.ownerId, item.ownerId),
      });
  }

  async findById(id: string, ownerId: string): Promise<StudyItem | null> {
    const [row] = await this.db
      .select()
      .from(studyItems)
      .where(and(eq(studyItems.id, id), eq(studyItems.ownerId, ownerId)));
    return row ? toStudyItem(row) : null;
  }

  async findBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<StudyItem | null> {
    const [row] = await this.db
      .select()
      .from(studyItems)
      .where(
        and(
          eq(studyItems.kind, kind),
          eq(studyItems.sourceId, sourceId),
          eq(studyItems.ownerId, ownerId),
        ),
      );
    return row ? toStudyItem(row) : null;
  }

  async listDue(
    ownerId: string,
    now: Date,
    pageId?: string,
  ): Promise<StudyItem[]> {
    const rows = await this.db
      .select()
      .from(studyItems)
      .where(
        and(
          eq(studyItems.ownerId, ownerId),
          isNull(studyItems.suspendedAt),
          lte(studyItems.dueAt, now),
          pageId === undefined ? undefined : eq(studyItems.pageId, pageId),
        ),
      )
      .orderBy(asc(studyItems.dueAt), asc(studyItems.id));
    return rows.map(toStudyItem);
  }

  async listByPage(pageId: string, ownerId: string): Promise<StudyItem[]> {
    const rows = await this.db
      .select()
      .from(studyItems)
      .where(
        and(eq(studyItems.pageId, pageId), eq(studyItems.ownerId, ownerId)),
      )
      .orderBy(asc(studyItems.createdAt), asc(studyItems.id));
    return rows.map(toStudyItem);
  }

  async suspend(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<StudyItem | null> {
    // Only an active item changes; an already suspended one keeps its
    // original suspended_at and is read back unchanged.
    await this.db
      .update(studyItems)
      .set({ suspendedAt: now, updatedAt: now })
      .where(
        and(
          eq(studyItems.id, id),
          eq(studyItems.ownerId, ownerId),
          isNull(studyItems.suspendedAt),
        ),
      );
    return this.findById(id, ownerId);
  }

  async lock(id: string, ownerId: string): Promise<void> {
    await this.db
      .select({ id: studyItems.id })
      .from(studyItems)
      .where(and(eq(studyItems.id, id), eq(studyItems.ownerId, ownerId)))
      .for("update");
  }
}
