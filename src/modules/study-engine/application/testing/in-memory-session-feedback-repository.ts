import type { SessionKind } from "../../domain/review-log";
import type { SessionFeedback } from "../../domain/session-feedback";
import type { SessionFeedbackRepository } from "../../domain/session-feedback-repository";

// In-memory SessionFeedbackRepository for unit tests; satisfies the shared
// contract (session-feedback-repository.contract.ts), including the unique
// (session_kind, session_id) key of the table.
export class InMemorySessionFeedbackRepository
  implements SessionFeedbackRepository
{
  private readonly rows = new Map<string, SessionFeedback>();

  async create(feedback: SessionFeedback): Promise<boolean> {
    const key = keyOf(feedback.sessionKind, feedback.sessionId);
    if (this.rows.has(key)) return false;
    this.rows.set(key, feedback);
    return true;
  }

  async findBySession(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<SessionFeedback | null> {
    const row = this.rows.get(keyOf(sessionKind, sessionId));
    return row && row.ownerId === ownerId ? row : null;
  }

  async update(feedback: SessionFeedback): Promise<void> {
    const key = keyOf(feedback.sessionKind, feedback.sessionId);
    const row = this.rows.get(key);
    if (!row || row.ownerId !== feedback.ownerId || row.id !== feedback.id) {
      return;
    }
    this.rows.set(key, {
      ...row,
      status: feedback.status,
      content: feedback.content,
      generationId: feedback.generationId,
      updatedAt: feedback.updatedAt,
    });
  }

  // No await between the check and the write: atomic like the conditional
  // UPDATE of the Drizzle adapter.
  async reclaimStalePending(
    sessionKind: SessionKind,
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<SessionFeedback | null> {
    const key = keyOf(sessionKind, sessionId);
    const row = this.rows.get(key);
    if (
      !row ||
      row.ownerId !== ownerId ||
      row.status !== "pending" ||
      row.updatedAt.getTime() >= staleBefore.getTime()
    ) {
      return null;
    }
    const reclaimed = { ...row, updatedAt: now };
    this.rows.set(key, reclaimed);
    return reclaimed;
  }

  all(): SessionFeedback[] {
    return [...this.rows.values()];
  }
}

function keyOf(sessionKind: SessionKind, sessionId: string): string {
  return `${sessionKind}:${sessionId}`;
}
