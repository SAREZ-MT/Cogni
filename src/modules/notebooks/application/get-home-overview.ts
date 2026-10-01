import type { Clock } from "@/shared/kernel/clock";
import type { Notebook, NotebookColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RECENT_PAGES_LIMIT = 5;

// Design pass 2 (odd/tasks, Home study-metrics decisions): thresholds for
// "Notas listas para repasar" and the two streak windows. Kept as named
// constants instead of literals so the copy in home/page.tsx (e.g. "5/14",
// "5 días por semana") stays visibly tied to the number that produces it.
const READY_MIN_WORDS = 150;
const READY_MIN_DAYS_SINCE_EDIT = 3;
const READY_TOP_LIMIT = 3;
const STREAK_WINDOW_DAYS = 14;
const WEEKLY_GOAL_WINDOW_DAYS = 7;
export const DEFAULT_WEEKLY_GOAL_DAYS = 5;

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
  // Design pass 2: the "Páginas recientes"/"Notas listas para repasar" rows
  // show an 8px colored dot per notebook (figma-make-design-system.md
  // PAGE_DOT_COLORS); null renders a neutral dot (notebook has no color set).
  readonly notebookColor: NotebookColor | null;
  readonly title: string;
  readonly updatedAt: Date;
}

// A page whose note is substantial enough (READY_MIN_WORDS) and old enough
// since its last edit (READY_MIN_DAYS_SINCE_EDIT) to be worth reviewing.
export interface HomeReadyToReview {
  readonly items: HomeRecentPage[];
  // Count of every page that cleared both thresholds, not just the top
  // READY_TOP_LIMIT shown in the list — StatCard's value and progress bar
  // need the full count, the panel only shows the top few.
  readonly totalReady: number;
  // Denominator for the stat card's progress bar: pages substantial enough
  // to ever qualify (>= READY_MIN_WORDS), regardless of edit recency.
  readonly totalRich: number;
}

// Days (within a trailing window ending today) that had at least one page
// edited — the "Índice de constancia" and "Meta semanal" stat cards both
// read from this, over a 14- and 7-day window respectively. `days` is
// oldest-to-newest, `days[days.length - 1]` is today.
export interface HomeActivityWindow {
  readonly activeDays: number;
  readonly days: readonly boolean[];
}

export interface HomeOverview {
  readonly notebookCount: number;
  readonly pageCount: number;
  readonly pagesEditedThisWeek: number;
  readonly lastActivityAt: Date | null;
  readonly notebooks: HomeNotebookSummary[];
  readonly recentPages: HomeRecentPage[];
  readonly readyToReview: HomeReadyToReview;
  readonly streak: HomeActivityWindow;
  readonly weeklyGoal: HomeActivityWindow & { readonly goal: number };
}

