import type { Flashcard } from "../../domain/flashcard";
import type { FlashcardRepository } from "../../domain/flashcard-repository";

export class InMemoryFlashcardRepository implements FlashcardRepository {
  private readonly rows: Flashcard[] = [];

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
}
