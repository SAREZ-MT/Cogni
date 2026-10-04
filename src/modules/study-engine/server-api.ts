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
  type PageAccess,
  type StartedFlashcardSession,
  startFlashcardSession,
} from "./application";
import type { FlashcardSession } from "./domain/flashcard-session";
import type { FlashcardRating } from "./domain/study-item";
import type { StudyItemRepository } from "./domain/study-item-repository";
import {
  DrizzleFlashcardSessionRepository,
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
