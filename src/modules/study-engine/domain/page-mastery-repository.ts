import type { PageMastery } from "./page-mastery";

// One PageMastery row per page (documento-maestro §6.1), rewritten after
// every review and by the daily job. Owner-scoped like every repository.
export interface PageMasteryRepository {
  // Inserts the page's row or overwrites its level, score, counts and
  // computedAt; the row keeps the id it was first created with.
  upsert(mastery: PageMastery): Promise<void>;
  getByPage(pageId: string, ownerId: string): Promise<PageMastery | null>;
  // Ordered by pageId so callers get a stable listing.
  listByOwner(ownerId: string): Promise<PageMastery[]>;
}
