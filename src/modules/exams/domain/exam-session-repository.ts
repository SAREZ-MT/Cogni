import type { ExamSession } from "./exam-session";

// Persistence port for ExamSession (documento-maestro §6.1); owner-scoped.
export interface ExamSessionRepository {
  // Inserts a new (open) session. Rejects a duplicate id.
  create(session: ExamSession): Promise<void>;
  findById(id: string, ownerId: string): Promise<ExamSession | null>;
  // Stores the result of a session finished by finishExamSession. Only an
  // open session changes; a finished one keeps its first result and is read
  // back unchanged. Returns the stored session, or null when the owner has
  // no such session.
  finish(session: ExamSession): Promise<ExamSession | null>;
  // The page's finished sessions, oldest finish first (finishedAt, then
  // id): the history decideFeedback reads.
  listFinishedByPage(pageId: string, ownerId: string): Promise<ExamSession[]>;
}
