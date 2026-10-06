import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import { computeMastery } from "../domain/mastery";
import type { PageMastery } from "../domain/page-mastery";
import { applySm2 } from "../domain/sm2";
import {
  type Quality,
  recallReviewQualityFor,
  type StudyItem,
} from "../domain/study-item";
import { runInUnitOfWork } from "./run-in-unit-of-work";
import type { StudyUnitOfWork } from "./study-unit-of-work";

export interface RecallReview {
  // The RecallQuestion id; its study item (kind recall_question,
  // sourceId = questionId) is what gets reviewed (§6.1).
  questionId: string;
  // The answer's combined quality, an integer 0–5 (§7.4).
  quality: number;
}

export interface RecordRecallReviewsInput {
  ownerId: string;
  // The RecallSession the answers belong to; every ReviewLog points at it.
  sessionId: string;
  pageId: string;
  reviews: readonly RecallReview[];
  // The evaluation time: review time and due comparison.
  now: Date;
}

export interface RecordRecallReviewsDeps {
  uow: StudyUnitOfWork;
  ids: { next(): string };
}

export interface RecordedRecallReviews {
  // Questions whose item got an SM-2 review and a ReviewLog, in input order.
  reviewedQuestionIds: string[];
  // Questions left untouched: passing quality but not due, or suspended.
  skippedQuestionIds: string[];
  // Questions this session already recorded (a replay); left untouched.
  alreadyRecordedQuestionIds: string[];
  mastery: PageMastery;
}

// Feeds evaluated recall answers to the SM-2 engine (§7.1, §7.4, user
// decision 2026-10-06). Technique-neutral in its imports: the caller passes
// { questionId, quality } with the combined quality already computed, and
// only answers whose evaluation is done (a failed one records nothing, so
// its item stays due). The quality rule lives in recallReviewQualityFor:
//   quality < 3            → reviewed, due or not
//   quality ≥ 3 and due    → reviewed
//   quality ≥ 3, not due   → skipped (no interval inflation)
// Suspended items are skipped. Each review writes the item and a
// ReviewLog(sessionKind "recall"); the page mastery is recomputed once.
//
// Recall evaluates answers incrementally (the finish, then "Reintentar"),
// so the replay guard is per (session, item), not per session: an item
// that already has a recall log for this session is reported in
// alreadyRecordedQuestionIds and left alone, and the rest still record.
// The guard reads the logs after the item locks, so a concurrent recording
// of the same answer waits and then sees the committed log.
//
// Every question must already own its study item (active-recall creates it
// with the question). A missing one (or another owner's, another page's or
// a non-recall item) is ITEM_NOT_FOUND. All of it is one unit of work, and
// every refusal rolls it back (runInUnitOfWork), so a failure writes nothing.
export async function recordRecallReviews(
  input: RecordRecallReviewsInput,
  deps: RecordRecallReviewsDeps,
): Promise<Result<RecordedRecallReviews, DomainError>> {
  const { ownerId, pageId, sessionId, now } = input;
  const questions = new Set(input.reviews.map((review) => review.questionId));
  if (questions.size !== input.reviews.length) {
    return fail(
      STUDY_ENGINE_ERROR.INVALID_REVIEW_BATCH,
      `recall session ${sessionId} reviews a question twice`,
    );
  }
  const invalid = input.reviews.find((review) => !isQuality(review.quality));
  if (invalid) {
    return fail(
      STUDY_ENGINE_ERROR.INVALID_QUALITY,
      `quality of ${invalid.questionId} must be an integer between 0 and 5`,
    );
  }

  return runInUnitOfWork(deps.uow, async (repos) => {
    // Resolve every question's item before writing anything.
    const itemIdByQuestion = new Map<string, string>();
    for (const { questionId } of input.reviews) {
      const item = await repos.studyItems.findBySource(
        "recall_question",
        questionId,
        ownerId,
      );
      if (!item || item.pageId !== pageId) {
        return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, questionId);
      }
      itemIdByQuestion.set(questionId, item.id);
    }

    // Lock in id order, then read: concurrent graders of overlapping items
    // queue instead of deadlocking, and every review applies to the latest
    // state.
    const itemIds = [...itemIdByQuestion.values()].sort();
    for (const id of itemIds) await repos.studyItems.lock(id, ownerId);
    const locked = new Map<string, StudyItem>();
    for (const id of itemIds) {
      const item = await repos.studyItems.findById(id, ownerId);
      if (!item) return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, id);
      locked.set(id, item);
    }

    const recordedItemIds = new Set(
      (await repos.reviewLogs.listBySession("recall", sessionId, ownerId)).map(
        (log) => log.itemId,
      ),
    );

    // Compute every review before the first write.
    const reviews: { before: StudyItem; after: StudyItem; quality: Quality }[] =
      [];
    const reviewedQuestionIds: string[] = [];
    const skippedQuestionIds: string[] = [];
    const alreadyRecordedQuestionIds: string[] = [];
    for (const review of input.reviews) {
      const item = locked.get(itemIdByQuestion.get(review.questionId) ?? "");
      if (!item) {
        return fail(STUDY_ENGINE_ERROR.ITEM_NOT_FOUND, review.questionId);
      }
      if (recordedItemIds.has(item.id)) {
        alreadyRecordedQuestionIds.push(review.questionId);
        continue;
      }
      const quality = qualityFor(review.quality as Quality, item, now);
      if (quality === null) {
        skippedQuestionIds.push(review.questionId);
        continue;
      }
      const next = applySm2(item, quality, now);
      if (!next.ok) return next;
      reviews.push({
        before: item,
        after: { ...item, ...next.value, updatedAt: now },
        quality,
      });
      reviewedQuestionIds.push(review.questionId);
    }

    for (const { before, after, quality } of reviews) {
      await repos.studyItems.save(after);
      await repos.reviewLogs.append({
        id: deps.ids.next(),
        ownerId,
        itemId: before.id,
        quality,
        reviewedAt: now,
        intervalBefore: before.intervalDays,
        intervalAfter: after.intervalDays,
        easinessAfter: after.easiness,
        sessionKind: "recall",
        sessionId,
      });
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

    return ok({
      reviewedQuestionIds,
      skippedQuestionIds,
      alreadyRecordedQuestionIds,
      mastery: stored ?? mastery,
    });
  });
}

// Null means "leave SM-2 untouched".
function qualityFor(
  quality: Quality,
  item: StudyItem,
  now: Date,
): Quality | null {
  if (item.suspendedAt !== null) return null;
  return recallReviewQualityFor({
    quality,
    wasDue: item.dueAt.getTime() <= now.getTime(),
  });
}

function isQuality(value: number): value is Quality {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

function fail(code: string, message: string) {
  return err(new DomainError(code, message));
}
