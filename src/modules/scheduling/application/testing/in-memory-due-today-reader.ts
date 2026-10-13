import type { CalendarItem, OverdueCount } from "../../domain/calendar";
import type { DueInRangeReader } from "../../domain/due-in-range-reader";
import {
  compareDueTodayPages,
  type DueKind,
  type DueTodayPage,
  emptyDueCounts,
} from "../../domain/due-today";
import type { DueTodayReader } from "../../domain/due-today-reader";

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

// In-memory DueTodayReader and DueInRangeReader for unit tests; satisfies
// both shared contracts (due-today-reader.contract.ts,
// due-in-range-reader.contract.ts). It stands in for the notebooks, pages and
// study_items tables, so tests seed it directly. An item belongs to its
// page's owner, as in the database.
export class InMemoryDueTodayReader
  implements DueTodayReader, DueInRangeReader
{
  private readonly notebooks = new Map<string, NotebookRow>();
  private readonly pages = new Map<string, PageRow>();
  private readonly items: ItemRow[] = [];

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

  archivePage(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page) page.archived = true;
  }

  archiveNotebook(notebookId: string): void {
    const notebook = this.notebooks.get(notebookId);
    if (notebook) notebook.archived = true;
  }

  async listDueToday(ownerId: string, now: Date): Promise<DueTodayPage[]> {
    const byPage = new Map<string, DueTodayPage>();
    for (const item of this.items) {
      if (item.suspended || item.dueAt.getTime() > now.getTime()) continue;
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
