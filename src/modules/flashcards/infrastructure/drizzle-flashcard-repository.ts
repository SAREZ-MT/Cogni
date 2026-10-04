import { and, asc, eq, max, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type FlashcardRow, flashcards } from "@/shared/db/schema";
import type { Flashcard } from "../domain/flashcard";
import type { FlashcardRepository } from "../domain/flashcard-repository";

function toFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    generationId: row.generationId,
    front: row.front,
    back: row.back,
    origin: row.origin,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of FlashcardRepository; every query filters by
// owner_id (documento-maestro §6.1).
export class DrizzleFlashcardRepository implements FlashcardRepository {
  constructor(private readonly db: Db) {}

  async insertMany(cards: readonly Flashcard[]): Promise<void> {
    if (cards.length === 0) return;
    await this.db.insert(flashcards).values(
      cards.map((card) => ({
        id: card.id,
        ownerId: card.ownerId,
        pageId: card.pageId,
        generationId: card.generationId,
        front: card.front,
        back: card.back,
        origin: card.origin,
        position: card.position,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      })),
    );
  }

  async listByPage(pageId: string, ownerId: string): Promise<Flashcard[]> {
    const rows = await this.db
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.pageId, pageId), eq(flashcards.ownerId, ownerId)),
      )
      .orderBy(asc(flashcards.position));
    return rows.map(toFlashcard);
  }

  async countByPage(pageId: string, ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(flashcards)
      .where(
        and(eq(flashcards.pageId, pageId), eq(flashcards.ownerId, ownerId)),
      );
    return row?.count ?? 0;
  }

  async nextPosition(pageId: string, ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ highest: max(flashcards.position) })
      .from(flashcards)
      .where(
        and(eq(flashcards.pageId, pageId), eq(flashcards.ownerId, ownerId)),
      );
    return row?.highest === null || row?.highest === undefined
      ? 0
      : row.highest + 1;
  }
}
