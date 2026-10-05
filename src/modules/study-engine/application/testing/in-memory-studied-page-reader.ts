import type {
  StalePagesQuery,
  StudiedPage,
  StudiedPageReader,
} from "../../domain/studied-page-reader";
import type { InMemoryPageMasteryRepository } from "./in-memory-page-mastery-repository";
import type { InMemoryStudyItemRepository } from "./in-memory-study-item-repository";

// In-memory StudiedPageReader over the item and mastery fakes; satisfies
// the shared contract (studied-page-reader.contract.ts) with the same rules
// as the Drizzle query: grouped by page, single-owner pages only, joined to
// the page's mastery row, keyset on (computedAt, missing first; pageId).
export class InMemoryStudiedPageReader implements StudiedPageReader {
  constructor(
    private readonly items: InMemoryStudyItemRepository,
    private readonly mastery: InMemoryPageMasteryRepository,
  ) {}

  async listStalePages(query: StalePagesQuery): Promise<StudiedPage[]> {
    const owners = new Map<string, Set<string>>();
    for (const item of this.items.allItems()) {
      const set = owners.get(item.pageId) ?? new Set<string>();
      set.add(item.ownerId);
      owners.set(item.pageId, set);
    }

    const pages: StudiedPage[] = [];
    for (const [pageId, set] of owners) {
      if (set.size !== 1) continue;
      const computedAt = this.mastery.computedAtOf(pageId);
      if (
        computedAt !== null &&
        computedAt.getTime() >= query.staleBefore.getTime()
      ) {
        continue;
      }
      const page: StudiedPage = {
        pageId,
        ownerId: [...set][0],
        masteryComputedAt: computedAt,
      };
      if (query.after !== null && compareKeys(page, query.after) <= 0) {
        continue;
      }
      pages.push(page);
    }
    return pages.sort(compareKeys).slice(0, query.limit);
  }
}

// Missing mastery sorts as the epoch, as the Drizzle query's coalesce does.
function compareKeys(a: StudiedPage, b: StudiedPage): number {
  const at = a.masteryComputedAt?.getTime() ?? 0;
  const bt = b.masteryComputedAt?.getTime() ?? 0;
  if (at !== bt) return at - bt;
  return a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0;
}
