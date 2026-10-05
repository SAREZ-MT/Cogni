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
  // Stores status, content, generation and updatedAt of an existing row of
  // the same owner; another owner's row is left untouched.
  update(feedback: SessionFeedback): Promise<void>;
}
