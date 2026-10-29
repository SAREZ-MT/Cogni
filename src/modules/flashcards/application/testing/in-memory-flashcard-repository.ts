import type { Flashcard } from "../../domain/flashcard";
import type {
  DeckSummary,
  FlashcardRepository,
} from "../../domain/flashcard-repository";

export type PageDirectoryEntry = Omit<
  DeckSummary,
  "pageId" | "count" | "latestCardAt" | "nextDueAt"
>;

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

  async findById(id: string, ownerId: string): Promise<Flashcard | null> {
    return (
      this.rows.find((card) => card.id === id && card.ownerId === ownerId) ??
      null
    );
  }

  async listByPage(pageId: string, ownerId: string): Promise<Flashcard[]> {
    return this.ownedOnPage(pageId, ownerId).filter(
      (card) => card.archivedAt === null,
    );
  }

  async countByPage(pageId: string, ownerId: string): Promise<number> {
    return (await this.listByPage(pageId, ownerId)).length;
  }

  async nextPosition(pageId: string, ownerId: string): Promise<number> {
    const cards = this.ownedOnPage(pageId, ownerId);
    return cards.length === 0
      ? 0
      : (cards[cards.length - 1]?.position ?? -1) + 1;
  }

  async countByOwnerGroupedByPage(ownerId: string): Promise<DeckSummary[]> {
    const counts = new Map<string, { count: number; latestCardAt: Date }>();
    for (const card of this.rows) {
      if (card.ownerId !== ownerId || card.archivedAt !== null) continue;
      const entry = counts.get(card.pageId);
      counts.set(card.pageId, {
        count: (entry?.count ?? 0) + 1,
        latestCardAt:
          entry && entry.latestCardAt > card.createdAt
            ? entry.latestCardAt
            : card.createdAt,
      });
    }
    // No study items in memory: nothing is scheduled.
    const decks: DeckSummary[] = [];
    for (const [pageId, entry] of counts) {
      const page = this.pageDirectory(pageId);
      if (page) decks.push({ pageId, ...page, ...entry, nextDueAt: null });
    }
    return decks.sort(
      (a, b) =>
        a.notebookTitle.localeCompare(b.notebookTitle) ||
        a.pageTitle.localeCompare(b.pageTitle) ||
        a.pageId.localeCompare(b.pageId),
    );
  }

  async archive(id: string, ownerId: string, now: Date): Promise<void> {
    const index = this.rows.findIndex(
      (card) => card.id === id && card.ownerId === ownerId,
    );
    const card = this.rows[index];
    if (!card || card.archivedAt !== null) return;
    this.rows[index] = { ...card, archivedAt: now, updatedAt: now };
  }

  async update(card: Flashcard): Promise<Flashcard | null> {
    const index = this.rows.findIndex(
      (row) =>
        row.id === card.id &&
        row.ownerId === card.ownerId &&
        row.archivedAt === null,
    );
    const stored = this.rows[index];
    if (!stored) return null;
    const updated = {
      ...stored,
      front: card.front,
      back: card.back,
      updatedAt: card.updatedAt,
    };
    this.rows[index] = updated;
    return updated;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const index = this.rows.findIndex(
      (card) => card.id === id && card.ownerId === ownerId,
    );
    if (index !== -1) this.rows.splice(index, 1);
  }

  // Nothing runs concurrently in memory.
  async lockDeck(): Promise<void> {}

  private ownedOnPage(pageId: string, ownerId: string): Flashcard[] {
    return this.rows
      .filter((card) => card.pageId === pageId && card.ownerId === ownerId)
      .sort((a, b) => a.position - b.position);
  }
}
