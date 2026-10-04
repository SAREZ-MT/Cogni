import type { Flashcard } from "../../domain/flashcard";
import type {
  DeckSummary,
  FlashcardRepository,
} from "../../domain/flashcard-repository";

export type PageDirectoryEntry = Omit<DeckSummary, "pageId" | "count">;

// The fake has no pages table, so deck listing asks a directory for the
// page's metadata; a page the directory does not know (missing or archived)
// has no deck. Without a directory the listing is always empty.
export class InMemoryFlashcardRepository implements FlashcardRepository {
  private readonly rows: Flashcard[] = [];

  constructor(
    private readonly pageDirectory: (
      pageId: string,
    ) => PageDirectoryEntry | undefined = () => undefined,
  ) {}

  async insertMany(cards: readonly Flashcard[]): Promise<void> {
    this.rows.push(...cards);
  }

  async listByPage(pageId: string, ownerId: string): Promise<Flashcard[]> {
    return this.rows
      .filter((card) => card.pageId === pageId && card.ownerId === ownerId)
      .sort((a, b) => a.position - b.position);
  }

  async countByPage(pageId: string, ownerId: string): Promise<number> {
    return (await this.listByPage(pageId, ownerId)).length;
  }

  async nextPosition(pageId: string, ownerId: string): Promise<number> {
    const cards = await this.listByPage(pageId, ownerId);
    return cards.length === 0
      ? 0
      : (cards[cards.length - 1]?.position ?? -1) + 1;
  }

  async countByOwnerGroupedByPage(ownerId: string): Promise<DeckSummary[]> {
    const counts = new Map<string, number>();
    for (const card of this.rows) {
      if (card.ownerId !== ownerId) continue;
      counts.set(card.pageId, (counts.get(card.pageId) ?? 0) + 1);
    }
    const decks: DeckSummary[] = [];
    for (const [pageId, count] of counts) {
      const page = this.pageDirectory(pageId);
      if (page) decks.push({ pageId, ...page, count });
    }
    return decks.sort(
      (a, b) =>
        a.notebookTitle.localeCompare(b.notebookTitle) ||
        a.pageTitle.localeCompare(b.pageTitle) ||
        a.pageId.localeCompare(b.pageId),
    );
  }
}
