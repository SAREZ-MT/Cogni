import { and, asc, eq } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type ReviewLogRow, reviewLogs } from "@/shared/db/schema";
import type { ReviewLog } from "../domain/review-log";
import type { ReviewLogRepository } from "../domain/review-log-repository";

function toReviewLog(row: ReviewLogRow): ReviewLog {
  return {
    id: row.id,
    ownerId: row.ownerId,
    itemId: row.itemId,
    quality: row.quality,
    reviewedAt: row.reviewedAt,
    intervalBefore: row.intervalBefore,
    intervalAfter: row.intervalAfter,
    easinessAfter: row.easinessAfter,
    sessionKind: row.sessionKind,
    sessionId: row.sessionId,
  };
}

// Drizzle implementation of ReviewLogRepository: insert-only, every read
// filters by owner_id (documento-maestro §6.1).
export class DrizzleReviewLogRepository implements ReviewLogRepository {
  constructor(private readonly db: DbExecutor) {}

  async append(log: ReviewLog): Promise<void> {
    await this.db.insert(reviewLogs).values({
      id: log.id,
      ownerId: log.ownerId,
      itemId: log.itemId,
      quality: log.quality,
      reviewedAt: log.reviewedAt,
      intervalBefore: log.intervalBefore,
      intervalAfter: log.intervalAfter,
      easinessAfter: log.easinessAfter,
      sessionKind: log.sessionKind,
      sessionId: log.sessionId,
    });
  }

  async listByItem(itemId: string, ownerId: string): Promise<ReviewLog[]> {
    const rows = await this.db
      .select()
      .from(reviewLogs)
      .where(
        and(eq(reviewLogs.itemId, itemId), eq(reviewLogs.ownerId, ownerId)),
      )
      .orderBy(asc(reviewLogs.reviewedAt), asc(reviewLogs.id));
    return rows.map(toReviewLog);
  }
}
