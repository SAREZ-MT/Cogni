import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  examSessions,
  notebooks,
  pages,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { DUE_KINDS, type DueKind } from "../domain/due-today";
import {
  emptyTechniqueSnapshot,
  REVIEW_SESSION_KIND,
  type TechniqueSnapshot,
} from "../domain/technique-overview";
import type {
  TechniqueOverviewReader,
  TechniqueSnapshotBounds,
} from "../domain/technique-overview-reader";

const KIND_OF_SESSION = new Map<string, DueKind>(
  DUE_KINDS.map((kind) => [REVIEW_SESSION_KIND[kind], kind]),
);

function isDueKind(kind: string): kind is DueKind {
  return (DUE_KINDS as readonly string[]).includes(kind);
}

function sortedIds(ids: readonly string[] | null): string[] {
  return [...(ids ?? [])].sort();
}

// Drizzle implementation of TechniqueOverviewReader, in three reads:
// 1. Items grouped by kind over the owner's study_items
//    (study_items_owner_due_idx serves the owner filter) joined to their
//    page and notebook, with the same live-item filters as
//    DrizzleDueTodayReader: count, next due date from `dueBefore`, and the
//    distinct pages with an item due before it.
// 2. The distinct (session kind, page) pairs of the owner's review logs in
//    [reviewedFrom, dueBefore) (review_logs_owner_reviewed_idx), on pages
//    and notebooks that are not archived.
// 3. The distinct pages of the owner's exam sessions finished in
//    [reviewedFrom, dueBefore), on live pages and notebooks (H2-T6: a
//    completed exam closes its page for the day).
export class DrizzleTechniqueOverviewReader implements TechniqueOverviewReader {
  constructor(private readonly db: DbExecutor) {}

  async readTechniqueSnapshot(
    ownerId: string,
    bounds: TechniqueSnapshotBounds,
  ): Promise<TechniqueSnapshot> {
    const itemRows = await this.db
      .select({
        kind: studyItems.kind,
        total: sql<number>`count(*)::int`,
        // The column's decoder turns the driver value into a Date; a group
        // without upcoming items yields null.
        nextDueAt:
          sql<Date | null>`min(${studyItems.dueAt}) filter (where ${gte(
            studyItems.dueAt,
            bounds.dueBefore,
          )})`.mapWith(studyItems.dueAt),
        // text[] so the driver hands back plain strings; null when no item
        // of the group is due today.
        duePageIds: sql<
          string[] | null
        >`array_agg(distinct ${studyItems.pageId}::text) filter (where ${lt(
          studyItems.dueAt,
          bounds.dueBefore,
        )})`,
      })
      .from(studyItems)
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(studyItems.ownerId, ownerId),
          isNull(studyItems.suspendedAt),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .groupBy(studyItems.kind);

    const reviewRows = await this.db
      .selectDistinct({
        sessionKind: reviewLogs.sessionKind,
        pageId: studyItems.pageId,
      })
      .from(reviewLogs)
      .innerJoin(studyItems, eq(studyItems.id, reviewLogs.itemId))
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(reviewLogs.ownerId, ownerId),
          gte(reviewLogs.reviewedAt, bounds.reviewedFrom),
          lt(reviewLogs.reviewedAt, bounds.dueBefore),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      );

    const completedRows = await this.db
      .selectDistinct({ pageId: examSessions.pageId })
      .from(examSessions)
      .innerJoin(pages, eq(pages.id, examSessions.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(examSessions.ownerId, ownerId),
          gte(examSessions.finishedAt, bounds.reviewedFrom),
          lt(examSessions.finishedAt, bounds.dueBefore),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      );

    const snapshot = emptyTechniqueSnapshot();
    for (const row of itemRows) {
      // Kinds outside DUE_KINDS cannot exist (study_items has a check on
      // kind); the guard only narrows the column type.
      if (!isDueKind(row.kind)) continue;
      snapshot[row.kind] = {
        ...snapshot[row.kind],
        total: row.total,
        nextDueAt: row.nextDueAt ?? null,
        duePageIds: sortedIds(row.duePageIds),
      };
    }
    const reviewed = new Map<DueKind, string[]>();
    for (const row of reviewRows) {
      const kind = KIND_OF_SESSION.get(row.sessionKind);
      if (!kind) continue;
      reviewed.set(kind, [...(reviewed.get(kind) ?? []), row.pageId]);
    }
    for (const [kind, ids] of reviewed) {
      snapshot[kind].reviewedPageIds = sortedIds(ids);
    }
    snapshot.exam_question.completedPageIds = sortedIds(
      completedRows.map((row) => row.pageId),
    );
    return snapshot;
  }
}
