import { and, eq, lt } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type SessionFeedbackRow, sessionFeedback } from "@/shared/db/schema";
import type { SessionKind } from "../domain/review-log";
import type {
  SessionFeedback,
  SessionFeedbackContent,
} from "../domain/session-feedback";
import type { SessionFeedbackRepository } from "../domain/session-feedback-repository";

function toFeedback(row: SessionFeedbackRow): SessionFeedback {
  return {
    id: row.id,
    ownerId: row.ownerId,
    sessionKind: row.sessionKind,
    sessionId: row.sessionId,
    status: row.status,
    // Only the use case writes this column, always with a value already
    // validated against the ai module's session_feedback schema.
    content: (row.content as SessionFeedbackContent | null) ?? null,
    generationId: row.generationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of SessionFeedbackRepository; every query filters
// by owner_id (documento-maestro §6.1). The unique (session_kind,
// session_id) key makes `create` a race-free claim.
export class DrizzleSessionFeedbackRepository
  implements SessionFeedbackRepository
{
  constructor(private readonly db: DbExecutor) {}

  async create(feedback: SessionFeedback): Promise<boolean> {
    const inserted = await this.db
      .insert(sessionFeedback)
      .values({
        id: feedback.id,
        ownerId: feedback.ownerId,
        sessionKind: feedback.sessionKind,
        sessionId: feedback.sessionId,
        content: feedback.content,
        generationId: feedback.generationId,
        status: feedback.status,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
      })
      .onConflictDoNothing({
        target: [sessionFeedback.sessionKind, sessionFeedback.sessionId],
      })
      .returning({ id: sessionFeedback.id });
    return inserted.length > 0;
  }

  async findBySession(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<SessionFeedback | null> {
    const [row] = await this.db
      .select()
      .from(sessionFeedback)
      .where(
        and(
          eq(sessionFeedback.sessionKind, sessionKind),
          eq(sessionFeedback.sessionId, sessionId),
          eq(sessionFeedback.ownerId, ownerId),
        ),
      );
    return row ? toFeedback(row) : null;
  }

  async update(feedback: SessionFeedback): Promise<void> {
    await this.db
      .update(sessionFeedback)
      .set({
        status: feedback.status,
        content: feedback.content,
        generationId: feedback.generationId,
        updatedAt: feedback.updatedAt,
      })
      .where(
        and(
          eq(sessionFeedback.id, feedback.id),
          eq(sessionFeedback.ownerId, feedback.ownerId),
        ),
      );
  }

  // A conditional UPDATE: Postgres row locking re-checks the WHERE for a
  // second concurrent reclaim, which then matches nothing (its updated_at
  // is no longer before the cutoff), so exactly one request wins.
  async reclaimStalePending(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<SessionFeedback | null> {
    const [row] = await this.db
      .update(sessionFeedback)
      .set({ updatedAt: now })
      .where(
        and(
          eq(sessionFeedback.sessionKind, sessionKind),
          eq(sessionFeedback.sessionId, sessionId),
          eq(sessionFeedback.ownerId, ownerId),
          eq(sessionFeedback.status, "pending"),
          lt(sessionFeedback.updatedAt, staleBefore),
        ),
      )
      .returning();
    return row ? toFeedback(row) : null;
  }
}
