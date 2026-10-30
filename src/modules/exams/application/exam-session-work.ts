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

// The questions of a session in their stored order (session.questionIds,
// fixed at the start). Nothing is composed again: answering, finishing and
// reading an open or a finished session all see the list the student was
// shown, whatever happened to the page's questions or study items since.
// Questions retired after the start still show; questions are retired,
// never deleted, so every stored id resolves.
export async function loadSessionQuestions(
  session: ExamSession,
  repos: Pick<ExamSessionRepositories, "questions">,
): Promise<ExamQuestion[]> {
  const found = await repos.questions.listByIds(
    session.questionIds,
    session.ownerId,
  );
  const byId = new Map(found.map((question) => [question.id, question]));
  return session.questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });
}

// The page's candidates of an exam at `now`, one per root:
//   - the page's questions shown at `now`, the latest wording of each root;
//   - due dates from the roots' study items, failed roots from the page
//     state and lastSeenAt from the page's earlier answers.
export async function listExamCandidates(
  input: { pageId: string; now: Date },
  ownerId: string,
  repos: Pick<
    ExamSessionRepositories,
    "questions" | "answers" | "pageStates" | "studyItems"
  >,
): Promise<ExamCandidate[]> {
  const { pageId, now } = input;
  const shown = await repos.questions.listShownAt(pageId, ownerId, now);
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
  const seen = await repos.answers.lastAnsweredAtByRoot(pageId, ownerId, now);

  return [...latestByRoot.values()].map((question) => ({
    rootId: question.rootId,
    questionId: question.id,
    failedLastTime: failed.has(question.rootId),
    dueAt: dueByRoot.get(question.rootId) ?? null,
    lastSeenAt: seen.get(question.rootId) ?? null,
  }));
}

// The question ids of a new normal exam on a page, in the order shown:
// composeExam over listExamCandidates (fewer than 10 roots is
// EXAMS_NOT_ENOUGH_QUESTIONS). Called once, by startExamSession; the
// result is stored on the session.
export async function composeNormalExam(
  input: {
    pageId: string;
    requestedCount: number;
    now: Date;
    // The owner's "due" bound at `now` (start of their next local day).
    dueBefore: Date;
  },
  ownerId: string,
  repos: Pick<
    ExamSessionRepositories,
    "questions" | "answers" | "pageStates" | "studyItems"
  >,
): Promise<Result<string[], DomainError>> {
  const candidates = await listExamCandidates(input, ownerId, repos);
  const composed = composeExam({
    requestedCount: input.requestedCount,
    candidates,
    dueBefore: input.dueBefore,
  });
  if (!composed.ok) return composed;
  return ok(composed.value.map(({ questionId }) => questionId));
}