// Home's read model (odd/tasks/app-shell-restyle.md S4, extended in design
// pass 2's Home study-metrics decisions): every field is derived from the
// owner's real active notebooks/pages, never invented metrics (Product
// decision 1). No invalid input or ownership violation is possible here,
// like listSidebar: ownerId comes from the trusted session.
//
// Boundary note (design pass 2 deviation): the streak/weekly-goal windows
// were specified to also count ingestion import-job activity, but
// `notebooks` cannot import `ingestion` (`cross-module-via-index` in
// .dependency-cruiser.cjs forbids reaching past a module's public index.ts,
// and `ingestion` itself depends on `notebooks`, so the reverse edge would
// be a cycle). Both windows are computed from page.updatedAt only.
export async function getHomeOverview(
  deps: { notebooks: NotebookRepository; pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<HomeOverview> {
  const [notebooks, allPages] = await Promise.all([
    deps.notebooks.listActiveByOwner(ownerId),
    deps.pages.listActiveByOwner(ownerId),
  ]);

  // R3-home-overview-archived-notebook-pages (S4 review follow-up):
  // listActiveByOwner filters pages only by their own archivedAt.
  // archiveNotebook cascades the same instant to its active pages, but this
  // defends against a page that stays active under a notebook archived by
  // some other path — it must never leak into pageCount,
  // pagesEditedThisWeek, lastActivityAt or recentPages with an empty
  // notebookTitle.
  const activeNotebookIds = new Set(notebooks.map((notebook) => notebook.id));
  const pages = allPages.filter((page) =>
    activeNotebookIds.has(page.notebookId),
  );

  const now = deps.clock.now();

  const pagesByNotebook = new Map<string, Page[]>();
  for (const page of pages) {
    const list = pagesByNotebook.get(page.notebookId) ?? [];
    list.push(page);
    pagesByNotebook.set(page.notebookId, list);
  }

  const weekAgo = new Date(now.getTime() - WEEK_IN_MS);
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
  const notebookColorById = new Map(
    notebooks.map((notebook) => [notebook.id, notebook.color]),
  );

  function toRecentPage(page: Page): HomeRecentPage {
    return {
      id: page.id,
      notebookId: page.notebookId,
      notebookTitle: notebookTitleById.get(page.notebookId) ?? "",
      notebookColor: notebookColorById.get(page.notebookId) ?? null,
      title: page.title,
      updatedAt: page.updatedAt,
    };
  }

  const recentPages: HomeRecentPage[] = [...pages]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RECENT_PAGES_LIMIT)
    .map(toRecentPage);

  const readyToReview = computeReadyToReview(pages, now, toRecentPage);
  const streak = activeDaysInWindow(pages, now, STREAK_WINDOW_DAYS);
  const weeklyGoal = {
    ...activeDaysInWindow(pages, now, WEEKLY_GOAL_WINDOW_DAYS),
    goal: DEFAULT_WEEKLY_GOAL_DAYS,
  };

  return {
    notebookCount: notebooks.length,
    pageCount: pages.length,
    pagesEditedThisWeek,
    lastActivityAt,
    notebooks: notebookSummaries,
    recentPages,
    readyToReview,
    streak,
    weeklyGoal,
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

// plainText is already extracted from the page's Tiptap content by
// application/write-imported-content.ts / domain/plain-text.ts on every
// save, so "word count from the Tiptap JSON text nodes" reuses that
// existing field instead of re-walking the JSON tree here.
function wordCount(plainText: string): number {
  const trimmed = plainText.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / DAY_IN_MS;
}

function computeReadyToReview(
  pages: Page[],
  now: Date,
  toRecentPage: (page: Page) => HomeRecentPage,
): HomeReadyToReview {
  const richPages = pages.filter(
    (page) => wordCount(page.plainText) >= READY_MIN_WORDS,
  );
  const ready = richPages
    .filter(
      (page) => daysSince(page.updatedAt, now) >= READY_MIN_DAYS_SINCE_EDIT,
    )
    .map((page) => ({
      page,
      // Most-urgent-first: older, richer notes sort ahead.
      score:
        daysSince(page.updatedAt, now) * Math.log(wordCount(page.plainText)),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    items: ready
      .slice(0, READY_TOP_LIMIT)
      .map(({ page }) => toRecentPage(page)),
    totalReady: ready.length,
    totalRich: richPages.length,
  };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Trailing `windowDays` window ending today (inclusive), UTC calendar days.
// The window and the buckets share ONE definition: the list of UTC day keys.
// A page counts when its own day key is in that list, never by comparing raw
// timestamps (a cut-off of `now - (windowDays - 1) x 24 h` would drop an
// edit made earlier on the window's first day than the current time of day).
function activeDaysInWindow(
  pages: Page[],
  now: Date,
  windowDays: number,
): HomeActivityWindow {
  const windowKeys: string[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    windowKeys.push(dayKey(new Date(now.getTime() - offset * DAY_IN_MS)));
  }

  const activeDayKeys = new Set(pages.map((page) => dayKey(page.updatedAt)));
  const days = windowKeys.map((key) => activeDayKeys.has(key));

  return { activeDays: days.filter(Boolean).length, days };
}
