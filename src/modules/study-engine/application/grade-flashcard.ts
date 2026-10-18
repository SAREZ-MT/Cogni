import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import type { FlashcardSession } from "../domain/flashcard-session";
import { computeMastery } from "../domain/mastery";
import type { PageMastery } from "../domain/page-mastery";
import { applySm2 } from "../domain/sm2";
import {
  type DueCutoff,
  FLASHCARD_QUALITY,
  type FlashcardRating,
  isDueBefore,
  type StudyItem,
} from "../domain/study-item";
import { runInUnitOfWork } from "./run-in-unit-of-work";
import type { StudyUnitOfWork } from "./study-unit-of-work";

export interface GradeFlashcardDeps {
  uow: StudyUnitOfWork;
  clock: Clock;
  // The owner's "due" bound (start of their next local day): a card due
  // later today can be graded now, one due tomorrow cannot.
  dueCutoff: DueCutoff;
  ids: { next(): string };
}

export interface GradedFlashcard {
  item: StudyItem;
  session: FlashcardSession;
  mastery: PageMastery;
}

// Grades one due flashcard of an open session (§7.2 button → quality,
// §7.1 SM-2): the item's new state, its ReviewLog, the session counts and
// the page's PageMastery (§7.3) are written in one unit of work. Every
// check runs before the first write, and any refusal rolls the unit of
// work back (runInUnitOfWork), so a refusal writes nothing.
export async function gradeFlashcard(
  input: { sessionId: string; itemId: string; rating: FlashcardRating },
  deps: GradeFlashcardDeps,
  ownerId: string,
): Promise<Result<GradedFlashcard, DomainError>> {
  return runInUnitOfWork(deps.uow, async (repos) => {
    const now = deps.clock.now();

    const session = await repos.sessions.findById(input.sessionId, ownerId);
    if (!session)
      return fail(STUDY_ENGINE_ERROR.SESSION_NOT_FOUND, input.sessionId);
    if (session.finishedAt !== null) {
      return fail(STUDY_ENGINE_ERROR.SESSION_FINISHED, input.sessionId);
    }

    // Lock first, then read: a concurrent grade of the same item waits and
    // then sees the item no longer due.
    await repos.studyItems.lock(input.itemId, ownerId);
    const item = await repos.studyItems.findById(input.itemId, ownerId);
    if (
      !item ||
      item.kind !== "flashcard" ||
      (session.pageId !== null && item.pageId !== session.pageId)
    ) {
      return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, input.itemId);
    }
    if (item.suspendedAt !== null) {
      return fail(STUDY_ENGINE_ERROR.ITEM_SUSPENDED, input.itemId);
    }
    if (!isDueBefore(item, deps.dueCutoff(now))) {
      return fail(STUDY_ENGINE_ERROR.ITEM_NOT_DUE, input.itemId);
    }

    const quality = FLASHCARD_QUALITY[input.rating];
    const next = applySm2(item, quality, now);
    if (!next.ok) return next;

    const graded: StudyItem = { ...item, ...next.value, updatedAt: now };
    await repos.studyItems.save(graded);
    await repos.reviewLogs.append({
      id: deps.ids.next(),
      ownerId,
      itemId: item.id,
      quality,
      reviewedAt: now,
      intervalBefore: item.intervalDays,
      intervalAfter: graded.intervalDays,
      easinessAfter: graded.easiness,
      sessionKind: "flashcards",
      sessionId: session.id,
    });
    const counted = await repos.sessions.recordGrade(
      session.id,
      ownerId,
      input.rating === "again",
    );
    if (!counted) return fail(STUDY_ENGINE_ERROR.SESSION_NOT_FOUND, session.id);

    // The item is the owner's, so its page is too: the upsert never
    // touches another owner's mastery row.
    const snapshot = computeMastery(
      await repos.studyItems.listByPage(item.pageId, ownerId),
      now,
    );
    const mastery: PageMastery = {
      id: deps.ids.next(),
      ownerId,
      pageId: item.pageId,
      ...snapshot,
      computedAt: now,
    };
    await repos.pageMastery.upsert(mastery);
    const stored = await repos.pageMastery.getByPage(item.pageId, ownerId);

    return ok({ item: graded, session: counted, mastery: stored ?? mastery });
  });
}

function fail(code: string, message: string) {
  return err(new DomainError(code, message));
}
