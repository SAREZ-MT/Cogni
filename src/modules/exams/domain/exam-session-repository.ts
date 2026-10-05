import type { ExamSession } from "./exam-session";

// Persistence port for ExamSession (documento-maestro §6.1); owner-scoped.
export interface ExamSessionRepository {
  // Inserts a new (open) session. Rejects a duplicate id.
  create(session: ExamSession): Promise<void>;
  findById(id: string, ownerId: string): Promise<ExamSession | null>;
  // findById that also row-locks the session until the surrounding unit of
  // work ends, so answering and finishing one session queue: a finish
  // never misses an answer and two finishes never both score it. Locks
  // nothing outside a transaction and in memory.
  lockById(id: string, ownerId: string): Promise<ExamSession | null>;
  // The page's open (unfinished) normal session, the latest started first;
  // null when there is none. Retakes are not returned.
  findOpenByPage(pageId: string, ownerId: string): Promise<ExamSession | null>;
  // The page's open (unfinished) retake, the latest started first; null
  // when there is none. A started retake is resumed instead of generating
  // its variants again (§7.5).
  findOpenRetakeByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSession | null>;
  // Serializes the starts of exams on one page until the surrounding unit
  // of work ends (transaction-scoped advisory lock), so two concurrent
  // starts cannot both create an open session. A no-op in memory.
  lockPageForStart(pageId: string, ownerId: string): Promise<void>;
  // Stores the result of a session finished by finishExamSession. Only an
  // open session changes; a finished one keeps its first result and is read
  // back unchanged. Returns the stored session, or null when the owner has
  // no such session.
  finish(session: ExamSession): Promise<ExamSession | null>;
  // The page's finished sessions, oldest finish first (finishedAt, then
  // id): the history decideFeedback reads.
  listFinishedByPage(pageId: string, ownerId: string): Promise<ExamSession[]>;
}
