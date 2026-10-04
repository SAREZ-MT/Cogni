import type { PageMastery } from "../../domain/page-mastery";
import type { PageMasteryRepository } from "../../domain/page-mastery-repository";

// In-memory PageMasteryRepository for unit tests; satisfies the shared
// contract (page-mastery-repository.contract.ts). One row per page.
export class InMemoryPageMasteryRepository implements PageMasteryRepository {
  private readonly rows = new Map<string, PageMastery>();

  async upsert(mastery: PageMastery): Promise<void> {
    const existing = this.rows.get(mastery.pageId);
    if (existing && existing.ownerId !== mastery.ownerId) return;
    this.rows.set(mastery.pageId, {
      ...mastery,
      id: existing?.id ?? mastery.id,
    });
  }

  async getByPage(
    pageId: string,
    ownerId: string,
  ): Promise<PageMastery | null> {
    const row = this.rows.get(pageId);
    return row && row.ownerId === ownerId ? row : null;
  }

  async listByOwner(ownerId: string): Promise<PageMastery[]> {
    return [...this.rows.values()]
      .filter((row) => row.ownerId === ownerId)
      .sort((a, b) => (a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0));
  }
}
