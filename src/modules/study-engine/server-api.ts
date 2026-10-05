// Server-side factories other modules use (same role as
// notebooks/server-api.ts): composition roots without "use server",
// reached only through this module's index.ts.
import type { DbExecutor } from "@/shared/db/client";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import {
  finishFlashcardSession,
  type GradedFlashcard,
  gradeFlashcard,
  type MasteryRecomputeSummary,
  type PageAccess,
  type RecordExamReviewsInput,
  type RecordedExamReviews,
  recomputeAllPageMastery,
  recordExamReviews,
  type StartedFlashcardSession,
  startFlashcardSession,
} from "./application";
import type { FlashcardSession } from "./domain/flashcard-session";
import type { FlashcardSessionRepository } from "./domain/flashcard-session-repository";
import type { ReviewLogRepository } from "./domain/review-log-repository";
import type { SessionFeedbackRepository } from "./domain/session-feedback-repository";
import type { StudiedPage } from "./domain/studied-page-reader";
import type { FlashcardRating } from "./domain/study-item";
import type { StudyItemRepository } from "./domain/study-item-repository";
import {
  DrizzleFlashcardSessionRepository,
  DrizzleReviewLogRepository,
  DrizzleSessionFeedbackRepository,
  DrizzleStudiedPageReader,
  DrizzleStudyItemRepository,
  DrizzleStudyUnitOfWork,
} from "./infrastructure";

// `db` may be an open transaction, so the items join the caller's commit
// (flashcards' DrizzleDeckUnitOfWork creates a card and its item together).
export function createStudyItemRepository(db: DbExecutor): StudyItemRepository {
  return new DrizzleStudyItemRepository(db);
}

// The flashcard review session (§3.3) as the flashcards Server Actions
// call it; study-engine owns the scheduling, flashcards owns the card text.
export interface FlashcardSessionsServerApi {
  start(
    ownerId: string,
    input: { pageId?: string },
  ): Promise<Result<StartedFlashcardSession, DomainError>>;
  grade(
    ownerId: string,
    input: { sessionId: string; itemId: string; rating: FlashcardRating },
  ): Promise<Result<GradedFlashcard, DomainError>>;
  finish(
    ownerId: string,
    input: { sessionId: string },
  ): Promise<Result<FlashcardSession, DomainError>>;
}

export function createFlashcardSessionsServerApi(deps: {
  db: DbExecutor;
  pages: PageAccess;
  clock: Clock;
  ids: { next(): string };
}): FlashcardSessionsServerApi {
  const { db, pages, clock, ids } = deps;
  const sessions = new DrizzleFlashcardSessionRepository(db);
  return {
    start: (ownerId, input) =>
      startFlashcardSession(
        input,
        {
          pages,
          studyItems: new DrizzleStudyItemRepository(db),
          sessions,
          clock,
          ids,
        },
        ownerId,
      ),
    grade: (ownerId, input) =>
      gradeFlashcard(
        input,
        { uow: new DrizzleStudyUnitOfWork(db), clock, ids },
        ownerId,
      ),
    finish: (ownerId, input) =>
      finishFlashcardSession(input, { sessions, clock }, ownerId),
  };
}

// Feeds a finished exam's answers to the SM-2 engine (recordExamReviews).
// `db` may be the exams module's open transaction: the reviews then run in
// a savepoint of it and commit or roll back with the session's finish,
// answers and page state. Create each root's study item with
// createStudyItemRepository on the same transaction.
export interface ExamReviewRecorder {
  record(
    input: RecordExamReviewsInput,
  ): Promise<Result<RecordedExamReviews, DomainError>>;
}

export function createExamReviewRecorder(deps: {
  db: DbExecutor;
  ids: { next(): string };
}): ExamReviewRecorder {
  const { db, ids } = deps;
  return {
    record: (input) =>
      recordExamReviews(input, { uow: new DrizzleStudyUnitOfWork(db), ids }),
  };
}

// What a technique's session feedback reads and writes (flashcards'
// requestSessionFeedback): the finished session, its graded answers, their
// items and the session's single feedback row.
export interface SessionFeedbackSources {
  sessions: FlashcardSessionRepository;
  reviewLogs: ReviewLogRepository;
  studyItems: StudyItemRepository;
  feedback: SessionFeedbackRepository;
}

export function createSessionFeedbackSources(
  db: DbExecutor,
): SessionFeedbackSources {
  return {
    sessions: new DrizzleFlashcardSessionRepository(db),
    reviewLogs: new DrizzleReviewLogRepository(db),
    studyItems: new DrizzleStudyItemRepository(db),
    feedback: new DrizzleSessionFeedbackRepository(db),
  };
}

// The daily mastery job (/api/recompute-mastery). Runs without a user
// session over every owner's pages; the route authenticates the cron and
// sets the time budget from its maxDuration.
export interface MasteryRecomputeJob {
  run(): Promise<MasteryRecomputeSummary>;
}

export function createMasteryRecomputeJob(deps: {
  db: DbExecutor;
  clock: Clock;
  ids: { next(): string };
  timeBudgetMs: number;
  onPageError?: (page: StudiedPage, error: unknown) => void;
}): MasteryRecomputeJob {
  const { db, clock, ids, timeBudgetMs, onPageError } = deps;
  return {
    run: () =>
      recomputeAllPageMastery({
        pages: new DrizzleStudiedPageReader(db),
        uow: new DrizzleStudyUnitOfWork(db),
        clock,
        ids,
        timeBudgetMs,
        onPageError,
      }),
  };
}
