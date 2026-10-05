import type {
  RecordExamReviewsInput,
  RecordedExamReviews,
  StudyItemRepository,
} from "@/modules/study-engine";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { composeExam, type ExamCandidate } from "../domain/composition";
import type { ExamAnswerRepository } from "../domain/exam-answer-repository";
import type { ExamPageStateRepository } from "../domain/exam-page-state-repository";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamQuestionRepository } from "../domain/exam-question-repository";
import type { ExamSession } from "../domain/exam-session";
import type { ExamSessionRepository } from "../domain/exam-session-repository";
import type { UnitOfWorkOf } from "./exam-unit-of-work";

// The SM-2 side of a finished exam: study-engine's recordExamReviews,
// bound to the same transaction as the session's finish (a savepoint), so
// the reviews and the result commit or roll back together.
export interface ExamReviews {
  record(
    input: RecordExamReviewsInput,
  ): Promise<Result<RecordedExamReviews, DomainError>>;
}

export interface ExamSessionRepositories {
  readonly questions: ExamQuestionRepository;
  readonly sessions: ExamSessionRepository;
  readonly answers: ExamAnswerRepository;
  readonly pageStates: ExamPageStateRepository;
  // Due dates of the page's roots (composeExam's "due" group).
  readonly studyItems: Pick<StudyItemRepository, "listByPage">;
  readonly reviews: ExamReviews;
}

// One transaction over everything an exam session reads and writes.
export type ExamSessionUnitOfWork = UnitOfWorkOf<ExamSessionRepositories>;

// The questions of a normal exam session, in order. The order is not
// stored (exam_sessions has no column for it); it is derived again, the
// same every time, from the page as it was when the session started:
//   - the questions shown at startedAt (listShownAt), the latest wording
//     of each root, so questions added or retired later change nothing;
//   - lastSeenAt from answers given before startedAt, so this session's own
//     answers never reorder it;
//   - due dates from the roots' study items and failed roots from the page
//     state, which only a finished exam of the page changes, and a page
//     holds at most one open normal session (startExamSession resumes it),
//     so they cannot move while the session is open;
//   - composeExam with now = startedAt.
// A finished session is read from its answers instead (readExamSession).
export async function composeSessionQuestions(
  session: ExamSession,
  repos: Pick<
    ExamSessionRepositories,
    "questions" | "answers" | "pageStates" | "studyItems"
  >,
): Promise<Result<ExamQuestion[], DomainError>> {
  if (session.isRetake) {
    // Retakes are composed from fresh variants (composeRetake), Phase 5 T7.
    throw new Error(`retake session ${session.id} is not supported yet`);
  }
  const { pageId, ownerId, startedAt } = session;
  const shown = await repos.questions.listShownAt(pageId, ownerId, startedAt);
  // listShownAt is oldest first: the last question of a root wins.
  const latestByRoot = new Map<string, ExamQuestion>();
  for (const question of shown) latestByRoot.set(question.rootId, question);

  const state = await repos.pageStates.get(pageId, ownerId);
  const failed = new Set(state?.failedRootIds ?? []);
  const items = await repos.studyItems.listByPage(pageId, ownerId);
  const dueByRoot = new Map(
    items
      .filter((item) => item.kind === "exam_question")
      .map((item) => [item.sourceId, item.dueAt]),
  );
  const seen = await repos.answers.lastAnsweredAtByRoot(
    pageId,
    ownerId,
    startedAt,
  );

  const candidates: ExamCandidate[] = [...latestByRoot.values()].map(
    (question) => ({
      rootId: question.rootId,
      questionId: question.id,
      failedLastTime: failed.has(question.rootId),
      dueAt: dueByRoot.get(question.rootId) ?? null,
      lastSeenAt: seen.get(question.rootId) ?? null,
    }),
  );
  const composed = composeExam({
    requestedCount: session.requestedCount,
    candidates,
    now: startedAt,
  });
  if (!composed.ok) return composed;
  return ok(
    composed.value.flatMap(({ rootId }) => {
      const question = latestByRoot.get(rootId);
      return question ? [question] : [];
    }),
  );
}
