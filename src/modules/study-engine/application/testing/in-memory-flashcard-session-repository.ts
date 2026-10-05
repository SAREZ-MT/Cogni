import type { FlashcardSession } from "../../domain/flashcard-session";
import type { FlashcardSessionRepository } from "../../domain/flashcard-session-repository";

// In-memory FlashcardSessionRepository for unit tests; satisfies the shared
// contract (flashcard-session-repository.contract.ts).
export class InMemoryFlashcardSessionRepository
  implements FlashcardSessionRepository
{
  private readonly rows = new Map<string, FlashcardSession>();

  async insert(session: FlashcardSession): Promise<void> {
    if (this.rows.has(session.id)) {
      throw new Error("duplicate flashcard session id");
    }
    this.rows.set(session.id, session);
  }

  async findById(
    id: string,
    ownerId: string,
  ): Promise<FlashcardSession | null> {
    const session = this.rows.get(id);
    return session && session.ownerId === ownerId ? session : null;
  }

  async recordGrade(
    id: string,
    ownerId: string,
    again: boolean,
  ): Promise<FlashcardSession | null> {
    const session = await this.findById(id, ownerId);
    if (!session) return null;
    const updated = {
      ...session,
      reviewedCount: session.reviewedCount + 1,
      againCount: session.againCount + (again ? 1 : 0),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async finish(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<FlashcardSession | null> {
    const session = await this.findById(id, ownerId);
    if (!session) return null;
    if (session.finishedAt !== null) return session;
    const finished = { ...session, finishedAt: now };
    this.rows.set(id, finished);
    return finished;
  }
}
