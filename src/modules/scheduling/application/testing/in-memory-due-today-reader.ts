import type { CalendarItem, OverdueCount } from "../../domain/calendar";
import type { DueInRangeReader } from "../../domain/due-in-range-reader";
import {
  compareDueTodayPages,
  type DueKind,
  type DueTodayPage,
  emptyDueCounts,
} from "../../domain/due-today";
import type { DueTodayReader } from "../../domain/due-today-reader";
import {
  emptyTechniqueSnapshot,
  type TechniqueSnapshot,
} from "../../domain/technique-overview";
import type {
  TechniqueOverviewReader,
  TechniqueSnapshotBounds,
} from "../../domain/technique-overview-reader";

interface NotebookRow {
  id: string;
  ownerId: string;
  title: string;
  color: string | null;
  archived: boolean;
}

interface PageRow {
  id: string;
  ownerId: string;
  notebookId: string;
  title: string;
  archived: boolean;
}

interface ItemRow {
  pageId: string;
  kind: DueKind;
  dueAt: Date;
  suspended: boolean;
}

// One review_logs row reduced to what the overview reads: its item's page
// and its technique (the session kind, as a DueKind).
interface ReviewRow {
  pageId: string;
  kind: DueKind;
  reviewedAt: Date;
}

// In-memory DueTodayReader, DueInRangeReader and TechniqueOverviewReader
// for unit tests; satisfies the three shared contracts
// (due-today-reader.contract.ts, due-in-range-reader.contract.ts,
// technique-overview-reader.contract.ts). It stands in for the notebooks, pages and
// study_items (and, for the overview, review_logs) tables, so tests seed
// it directly. An item belongs to its
// page's owner, as in the database.
export class InMemoryDueTodayReader
  implements DueTodayReader, DueInRangeReader, TechniqueOverviewReader
{
  private readonly notebooks = new Map<string, NotebookRow>();
  private readonly pages = new Map<string, PageRow>();
  private readonly items: ItemRow[] = [];
  private readonly reviews: ReviewRow[] = [];

  addNotebook(notebook: {
    id: string;
    ownerId: string;
    title: string;
    color: string | null;
  }): void {
    this.notebooks.set(notebook.id, { ...notebook, archived: false });
  }

  addPage(page: {
    id: string;
    ownerId: string;
    notebookId: string;
    title: string;
  }): void {
    this.pages.set(page.id, { ...page, archived: false });
  }

  addItem(item: ItemRow): void {
    this.items.push({ ...item });
  }

  addReview(review: ReviewRow): void {
    this.reviews.push({ ...review });
  }

  archivePage(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page) page.archived = true;
  }

  archiveNotebook(notebookId: string): void {
    const notebook = this.notebooks.get(notebookId);
    if (notebook) notebook.archived = true;
  }

  async listDueToday(
    ownerId: string,
    dueBefore: Date,
  ): Promise<DueTodayPage[]> {
    const byPage = new Map<string, DueTodayPage>();
    for (const item of this.items) {
      if (item.suspended || item.dueAt.getTime() >= dueBefore.getTime()) {
        continue;
      }
      const page = this.pages.get(item.pageId);
      if (!page || page.archived || page.ownerId !== ownerId) continue;
      const notebook = this.notebooks.get(page.notebookId);
      if (!notebook || notebook.archived) continue;

      const row = byPage.get(page.id) ?? {
        pageId: page.id,
        pageTitle: page.title,
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        notebookColor: notebook.color,
        due: emptyDueCounts(),
        earliestDueAt: item.dueAt,
      };
      row.due[item.kind] += 1;
      if (item.dueAt.getTime() < row.earliestDueAt.getTime()) {
        row.earliestDueAt = item.dueAt;
      }
      byPage.set(page.id, row);
    }
    return [...byPage.values()].sort(compareDueTodayPages);
  }

  // The owner's live items (not suspended, page and notebook active) with
  // `from <= due_at < to`, as calendar items.
  private calendarItems(ownerId: string, from: Date, to: Date): CalendarItem[] {
    const rows: CalendarItem[] = [];
    for (const item of this.items) {
      const due = item.dueAt.getTime();
      if (item.suspended || due < from.getTime() || due >= to.getTime()) {
        continue;
      }
      const page = this.pages.get(item.pageId);
      if (!page || page.archived || page.ownerId !== ownerId) continue;
      const notebook = this.notebooks.get(page.notebookId);
      if (!notebook || notebook.archived) continue;
      rows.push({
        pageId: page.id,
        pageTitle: page.title,
        notebookId: notebook.id,
        kind: item.kind,
        dueAt: item.dueAt,
      });
    }
    return rows;
  }

  async listDueInRange(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarItem[]> {
    return this.calendarItems(ownerId, from, to).sort(
      (a, b) =>
        a.dueAt.getTime() - b.dueAt.getTime() ||
        compareText(a.pageId, b.pageId),
    );
  }

  async readTechniqueSnapshot(
    ownerId: string,
    bounds: TechniqueSnapshotBounds,
  ): Promise<TechniqueSnapshot> {
    const snapshot = emptyTechniqueSnapshot();
    const due = new Map<DueKind, Set<string>>();
    for (const item of this.calendarItems(
      ownerId,
      new Date(-8.64e15),
      new Date(8.64e15),
    )) {
      const readout = snapshot[item.kind];
      readout.total += 1;
      const dueAt = item.dueAt.getTime();
      if (dueAt < bounds.dueBefore.getTime()) {
        const pages = due.get(item.kind) ?? new Set<string>();
        pages.add(item.pageId);
        due.set(item.kind, pages);
      } else if (
        readout.nextDueAt === null ||
        dueAt < readout.nextDueAt.getTime()
      ) {
        readout.nextDueAt = item.dueAt;
      }
    }
    const reviewed = new Map<DueKind, Set<string>>();
    for (const review of this.reviews) {
      const at = review.reviewedAt.getTime();
      if (
        at < bounds.reviewedFrom.getTime() ||
        at >= bounds.dueBefore.getTime() ||
        !this.isLivePage(review.pageId, ownerId)
      ) {
        continue;
      }
      const pages = reviewed.get(review.kind) ?? new Set<string>();
      pages.add(review.pageId);
      reviewed.set(review.kind, pages);
    }
    for (const [kind, readout] of Object.entries(snapshot) as [
      DueKind,
      (typeof snapshot)[DueKind],
    ][]) {
      readout.duePageIds = [...(due.get(kind) ?? [])].sort(compareText);
      readout.reviewedPageIds = [...(reviewed.get(kind) ?? [])].sort(
        compareText,
      );
    }
    return snapshot;
  }

  // The page exists, belongs to the owner and neither it nor its notebook
  // is archived.
  private isLivePage(pageId: string, ownerId: string): boolean {
    const page = this.pages.get(pageId);
    if (!page || page.archived || page.ownerId !== ownerId) return false;
    const notebook = this.notebooks.get(page.notebookId);
    return Boolean(notebook && !notebook.archived);
  }

  async listOverdueCounts(
    ownerId: string,
    before: Date,
  ): Promise<OverdueCount[]> {
    const byPageKind = new Map<string, OverdueCount>();
    for (const item of this.calendarItems(
      ownerId,
      new Date(-8.64e15),
      before,
    )) {
      const key = `${item.pageId}|${item.kind}`;
      const row = byPageKind.get(key) ?? {
        pageId: item.pageId,
        pageTitle: item.pageTitle,
        notebookId: item.notebookId,
        kind: item.kind,
        count: 0,
        earliestDueAt: item.dueAt,
      };
      row.count += 1;
      if (item.dueAt.getTime() < row.earliestDueAt.getTime()) {
        row.earliestDueAt = item.dueAt;
      }
      byPageKind.set(key, row);
    }
    return [...byPageKind.values()].sort(
      (a, b) =>
        a.earliestDueAt.getTime() - b.earliestDueAt.getTime() ||
        compareText(a.pageId, b.pageId) ||
        compareText(a.kind, b.kind),
    );
  }
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
