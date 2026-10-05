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

// In-memory DueTodayReader for unit tests; satisfies the shared contract
// (due-today-reader.contract.ts). It stands in for the notebooks, pages and
// study_items tables, so tests seed it directly. An item belongs to its
// page's owner, as in the database.
export class InMemoryDueTodayReader implements DueTodayReader {
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
}
