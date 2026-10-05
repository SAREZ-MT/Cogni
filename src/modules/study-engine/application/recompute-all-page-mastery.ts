import type { Clock } from "@/shared/kernel/clock";
import { computeMastery } from "../domain/mastery";
import type {
  StudiedPage,
  StudiedPageReader,
} from "../domain/studied-page-reader";
import type { StudyRepositories, StudyUnitOfWork } from "./study-unit-of-work";

// Pages read per listing query; keeps each round trip and the memory held
// by the job bounded however many pages exist.
export const MASTERY_RECOMPUTE_BATCH_SIZE = 200;

export interface RecomputeAllPageMasteryDeps {
  pages: StudiedPageReader;
  // One unit of work (transaction) per page.
  uow: StudyUnitOfWork;
  clock: Clock;
  ids: { next(): string };
  // Wall time the run may spend, measured on `clock` from the run start. No
  // page starts once it is spent; the run stops cleanly and the next run
  // picks up the pages left behind (they are then the stalest).
  timeBudgetMs: number;
  batchSize?: number;
  // Called once per page whose recompute threw; the job goes on.
  onPageError?: (page: StudiedPage, error: unknown) => void;
}

export interface MasteryRecomputeSummary {
  pagesRecomputed: number;
  pagesFailed: number;
  // False when the time budget ran out before the listing was exhausted.
  complete: boolean;
}

// The daily job (documento-maestro §7.3): rewrites the PageMastery of every
// page so itemsDue, level and score stay current for pages nobody reviewed
// today. Same computation as gradeFlashcard: all of the page's items
// (computeMastery skips suspended ones).
//
// Order and resumption: pages come stalest first (no mastery, then oldest
// computedAt) and only while their mastery predates the run start, so a
// run cut short by the budget or the platform leaves the untouched pages
// at the head of the next run and the tail never starves. A page this run
// rewrote is no longer stale and cannot come back; a failing page keeps its
// old key, the cursor moves past it, so it is tried once per run.
//
// A failing page is counted and reported, never fatal to the others; a
// failing listing query aborts the run (nothing more can be read).
export async function recomputeAllPageMastery(
  deps: RecomputeAllPageMasteryDeps,
): Promise<MasteryRecomputeSummary> {
  const batchSize = deps.batchSize ?? MASTERY_RECOMPUTE_BATCH_SIZE;
  const runStart = deps.clock.now();
  const deadline = runStart.getTime() + deps.timeBudgetMs;
  const outOfTime = () => deps.clock.now().getTime() >= deadline;
  let pagesRecomputed = 0;
  let pagesFailed = 0;
  const stop = (complete: boolean): MasteryRecomputeSummary => ({
    pagesRecomputed,
    pagesFailed,
    complete,
  });

  let after: StudiedPage | null = null;
  for (;;) {
    if (outOfTime()) return stop(false);
    const batch = await deps.pages.listStalePages({
      staleBefore: runStart,
      after,
      limit: batchSize,
    });
    for (const page of batch) {
      if (outOfTime()) return stop(false);
      try {
        await deps.uow.run((repos) => recomputePage(page, repos, deps));
        pagesRecomputed += 1;
      } catch (error) {
        pagesFailed += 1;
        deps.onPageError?.(page, error);
      }
      after = page;
    }
    if (batch.length < batchSize) return stop(true);
  }
}

// Lock, then read, then write, in one transaction: a grade of one of the
// page's items holds that item's row lock until it commits (its own item,
// review log and mastery), so the job waits and then computes from the
// graded state. `now` is read after the lock, so the row the job writes is
// never older than a grade that committed before it.
async function recomputePage(
  page: StudiedPage,
  repos: StudyRepositories,
  deps: RecomputeAllPageMasteryDeps,
): Promise<void> {
  await repos.studyItems.lockPage(page.pageId, page.ownerId);
  const now = deps.clock.now();
  const items = await repos.studyItems.listByPage(page.pageId, page.ownerId);
  await repos.pageMastery.upsert({
    id: deps.ids.next(),
    ownerId: page.ownerId,
    pageId: page.pageId,
    ...computeMastery(items, now),
    computedAt: now,
  });
}
