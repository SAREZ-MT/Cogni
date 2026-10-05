import type { ReviewLog, SessionKind } from "../../domain/review-log";
import type { ReviewLogRepository } from "../../domain/review-log-repository";

// In-memory ReviewLogRepository for unit tests; satisfies the shared
// contract (review-log-repository.contract.ts). Append-only, like the table;
// ties on reviewedAt break by id, as Drizzle's asc(reviewed_at), asc(id).
export class InMemoryReviewLogRepository implements ReviewLogRepository {
  private readonly rows: ReviewLog[] = [];

  // Captures the rows; the returned function restores them (the in-memory
  // unit of work's rollback).
  snapshot(): () => void {
    const saved = [...this.rows];
    return () => {
      this.rows.length = 0;
      this.rows.push(...saved);
    };
  }

  async append(log: ReviewLog): Promise<void> {
    this.rows.push(log);
  }

  async listByItem(itemId: string, ownerId: string): Promise<ReviewLog[]> {
    return this.rows
      .filter((log) => log.itemId === itemId && log.ownerId === ownerId)
      .sort(byReviewedAtThenId);
  }

  async listBySession(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<ReviewLog[]> {
    return this.rows
      .filter(
        (log) =>
          log.sessionKind === sessionKind &&
          log.sessionId === sessionId &&
          log.ownerId === ownerId,
      )
      .sort(byReviewedAtThenId);
  }
}

function byReviewedAtThenId(a: ReviewLog, b: ReviewLog): number {
  return (
    a.reviewedAt.getTime() - b.reviewedAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
