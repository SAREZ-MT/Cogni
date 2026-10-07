import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  type RecallSession,
  sessionEvaluationStatus,
} from "../domain/recall-session";
import {
  lockSession,
  type RecallSessionRepositories,
  type RecallSessionUnitOfWork,
} from "./recall-session-work";
import { runRecallWork } from "./recall-unit-of-work";

export interface FinishRecallSessionDeps {
  uow: RecallSessionUnitOfWork;
  clock: Clock;
}

export interface FinishedRecallSession {
  session: RecallSession;
  // Answers stored in the session (saved and skipped ones); questions never
  // reached are not recorded.
  answeredCount: number;
  // True when the session had already finished (a repeated "Terminar").
  alreadyFinished: boolean;
}

// Closes a session ("Terminar" or the last question): it holds only the
// answers saved so far; unanswered questions are not recorded (user
// decision 2026-10-06). Closing never waits for the AI: the answers stay
// pending for the asynchronous evaluation (§8.5, Phase 6 T6), so the
// session stays "pending". A session without answers has nothing to
// evaluate and closes as "done" (sessionEvaluationStatus of no answers).
// The session row is locked first, so a finish waits for an in-flight
// save. A repeat is idempotent: the stored session is returned unchanged.
// Missing or another owner's session: RECALL_SESSION_NOT_FOUND.
export async function finishRecallSession(
  input: { sessionId: string },
  deps: FinishRecallSessionDeps,
  ownerId: string,
): Promise<Result<FinishedRecallSession, DomainError>> {
  return runRecallWork<
    RecallSessionRepositories,
    FinishedRecallSession,
    DomainError
  >(deps.uow, async (repos) => {
    const locked = await lockSession(input.sessionId, ownerId, repos);
    if (!locked.ok) return locked;
    const answers = await repos.answers.listBySession(input.sessionId, ownerId);
    if (locked.value.finishedAt !== null) {
      return ok({
        session: locked.value,
        answeredCount: answers.length,
        alreadyFinished: true,
      });
    }
    const now = deps.clock.now();
    let session =
      (await repos.sessions.finish(input.sessionId, ownerId, now)) ??
      locked.value;
    const status = sessionEvaluationStatus(answers);
    if (status !== session.evaluationStatus) {
      session =
        (await repos.sessions.setEvaluationStatus(
          input.sessionId,
          ownerId,
          status,
          now,
        )) ?? session;
    }
    return ok({
      session,
      answeredCount: answers.length,
      alreadyFinished: false,
    });
  });
}
