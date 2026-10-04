import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  type FlashcardRow,
  flashcards,
  notebooks,
  pages,
} from "@/shared/db/schema";
import type { Flashcard } from "../domain/flashcard";
import type {
  DeckSummary,
  FlashcardRepository,
} from "../domain/flashcard-repository";

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
    archivedAt: row.archivedAt,
  };
}

// Active (not archived) cards of one owner's page.
function activeOnPage(pageId: string, ownerId: string) {
  return and(
    eq(flashcards.pageId, pageId),
    eq(flashcards.ownerId, ownerId),
    isNull(flashcards.archivedAt),
  );
}

// Drizzle implementation of FlashcardRepository; every query filters by
// owner_id (documento-maestro §6.1) and every read but findById and
// nextPosition skips archived cards.
export class DrizzleFlashcardRepository implements FlashcardRepository {
  constructor(private readonly db: DbExecutor) {}

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
        archivedAt: card.archivedAt,
      })),
    );
  }

  async findById(id: string, ownerId: string): Promise<Flashcard | null> {
    const [row] = await this.db
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.ownerId, ownerId)));
    return row ? toFlashcard(row) : null;
  }

  async listByPage(pageId: string, ownerId: string): Promise<Flashcard[]> {
    const rows = await this.db
      .select()
      .from(flashcards)
      .where(activeOnPage(pageId, ownerId))
      .orderBy(asc(flashcards.position));
    return rows.map(toFlashcard);
  }

  async countByPage(pageId: string, ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(flashcards)
      .where(activeOnPage(pageId, ownerId));
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

  async countByOwnerGroupedByPage(ownerId: string): Promise<DeckSummary[]> {
    const count = sql<number>`count(${flashcards.id})::int`;
    return this.db
      .select({
        pageId: pages.id,
        notebookId: notebooks.id,
        pageTitle: pages.title,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        count,
      })
      .from(flashcards)
      .innerJoin(pages, eq(pages.id, flashcards.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(flashcards.ownerId, ownerId),
          isNull(flashcards.archivedAt),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .groupBy(pages.id, notebooks.id)
      .orderBy(asc(notebooks.title), asc(pages.title), asc(pages.id));
  }

  async archive(id: string, ownerId: string, now: Date): Promise<void> {
    // archived_at IS NULL keeps the first archive instant on a repeat call.
    await this.db
      .update(flashcards)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(flashcards.id, id),
          eq(flashcards.ownerId, ownerId),
          isNull(flashcards.archivedAt),
        ),
      );
  }

  async lockDeck(pageId: string, ownerId: string): Promise<void> {
    // The page row is the deck's lock: every deck change of the page
    // queues behind it until the surrounding transaction ends.
    await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.ownerId, ownerId)))
      .for("update");
  }
}
