import type { Clock } from "@/shared/kernel/clock";
import type { Notebook, NotebookColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_PAGES_LIMIT = 5;

export interface HomeNotebookSummary {
  readonly id: string;
  readonly title: string;
  readonly icon: string | null;
  readonly color: NotebookColor | null;
  readonly pageCount: number;
  readonly updatedAt: Date;
}

export interface HomeRecentPage {
  readonly id: string;
  readonly notebookId: string;
  readonly notebookTitle: string;
  readonly title: string;
  readonly updatedAt: Date;
}

export interface HomeOverview {
  readonly notebookCount: number;
  readonly pageCount: number;
  readonly pagesEditedThisWeek: number;
  readonly lastActivityAt: Date | null;
  readonly notebooks: HomeNotebookSummary[];
  readonly recentPages: HomeRecentPage[];
}

// Home's read model (odd/tasks/app-shell-restyle.md S4): every field is
// derived from the owner's real active notebooks/pages, never invented
// metrics (Product decision 1). No invalid input or ownership violation is
// possible here, like listSidebar: ownerId comes from the trusted session.
export async function getHomeOverview(
  deps: { notebooks: NotebookRepository; pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<HomeOverview> {
  const [notebooks, pages] = await Promise.all([
    deps.notebooks.listActiveByOwner(ownerId),
    deps.pages.listActiveByOwner(ownerId),
  ]);

  const pagesByNotebook = new Map<string, Page[]>();
  for (const page of pages) {
    const list = pagesByNotebook.get(page.notebookId) ?? [];
    list.push(page);
    pagesByNotebook.set(page.notebookId, list);
  }

  const weekAgo = new Date(deps.clock.now().getTime() - WEEK_IN_MS);
  const pagesEditedThisWeek = pages.filter(
    (page) => page.updatedAt >= weekAgo,
  ).length;

  const notebookSummaries = notebooks
    .map((notebook) =>
      summarizeNotebook(notebook, pagesByNotebook.get(notebook.id) ?? []),
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const lastActivityAt = latestOf([
    ...notebooks.map((notebook) => notebook.updatedAt),
    ...pages.map((page) => page.updatedAt),
  ]);

  const notebookTitleById = new Map(
    notebooks.map((notebook) => [notebook.id, notebook.title]),
  );
  const recentPages: HomeRecentPage[] = [...pages]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RECENT_PAGES_LIMIT)
    .map((page) => ({
      id: page.id,
      notebookId: page.notebookId,
      notebookTitle: notebookTitleById.get(page.notebookId) ?? "",
      title: page.title,
      updatedAt: page.updatedAt,
    }));

  return {
    notebookCount: notebooks.length,
    pageCount: pages.length,
    pagesEditedThisWeek,
    lastActivityAt,
    notebooks: notebookSummaries,
    recentPages,
  };
}

// A notebook's own updatedAt only changes on a notebook-level mutation
// (rename, appearance, archive), never when one of its pages is edited: the
// grid's "time ago" needs whichever is actually more recent.
function summarizeNotebook(
  notebook: Notebook,
  pages: Page[],
): HomeNotebookSummary {
  const latestPageUpdate = latestOf(pages.map((page) => page.updatedAt));
  const updatedAt =
    latestPageUpdate && latestPageUpdate > notebook.updatedAt
      ? latestPageUpdate
      : notebook.updatedAt;
  return {
    id: notebook.id,
    title: notebook.title,
    icon: notebook.icon,
    color: notebook.color,
    pageCount: pages.length,
    updatedAt,
  };
}

function latestOf(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}
