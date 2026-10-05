import type { PageTextReader } from "@/modules/notebooks";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import {
  type ExamSession,
  invalidCount,
  isValidQuestionCount,
  newExamSession,
} from "../domain/exam-session";
import {
  composeNormalExam,
  type ExamSessionUnitOfWork,
} from "./exam-session-work";
import { runExamWork } from "./exam-unit-of-work";

export interface StartExamSessionDeps {
  pages: PageTextReader;
  uow: ExamSessionUnitOfWork;
  clock: Clock;
  ids: { next(): string };
}

export interface StartedExamSession {
  session: ExamSession;
  // True when the page's open session was returned instead of a new one.
  resumed: boolean;
}

// Starts a normal exam on a page (§3.3: N questions, 10 to 30, 10 by
// default). An exam can start any time, even with nothing due.
//
// - A pending retake refuses (EXAMS_RETAKE_PENDING): a failed page is only
//   examined again with reformulated questions (§7.5, Phase 5 T7), never
//   with the failed wordings.
// - An open normal session of the page is resumed as it is (its N and its
//   questions), so a page holds at most one open session and an abandoned
//   exam picks up where it stopped. Starts of one page are serialized
//   (lockPageForStart) so two concurrent starts cannot both create one.
// - Otherwise the questions are composed (composeExam: fewer than 10 roots
//   is EXAMS_NOT_ENOUGH_QUESTIONS) and the session is stored with that
//   list (questionIds): answering, finishing and reading use it as it is,
//   never a new composition.
export async function startExamSession(
  input: { pageId: string; requestedCount: number },
  deps: StartExamSessionDeps,
  ownerId: string,
): Promise<Result<StartedExamSession, DomainError>> {
  // Missing, archived or another owner's page: PAGE_NOT_FOUND, no write.
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;

  if (!isValidQuestionCount(input.requestedCount)) {
    return err(invalidCount(input.requestedCount));
  }
  const now = deps.clock.now();
  const id = deps.ids.next();

  return runExamWork(
    deps.uow,
    async (repos): Promise<Result<StartedExamSession, DomainError>> => {
      await repos.sessions.lockPageForStart(input.pageId, ownerId);
      const state = await repos.pageStates.get(input.pageId, ownerId);
      if (state?.retakePending) {
        return err(
          new DomainError(
            EXAM_ERROR.RETAKE_PENDING,
            `page ${input.pageId} has a pending retake`,
          ),
        );
      }
      const open = await repos.sessions.findOpenByPage(input.pageId, ownerId);
      if (open) return ok({ session: open, resumed: true });

      const questionIds = await composeNormalExam(
        { ...input, now },
        ownerId,
        repos,
      );
      if (!questionIds.ok) return questionIds;
      const session = newExamSession(
        {
          id,
          ownerId,
          pageId: input.pageId,
          requestedCount: input.requestedCount,
          retakeOfSessionId: null,
          questionIds: questionIds.value,
        },
        now,
      );
      if (!session.ok) return session;
      await repos.sessions.create(session.value);
      return ok({ session: session.value, resumed: false });
    },
  );
}
