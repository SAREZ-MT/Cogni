import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type ExamSessionRow, examSessions } from "@/shared/db/schema";
import type { ExamSession } from "../domain/exam-session";
import type { ExamSessionRepository } from "../domain/exam-session-repository";

function toSession(row: ExamSessionRow): ExamSession {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    requestedCount: row.requestedCount,
    isRetake: row.isRetake,
    retakeOfSessionId: row.retakeOfSessionId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    total: row.total,
    correct: row.correct,
    score: row.score,
    passed: row.passed,
  };
}

// Drizzle implementation of ExamSessionRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction.
export class DrizzleExamSessionRepository implements ExamSessionRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(session: ExamSession): Promise<void> {
    await this.db.insert(examSessions).values({
      ...session,
      createdAt: session.startedAt,
      updatedAt: session.startedAt,
    });
  }

  async findById(id: string, ownerId: string): Promise<ExamSession | null> {
    const [row] = await this.db
      .select()
      .from(examSessions)
      .where(owned(id, ownerId));
    return row ? toSession(row) : null;
  }

  async lockById(id: string, ownerId: string): Promise<ExamSession | null> {
    const [row] = await this.db
      .select()
      .from(examSessions)
      .where(owned(id, ownerId))
      .for("update");
    return row ? toSession(row) : null;
  }

  async findOpenByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSession | null> {
    const [row] = await this.db
      .select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.pageId, pageId),
          eq(examSessions.ownerId, ownerId),
          isNull(examSessions.finishedAt),
          eq(examSessions.isRetake, false),
        ),
      )
      .orderBy(desc(examSessions.startedAt), desc(examSessions.id))
      .limit(1);
    return row ? toSession(row) : null;
  }

  async lockPageForStart(pageId: string, ownerId: string): Promise<void> {
    // Transaction-scoped advisory lock keyed by owner and page: released at
    // commit or rollback, so it needs no row to exist (a page's first exam
    // has no exam_page_state row to lock yet).
    await this.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`exam-start:${ownerId}:${pageId}`}, 0))`,
    );
  }

  async finish(session: ExamSession): Promise<ExamSession | null> {
    // Only an open session changes; a finished one keeps its first result
    // and is read back unchanged.
    await this.db
      .update(examSessions)
      .set({
        finishedAt: session.finishedAt,
        total: session.total,
        correct: session.correct,
        score: session.score,
        passed: session.passed,
        updatedAt: session.finishedAt ?? undefined,
      })
      .where(
        and(
          owned(session.id, session.ownerId),
          isNull(examSessions.finishedAt),
        ),
      );
    return this.findById(session.id, session.ownerId);
  }

  async listFinishedByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSession[]> {
    const rows = await this.db
      .select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.pageId, pageId),
          eq(examSessions.ownerId, ownerId),
          isNotNull(examSessions.finishedAt),
        ),
      )
      .orderBy(asc(examSessions.finishedAt), asc(examSessions.id));
    return rows.map(toSession);
  }
}

function owned(id: string, ownerId: string) {
  return and(eq(examSessions.id, id), eq(examSessions.ownerId, ownerId));
}
