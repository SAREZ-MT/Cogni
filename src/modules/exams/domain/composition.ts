import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "./errors";
import {
  EXAM_MIN_QUESTIONS,
  invalidCount,
  isValidQuestionCount,
} from "./exam-session";

// The active question of one root, with what the composer needs from the
// last exam and the root's StudyItem.
export interface ExamCandidate {
  readonly rootId: string;
  readonly questionId: string;
  // The root is in ExamPageState.failedRootIds.
  readonly failedLastTime: boolean;
  // The root's StudyItem due date; null when it has none (e.g. suspended).
  readonly dueAt: Date | null;
  // When the root was last shown in an exam; null if never.
  readonly lastSeenAt: Date | null;
}

export interface ComposedQuestion {
  readonly rootId: string;
  readonly questionId: string;
}

export interface ComposeExamInput {
  requestedCount: number;
  candidates: readonly ExamCandidate[];
  // The owner's "due" bound: the start of their next local day (reviews
  // are due per day, user decision 2026-10-18). A root due before it is
  // due, also when it comes due later today.
  dueBefore: Date;
}

// Picks the questions of an exam: one per root, min(N, available roots).
// Order (user decision 2026-10-05):
//   1. roots failed last time,
//   2. due roots (dueAt < dueBefore), oldest due first,
//   3. the rest, least recently seen first (never seen before anything).
// Inside groups 1 and 2 the due date comes first, then last seen; the root id
// (then the question id) breaks every remaining tie, so the result does not
// depend on the input order.
//
// N must be in [EXAM_MIN_QUESTIONS, EXAM_MAX_QUESTIONS]
// (EXAMS_INVALID_QUESTION_COUNT). A page with fewer active roots than
// EXAM_MIN_QUESTIONS cannot hold an exam (EXAMS_NOT_ENOUGH_QUESTIONS): the
// UI tells the student to add or generate questions instead of starting a
// trivial exam.
export function composeExam(
  input: ComposeExamInput,
): Result<readonly ComposedQuestion[], DomainError> {
  if (!isValidQuestionCount(input.requestedCount)) {
    return err(invalidCount(input.requestedCount));
  }
  const ordered = orderByRoot(input.candidates, input.dueBefore);
  if (ordered.length < EXAM_MIN_QUESTIONS) {
    return err(notEnough(ordered.length));
  }
  return ok(ordered.slice(0, input.requestedCount).map(toComposed));
}

export interface ComposeRetakeInput {
  requestedCount: number;
  failedRootIds: readonly string[];
  // The fresh variant generated for each failed root (rootId → questionId).
  variantsByRoot: ReadonlyMap<string, string>;
  // Question ids shown in the failed session; a variant may not be one.
  shownQuestionIds: readonly string[];
  // The page's other active questions; failed roots among them are ignored.
  otherCandidates: readonly ExamCandidate[];
  // Same "due" bound as composeExam's.
  dueBefore: Date;
}

// Picks the questions of a retake (§7.5, user decision 2026-10-05): one
// fresh variant per failed root first, in failedRootIds order, then the rest
// of the page in composeExam order up to N.
//
// Refusals: no failed roots (EXAMS_NO_RETAKE_PENDING); N outside
// [10, 30] or below the number of failed roots, so every failed concept is
// always retaken (EXAMS_INVALID_QUESTION_COUNT); a failed root without a
// variant, or whose variant is a wording already shown — the original
// wording is never reused, so the retake is blocked
// (EXAMS_RETAKE_VARIANT_MISSING); fewer than EXAM_MIN_QUESTIONS roots in
// total (EXAMS_NOT_ENOUGH_QUESTIONS).
export function composeRetake(
  input: ComposeRetakeInput,
): Result<readonly ComposedQuestion[], DomainError> {
  const failed = [...new Set(input.failedRootIds)];
  if (failed.length === 0) {
    return err(
      new DomainError(
        EXAM_ERROR.NO_RETAKE_PENDING,
        "no failed roots to retake",
      ),
    );
  }
  if (
    !isValidQuestionCount(input.requestedCount) ||
    input.requestedCount < failed.length
  ) {
    return err(invalidCount(input.requestedCount));
  }

  const shown = new Set(input.shownQuestionIds);
  const variants: ComposedQuestion[] = [];
  for (const rootId of failed) {
    const questionId = input.variantsByRoot.get(rootId);
    if (questionId === undefined || shown.has(questionId)) {
      return err(
        new DomainError(
          EXAM_ERROR.RETAKE_VARIANT_MISSING,
          `failed root ${rootId} has no fresh variant`,
        ),
      );
    }
    variants.push({ rootId, questionId });
  }

  const failedSet = new Set(failed);
  const rest = orderByRoot(
    input.otherCandidates.filter((c) => !failedSet.has(c.rootId)),
    input.dueBefore,
  );
  const available = variants.length + rest.length;
  if (available < EXAM_MIN_QUESTIONS) return err(notEnough(available));

  return ok([
    ...variants,
    ...rest.slice(0, input.requestedCount - variants.length).map(toComposed),
  ]);
}

// Sorts by priority and keeps the first candidate of each root.
function orderByRoot(
  candidates: readonly ExamCandidate[],
  dueBefore: Date,
): ExamCandidate[] {
  const sorted = [...candidates].sort(compareCandidates(dueBefore.getTime()));
  const seen = new Set<string>();
  return sorted.filter((candidate) => {
    if (seen.has(candidate.rootId)) return false;
    seen.add(candidate.rootId);
    return true;
  });
}

function compareCandidates(dueBefore: number) {
  const group = (c: ExamCandidate) => {
    if (c.failedLastTime) return 0;
    if (c.dueAt !== null && c.dueAt.getTime() < dueBefore) return 1;
    return 2;
  };
  return (a: ExamCandidate, b: ExamCandidate): number => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (group(a) < 2) {
      const byDue = compareDates(a.dueAt, b.dueAt, "last");
      if (byDue !== 0) return byDue;
    }
    const bySeen = compareDates(a.lastSeenAt, b.lastSeenAt, "first");
    if (bySeen !== 0) return bySeen;
    return (
      compareText(a.rootId, b.rootId) || compareText(a.questionId, b.questionId)
    );
  };
}

// Ascending by instant; `nulls` says where a missing date sorts.
function compareDates(
  a: Date | null,
  b: Date | null,
  nulls: "first" | "last",
): number {
  if (a === null || b === null) {
    if (a === b) return 0;
    const nullFirst = nulls === "first" ? -1 : 1;
    return a === null ? nullFirst : -nullFirst;
  }
  return a.getTime() - b.getTime();
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toComposed(candidate: ExamCandidate): ComposedQuestion {
  return { rootId: candidate.rootId, questionId: candidate.questionId };
}

function notEnough(available: number): DomainError {
  return new DomainError(
    EXAM_ERROR.NOT_ENOUGH_QUESTIONS,
    `an exam needs at least ${EXAM_MIN_QUESTIONS} active questions, the page has ${available}`,
  );
}
