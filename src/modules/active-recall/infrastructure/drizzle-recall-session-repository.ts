import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type RecallSessionRow, recallSessions } from "@/shared/db/schema";
import type {
  RecallSession,
  RecallSessionEvaluationStatus,
} from "../domain/recall-session";
import type { RecallSessionRepository } from "../domain/recall-session-repository";

function toSession(row: RecallSessionRow): RecallSession {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    evaluationStatus: row.evaluationStatus,
  };
}

// Drizzle implementation of RecallSessionRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction.
export class DrizzleRecallSessionRepository implements RecallSessionRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(session: RecallSession): Promise<void> {
    await this.db.insert(recallSessions).values({
      ...session,
      createdAt: session.startedAt,
      updatedAt: session.startedAt,
    });
  }

  async findById(id: string, ownerId: string): Promise<RecallSession | null> {
    const [row] = await this.db
      .select()
      .from(recallSessions)
      .where(owned(id, ownerId));
    return row ? toSession(row) : null;
  }

  async lockById(id: string, ownerId: string): Promise<RecallSession | null> {
    const [row] = await this.db
      .select()
      .from(recallSessions)
      .where(owned(id, ownerId))
      .for("update");
    return row ? toSession(row) : null;
  }

  async finish(
    id: string,
    ownerId: string,
    finishedAt: Date,
  ): Promise<RecallSession | null> {
    // Only an open session changes; a finished one keeps its first
    // finished_at and is read back unchanged.
    await this.db
      .update(recallSessions)
      .set({ finishedAt, updatedAt: finishedAt })
      .where(and(owned(id, ownerId), isNull(recallSessions.finishedAt)));
    return this.findById(id, ownerId);
  }

  async setEvaluationStatus(
    id: string,
    ownerId: string,
    status: RecallSessionEvaluationStatus,
    now: Date,
  ): Promise<RecallSession | null> {
    // recall_sessions_evaluation_status_check rejects done or partial on an
    // open session.
    const [row] = await this.db
      .update(recallSessions)
      .set({ evaluationStatus: status, updatedAt: now })
      .where(owned(id, ownerId))
      .returning();
    return row ? toSession(row) : null;
  }

  async listByPage(
    pageId: string,
    ownerId: string,
    limit: number,
  ): Promise<RecallSession[]> {
    const rows = await this.db
      .select()
      .from(recallSessions)
      .where(
        and(
          eq(recallSessions.pageId, pageId),
          eq(recallSessions.ownerId, ownerId),
        ),
      )
      .orderBy(desc(recallSessions.startedAt), desc(recallSessions.id))
      .limit(limit);
    return rows.map(toSession);
  }

  async listRecentByOwner(
    ownerId: string,
    limit: number,
  ): Promise<RecallSession[]> {
    const rows = await this.db
      .select()
      .from(recallSessions)
      .where(eq(recallSessions.ownerId, ownerId))
      .orderBy(desc(recallSessions.startedAt), desc(recallSessions.id))
      .limit(limit);
    return rows.map(toSession);
  }
}

function owned(id: string, ownerId: string) {
  return and(eq(recallSessions.id, id), eq(recallSessions.ownerId, ownerId));
}
