import { and, asc, eq, isNull, max, min, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  type FlashcardRow,
  flashcards,
  notebooks,
  pages,
  studyItems,
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
    // One grouped read (Phase 8 H17): each active card has at most one
    // flashcard study item (unique kind + source), so the left join keeps
    // the count and adds the deck's earliest due date; suspended items
    // never count.
    const rows = await this.db
      .select({
        pageId: pages.id,
        notebookId: notebooks.id,
        pageTitle: pages.title,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        count,
        latestCardAt: max(flashcards.createdAt),
        nextDueAt: min(studyItems.dueAt),
      })
      .from(flashcards)
      .innerJoin(pages, eq(pages.id, flashcards.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .leftJoin(
        studyItems,
        and(
          eq(studyItems.kind, "flashcard"),
          eq(studyItems.sourceId, flashcards.id),
          eq(studyItems.ownerId, ownerId),
          isNull(studyItems.suspendedAt),
        ),
      )
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
    // A deck holds at least one active card, so max() is never null.
    return rows.map((row) => ({
      ...row,
      latestCardAt: row.latestCardAt ?? new Date(0),
    }));
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
