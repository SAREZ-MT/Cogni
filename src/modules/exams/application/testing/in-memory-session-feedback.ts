import type {
  SessionFeedback,
  SessionFeedbackRepository,
  SessionKind,
} from "@/modules/study-engine";

// SessionFeedbackRepository for exams unit tests, with the table's unique
// (session_kind, session_id) key. study-engine proves the shared contract
// on its own fake and the Drizzle adapter; its fake lives in that module's
// testing folder, which other modules cannot import.
export class InMemorySessionFeedback implements SessionFeedbackRepository {
  readonly rows = new Map<string, SessionFeedback>();
  creates = 0;
  // Statuses whose settle throws before writing (database unavailable).
  readonly failSettlesOf = new Set<SessionFeedback["status"]>();

  private key(kind: SessionKind, sessionId: string): string {
    return `${kind}:${sessionId}`;
  }

  async create(feedback: SessionFeedback): Promise<boolean> {
    this.creates += 1;
    const key = this.key(feedback.sessionKind, feedback.sessionId);
    if (this.rows.has(key)) return false;
    this.rows.set(key, feedback);
    return true;
  }

  async findBySession(
    kind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<SessionFeedback | null> {
    const row = this.rows.get(this.key(kind, sessionId));
    return row && row.ownerId === ownerId ? row : null;
  }

  async settlePending(feedback: SessionFeedback): Promise<boolean> {
    if (this.failSettlesOf.has(feedback.status)) {
      throw new Error("database unavailable");
    }
    const key = this.key(feedback.sessionKind, feedback.sessionId);
    const row = this.rows.get(key);
    if (
      !row ||
      row.id !== feedback.id ||
      row.ownerId !== feedback.ownerId ||
      row.status !== "pending"
    ) {
      return false;
    }
    this.rows.set(key, feedback);
    return true;
  }

  async reclaimStalePending(
    kind: SessionKind,
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<SessionFeedback | null> {
    const row = await this.findBySession(kind, sessionId, ownerId);
    if (!row || row.status !== "pending" || row.updatedAt >= staleBefore) {
      return null;
    }
    const reclaimed = { ...row, updatedAt: now };
    this.rows.set(this.key(kind, sessionId), reclaimed);
    return reclaimed;
  }

  // Stores a row as is (a settled or pending row of an earlier request).
  put(feedback: SessionFeedback): void {
    this.rows.set(this.key(feedback.sessionKind, feedback.sessionId), feedback);
  }
}
