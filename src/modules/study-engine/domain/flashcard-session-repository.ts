import type { FlashcardSession } from "./flashcard-session";

// Persistence port for FlashcardSession; owner-scoped like every
// repository: another owner's sessions are invisible and untouchable.
export interface FlashcardSessionRepository {
  insert(session: FlashcardSession): Promise<void>;
  findById(id: string, ownerId: string): Promise<FlashcardSession | null>;
  // Counts one graded answer (and one "Otra vez" when `again`) atomically,
  // so concurrent grades never lose an increment. Returns the updated
  // session, or null when the owner has no such session.
  recordGrade(
    id: string,
    ownerId: string,
    again: boolean,
  ): Promise<FlashcardSession | null>;
  // Closes the session. Idempotent: an already finished session keeps its
  // first finishedAt. Returns the session, or null when the owner has no
  // such session.
  finish(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<FlashcardSession | null>;
}
