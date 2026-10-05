import type { Clock } from "@/shared/kernel/clock";
import { computeMastery } from "../domain/mastery";
import type { PageMasteryRepository } from "../domain/page-mastery-repository";
import type {
  StudiedPage,
  StudiedPageReader,
} from "../domain/studied-page-reader";
import type { StudyItemRepository } from "../domain/study-item-repository";

// Pages read per listing query; keeps each round trip and the memory held
// by the job bounded however many pages exist.
export const MASTERY_RECOMPUTE_BATCH_SIZE = 200;

export interface RecomputeAllPageMasteryDeps {
  pages: StudiedPageReader;
  studyItems: StudyItemRepository;
  pageMastery: PageMasteryRepository;
  clock: Clock;
  ids: { next(): string };
  batchSize?: number;
  // Called once per page whose recompute threw; the job goes on.
  onPageError?: (page: StudiedPage, error: unknown) => void;
}

export interface MasteryRecomputeSummary {
  pagesRecomputed: number;
  pagesFailed: number;
}

// The daily job (documento-maestro §7.3): rewrites every page's
// PageMastery so itemsDue, level and score stay current for pages nobody
// reviewed today. Same computation as gradeFlashcard: all of the page's
// items (computeMastery skips suspended ones) at one `now` for the run.
// A failing page is counted and reported, never fatal to the others; a
// failing listing query aborts the run (nothing more can be read).
export async function recomputeAllPageMastery(
  deps: RecomputeAllPageMasteryDeps,
): Promise<MasteryRecomputeSummary> {
  const batchSize = deps.batchSize ?? MASTERY_RECOMPUTE_BATCH_SIZE;
  const now = deps.clock.now();
  const summary: MasteryRecomputeSummary = {
    pagesRecomputed: 0,
    pagesFailed: 0,
  };

  let after: string | null = null;
  for (;;) {
    const batch = await deps.pages.listStudiedPages(after, batchSize);
    for (const page of batch) {
      try {
        await recomputePage(page, now, deps);
        summary.pagesRecomputed += 1;
      } catch (error) {
        summary.pagesFailed += 1;
        deps.onPageError?.(page, error);
      }
    }
    if (batch.length < batchSize) return summary;
    after = batch[batch.length - 1].pageId;
  }
}

async function recomputePage(
  page: StudiedPage,
  now: Date,
  deps: RecomputeAllPageMasteryDeps,
): Promise<void> {
  const items = await deps.studyItems.listByPage(page.pageId, page.ownerId);
  await deps.pageMastery.upsert({
    id: deps.ids.next(),
    ownerId: page.ownerId,
    pageId: page.pageId,
    ...computeMastery(items, now),
    computedAt: now,
  });
}
