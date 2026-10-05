import type { ExamAnswer } from "./exam-session";

// Persistence port for ExamAnswer (documento-maestro §6.1); owner-scoped.
// A session holds at most one answer per question and per root.
export interface ExamAnswerRepository {
  // Inserts every answer or none: rejects (writing nothing) a session that
  // is not the owner's, and a second answer to a question or root of the
  // session, whether inside `answers` or already stored.
  saveMany(answers: readonly ExamAnswer[], ownerId: string): Promise<void>;
  // The session's answers, oldest first (answeredAt, then questionId).
  listBySession(sessionId: string, ownerId: string): Promise<ExamAnswer[]>;
}
