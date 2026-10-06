import type {
  RecallSession,
  RecallSessionEvaluationStatus,
} from "./recall-session";

// Persistence port for RecallSession (documento-maestro §6.1); owner-scoped.
export interface RecallSessionRepository {
  // Inserts a new (open, pending) session. Rejects a duplicate id.
  create(session: RecallSession): Promise<void>;
  findById(id: string, ownerId: string): Promise<RecallSession | null>;
  // findById that also row-locks the session until the surrounding unit of
  // work ends, so saving an answer and finishing the session queue: a
  // finish never misses an answer. Locks nothing outside a transaction and
  // in memory.
  lockById(id: string, ownerId: string): Promise<RecallSession | null>;
  // Closes an open session at `finishedAt`. A finished session keeps its
  // first finishedAt and is read back unchanged. Returns the stored
  // session, or null when the owner has no such session.
  finish(
    id: string,
    ownerId: string,
    finishedAt: Date,
  ): Promise<RecallSession | null>;
  // Stores the status derived from the answers (sessionEvaluationStatus).
  // Only a finished session leaves "pending": rejects done or partial on an
  // open one. Returns the stored session, or null when the owner has no
  // such session.
  setEvaluationStatus(
    id: string,
    ownerId: string,
    status: RecallSessionEvaluationStatus,
    now: Date,
  ): Promise<RecallSession | null>;
  // The page's latest sessions, the latest started first (startedAt, then
  // id, both descending), at most `limit`.
  listByPage(
    pageId: string,
    ownerId: string,
    limit: number,
  ): Promise<RecallSession[]>;
  // The owner's latest sessions on any page, same order, at most `limit`:
  // what the active-recall hub lists.
  listRecentByOwner(ownerId: string, limit: number): Promise<RecallSession[]>;
}
