import type { ReviewLog, SessionKind } from "./review-log";

// Append-only history of graded answers (documento-maestro §6.1). Logs are
// never updated or deleted by the application; they go away only with
// their item (cascade).
export interface ReviewLogRepository {
  append(log: ReviewLog): Promise<void>;
  // Oldest review first; owner-scoped.
  listByItem(itemId: string, ownerId: string): Promise<ReviewLog[]>;
  // Every answer graded in one session, oldest first; owner-scoped.
  listBySession(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<ReviewLog[]>;
}
