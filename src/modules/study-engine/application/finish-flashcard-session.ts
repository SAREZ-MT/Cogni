import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import type { FlashcardSession } from "../domain/flashcard-session";
import type { FlashcardSessionRepository } from "../domain/flashcard-session-repository";

// Closes a flashcard session and returns it with its counts (reviewed and
// "Otra vez"). Idempotent; never reports study time (product rule).
export async function finishFlashcardSession(
  input: { sessionId: string },
  deps: {
    sessions: Pick<FlashcardSessionRepository, "finish">;
    clock: Clock;
  },
  ownerId: string,
): Promise<Result<FlashcardSession, DomainError>> {
  const session = await deps.sessions.finish(
    input.sessionId,
    ownerId,
    deps.clock.now(),
  );
  if (!session) {
    return err(
      new DomainError(STUDY_ENGINE_ERROR.SESSION_NOT_FOUND, input.sessionId),
    );
  }
  return ok(session);
}
