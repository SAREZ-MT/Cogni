import { isDueBefore, type StudyItemRepository } from "@/modules/study-engine";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { composeRecallSession } from "../domain/composition";
import { RECALL_ERROR } from "../domain/errors";
import type { RecallAnswerRepository } from "../domain/recall-answer-repository";
import type { RecallQuestion } from "../domain/recall-question";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";
import type { RecallSession } from "../domain/recall-session";
import type { RecallSessionRepository } from "../domain/recall-session-repository";
import type { UnitOfWorkOf } from "./recall-unit-of-work";

export interface RecallSessionRepositories {
  readonly questions: RecallQuestionRepository;
  readonly sessions: RecallSessionRepository;
  readonly answers: RecallAnswerRepository;
  // The SM-2 state of the page's questions (due, new, last reviewed):
  // every question owns one StudyItem(kind = "recall_question").
  readonly studyItems: Pick<StudyItemRepository, "listByPage">;
}

// One transaction over everything a recall session reads and writes.
export type RecallSessionUnitOfWork = UnitOfWorkOf<RecallSessionRepositories>;

// The questions of a new session on a page, in the order shown:
// composeRecallSession over the page's active questions and their study
// items. Suspended items never enter a session. An item counts as:
//   - due when it was reviewed and dueAt < dueBefore, the owner's "due"
//     bound (the start of their next local day: reviews are due per day,
//     user decision 2026-10-18), oldest due first (the engine's listDue
//     order);
//   - new when it was never reviewed (study-engine creates it already due);
//   - reviewed otherwise, filling the session least recently reviewed
//     first (user decision 2026-10-06: a session can start any time).
export async function composeRecallQuestions(
  input: { pageId: string; dueBefore: Date },
  ownerId: string,
  repos: Pick<RecallSessionRepositories, "questions" | "studyItems">,
): Promise<RecallQuestion[]> {
  const questions = await repos.questions.listActiveByPage(
    input.pageId,
    ownerId,
  );
  if (questions.length === 0) return [];
  const items = (await repos.studyItems.listByPage(input.pageId, ownerId))
    .filter((item) => item.kind === "recall_question" && !item.suspendedAt)
    .sort(
      (a, b) => a.dueAt.getTime() - b.dueAt.getTime() || (a.id < b.id ? -1 : 1),
    );
  const dueIds: string[] = [];
  const newIds: string[] = [];
  const reviewed: { id: string; lastReviewedAt: Date }[] = [];
  for (const item of items) {
    if (item.lastReviewedAt === null) newIds.push(item.sourceId);
    else if (isDueBefore(item, input.dueBefore)) dueIds.push(item.sourceId);
    else
      reviewed.push({ id: item.sourceId, lastReviewedAt: item.lastReviewedAt });
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  return composeRecallSession({ questions, dueIds, newIds, reviewed }).flatMap(
    (id) => {
      const question = byId.get(id);
      return question ? [question] : [];
    },
  );
}

// The owner's session, row-locked until the unit of work ends, refused when
// missing (RECALL_SESSION_NOT_FOUND).
export async function lockSession(
  sessionId: string,
  ownerId: string,
  repos: Pick<RecallSessionRepositories, "sessions">,
): Promise<Result<RecallSession, DomainError>> {
  const session = await repos.sessions.lockById(sessionId, ownerId);
  if (!session) {
    return err(
      new DomainError(
        RECALL_ERROR.SESSION_NOT_FOUND,
        `recall session ${sessionId} not found`,
      ),
    );
  }
  return ok(session);
}
