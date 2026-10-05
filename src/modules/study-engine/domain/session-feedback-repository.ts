import type { SessionKind } from "./review-log";
import type { SessionFeedback } from "./session-feedback";

// Persistence port for SessionFeedback; owner-scoped like every repository.
// A session has at most one feedback row (unique session_kind, session_id),
// which makes requesting feedback idempotent.
export interface SessionFeedbackRepository {
  // Inserts the row unless its session already has one. Returns false (and
  // changes nothing) when it does, e.g. a concurrent request won the race.
  create(feedback: SessionFeedback): Promise<boolean>;
  findBySession(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<SessionFeedback | null>;
  // Settles the row: stores status, content, generation and updatedAt only
  // while the stored row (same id and owner) is still "pending". Returns
  // whether it applied. A done or failed row is final and never
  // overwritten, so a slow request whose row was reclaimed and settled by
  // another one cannot replace that outcome.
  settlePending(feedback: SessionFeedback): Promise<boolean>;
  // Atomically takes over a "pending" row last touched before `staleBefore`
  // (its request died or hung): sets updatedAt to `now` and returns the
  // row. Returns null and changes nothing for a fresh pending row, a done
  // or failed row, another owner's row, or when a concurrent reclaim won.
  reclaimStalePending(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<SessionFeedback | null>;
}
