import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  type FlashcardSessionRow,
  flashcardSessions,
} from "@/shared/db/schema";
import type { FlashcardSession } from "../domain/flashcard-session";
import type { FlashcardSessionRepository } from "../domain/flashcard-session-repository";

function toSession(row: FlashcardSessionRow): FlashcardSession {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    reviewedCount: row.reviewedCount,
    againCount: row.againCount,
  };
}

// Drizzle implementation of FlashcardSessionRepository; every query filters
// by owner_id (documento-maestro §6.1).
export class DrizzleFlashcardSessionRepository
  implements FlashcardSessionRepository
{
  constructor(private readonly db: DbExecutor) {}

  async insert(session: FlashcardSession): Promise<void> {
    await this.db.insert(flashcardSessions).values({
      id: session.id,
      ownerId: session.ownerId,
      pageId: session.pageId,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      reviewedCount: session.reviewedCount,
      againCount: session.againCount,
      createdAt: session.startedAt,
      updatedAt: session.startedAt,
    });
  }

  async findById(
    id: string,
    ownerId: string,
  ): Promise<FlashcardSession | null> {
    const [row] = await this.db
      .select()
      .from(flashcardSessions)
      .where(owned(id, ownerId));
    return row ? toSession(row) : null;
  }

  async recordGrade(
    id: string,
    ownerId: string,
    again: boolean,
  ): Promise<FlashcardSession | null> {
    // In-SQL increments: concurrent grades never lose a count.
    const [row] = await this.db
      .update(flashcardSessions)
      .set({
        reviewedCount: sql`${flashcardSessions.reviewedCount} + 1`,
        againCount: again
          ? sql`${flashcardSessions.againCount} + 1`
          : flashcardSessions.againCount,
      })
      .where(owned(id, ownerId))
      .returning();
    return row ? toSession(row) : null;
  }

  async finish(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<FlashcardSession | null> {
    // Only an open session changes; a finished one keeps its first
    // finished_at and is read back unchanged.
    await this.db
      .update(flashcardSessions)
      .set({ finishedAt: now, updatedAt: now })
      .where(and(owned(id, ownerId), isNull(flashcardSessions.finishedAt)));
    return this.findById(id, ownerId);
  }
}

function owned(id: string, ownerId: string) {
  return and(
    eq(flashcardSessions.id, id),
    eq(flashcardSessions.ownerId, ownerId),
  );
}
