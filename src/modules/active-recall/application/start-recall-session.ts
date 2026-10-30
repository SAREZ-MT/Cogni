import type { PageTextReader } from "@/modules/notebooks";
import type { DueCutoff } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import { newRecallSession, type RecallSession } from "../domain/recall-session";
import {
  composeRecallQuestions,
  type RecallSessionUnitOfWork,
} from "./recall-session-work";
import { runRecallWork } from "./recall-unit-of-work";

export interface StartRecallSessionDeps {
  pages: PageTextReader;
  uow: RecallSessionUnitOfWork;
  clock: Clock;
  // The owner's per-day "due" bound (start of their next local day): a
  // question due later today is among the due ones.
  dueCutoff: DueCutoff;
  ids: { next(): string };
}

// What the player shows of a question: never its rubric (§8.5, the rubric
// is only for the AI evaluation).
export interface RecallSessionQuestion {
  id: string;
  prompt: string;
}

export interface StartedRecallSession {
  session: RecallSession;
  // In the order shown (composeRecallQuestions).
  questions: RecallSessionQuestion[];
}

// Opens a new active-recall session on a page (§3.3, RF-AR-02): up to 10
// questions, due first, then new, then the least recently reviewed, so a
// page with questions can always be practised. The session starts open and
// pending (nothing to evaluate yet).
//
// - A missing, archived or another owner's page: PAGE_NOT_FOUND.
// - No active question that can be scheduled: RECALL_NO_QUESTIONS.
// Nothing is written on a refusal. The question list is not stored: the
// session accepts answers to any active question of its page (answers are
// checked against the session's page) and only the answered ones count.
export async function startRecallSession(
  input: { pageId: string },
  deps: StartRecallSessionDeps,
  ownerId: string,
): Promise<Result<StartedRecallSession, DomainError>> {
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  const now = deps.clock.now();
  const id = deps.ids.next();

  return runRecallWork(
    deps.uow,
    async (repos): Promise<Result<StartedRecallSession, DomainError>> => {
      const questions = await composeRecallQuestions(
        { pageId: input.pageId, dueBefore: deps.dueCutoff(now) },
        ownerId,
        repos,
      );
      if (questions.length === 0) {
        return err(
          new DomainError(
            RECALL_ERROR.NO_QUESTIONS,
            `page ${input.pageId} has no recall question to practise`,
          ),
        );
      }
      const session = newRecallSession(
        { id, ownerId, pageId: input.pageId },
        now,
      );
      await repos.sessions.create(session);
      return ok({
        session,
        questions: questions.map(({ id, prompt }) => ({ id, prompt })),
      });
    },
  );
}
