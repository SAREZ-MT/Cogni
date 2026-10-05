import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import { computeMastery } from "../domain/mastery";
import type { PageMastery } from "../domain/page-mastery";
import { applySm2 } from "../domain/sm2";
import {
  EXAM_REVIEW_QUALITY,
  type Quality,
  type StudyItem,
} from "../domain/study-item";
import type { StudyUnitOfWork } from "./study-unit-of-work";

export interface ExamReviewAnswer {
  // The root exam question the answered wording belongs to; its study item
  // (kind exam_question, sourceId = rootId) is what gets reviewed (§6.1).
  rootId: string;
  correct: boolean;
}

export interface RecordExamReviewsInput {
  ownerId: string;
  // The finished ExamSession; every ReviewLog points at it.
  sessionId: string;
  pageId: string;
  answers: readonly ExamReviewAnswer[];
  // The exam's finish time: review time and due comparison.
  now: Date;
}

export interface RecordExamReviewsDeps {
  uow: StudyUnitOfWork;
  ids: { next(): string };
}

export interface RecordedExamReviews {
  // Roots whose item got an SM-2 review and a ReviewLog, in answer order.
  reviewedRootIds: string[];
  // Roots left untouched: correct but not due, or suspended item.
  skippedRootIds: string[];
  mastery: PageMastery;
}

// Feeds a finished exam to the SM-2 engine (§7.2, user decision
// 2026-10-05). Exam-neutral: the caller passes { rootId, correct } and the
// quality mapping lives here (EXAM_REVIEW_QUALITY):
//   wrong            → q = 1, due or not (the page shows in "Hoy" tomorrow)
//   correct and due  → q = 4
//   correct, not due → skipped (no review, no log)
// Suspended items (retired roots) are skipped. Each review writes the item
// and a ReviewLog(sessionKind "exam"); the page mastery is recomputed once.
// All of it is one unit of work, so a failure rolls everything back.
//
// Every root must already own its study item: exams creates it together
// with the root question (T4/T5). A missing one (or another owner's,
// another page's or a non-exam item) is ITEM_NOT_FOUND and nothing is
// written. Calling it twice for one session would review twice; the caller
// runs it once, in the same transaction that finishes the session.
export async function recordExamReviews(
  input: RecordExamReviewsInput,
  deps: RecordExamReviewsDeps,
): Promise<Result<RecordedExamReviews, DomainError>> {
  const { ownerId, pageId, now } = input;
  const roots = new Set(input.answers.map((answer) => answer.rootId));
  if (roots.size !== input.answers.length) {
    return fail(
      STUDY_ENGINE_ERROR.INVALID_REVIEW_BATCH,
      `exam session ${input.sessionId} answers a root twice`,
    );
  }

  return deps.uow.run(async (repos) => {
    // Resolve every root's item before writing anything.
    const itemIdByRoot = new Map<string, string>();
    for (const { rootId } of input.answers) {
      const item = await repos.studyItems.findBySource(
        "exam_question",
        rootId,
        ownerId,
      );
      if (!item || item.pageId !== pageId) {
        return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, rootId);
      }
      itemIdByRoot.set(rootId, item.id);
    }

    // Lock in id order, then read: concurrent graders of overlapping items
    // (another exam, a flashcard grade, the daily job's lockPage) queue
    // instead of deadlocking, and every review applies to the latest state.
    const itemIds = [...itemIdByRoot.values()].sort();
    for (const id of itemIds) await repos.studyItems.lock(id, ownerId);
    const locked = new Map<string, StudyItem>();
    for (const id of itemIds) {
      const item = await repos.studyItems.findById(id, ownerId);
      if (!item) return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, id);
      locked.set(id, item);
    }

    const reviewedRootIds: string[] = [];
    const skippedRootIds: string[] = [];
    for (const answer of input.answers) {
      const item = locked.get(itemIdByRoot.get(answer.rootId) ?? "");
      if (!item) return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, answer.rootId);
      const quality = qualityFor(answer.correct, item, now);
      if (quality === null) {
        skippedRootIds.push(answer.rootId);
        continue;
      }
      const next = applySm2(item, quality, now);
      if (!next.ok) return next;
      const reviewed: StudyItem = { ...item, ...next.value, updatedAt: now };
      await repos.studyItems.save(reviewed);
      await repos.reviewLogs.append({
        id: deps.ids.next(),
        ownerId,
        itemId: item.id,
        quality,
        reviewedAt: now,
        intervalBefore: item.intervalDays,
        intervalAfter: reviewed.intervalDays,
        easinessAfter: reviewed.easiness,
        sessionKind: "exam",
        sessionId: input.sessionId,
      });
      reviewedRootIds.push(answer.rootId);
    }

    const snapshot = computeMastery(
      await repos.studyItems.listByPage(pageId, ownerId),
      now,
    );
    const mastery: PageMastery = {
      id: deps.ids.next(),
      ownerId,
      pageId,
      ...snapshot,
      computedAt: now,
    };
    await repos.pageMastery.upsert(mastery);
    const stored = await repos.pageMastery.getByPage(pageId, ownerId);

    return ok({ reviewedRootIds, skippedRootIds, mastery: stored ?? mastery });
  });
}

// Null means "leave SM-2 untouched".
function qualityFor(
  correct: boolean,
  item: StudyItem,
  now: Date,
): Quality | null {
  if (item.suspendedAt !== null) return null;
  if (!correct) return EXAM_REVIEW_QUALITY.wrong;
  if (item.dueAt.getTime() <= now.getTime()) return EXAM_REVIEW_QUALITY.correct;
  return null;
}

function fail(code: string, message: string) {
  return err(new DomainError(code, message));
}
