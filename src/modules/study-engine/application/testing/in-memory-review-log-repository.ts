import type { ReviewLog } from "../../domain/review-log";
import type { ReviewLogRepository } from "../../domain/review-log-repository";

// In-memory ReviewLogRepository for unit tests; satisfies the shared
// contract (review-log-repository.contract.ts). Append-only, like the table;
// ties on reviewedAt break by id, as Drizzle's asc(reviewed_at), asc(id).
export class InMemoryReviewLogRepository implements ReviewLogRepository {
  private readonly rows: ReviewLog[] = [];

  async append(log: ReviewLog): Promise<void> {
    this.rows.push(log);
  }

  async listByItem(itemId: string, ownerId: string): Promise<ReviewLog[]> {
    return this.rows
      .filter((log) => log.itemId === itemId && log.ownerId === ownerId)
      .sort(
        (a, b) =>
          a.reviewedAt.getTime() - b.reviewedAt.getTime() ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
  }
}
