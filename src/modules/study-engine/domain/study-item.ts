// StudyItem is the per-item SM-2 state (documento-maestro §3.4, §6.1).
// Every flashcard, exam question (its root) and recall question owns one.
// This file holds only types and the constructor; the algorithm lives in
// sm2.ts and the page-level aggregate in mastery.ts.

export type StudyItemKind = "flashcard" | "exam_question" | "recall_question";

// SM-2 answer quality, 0 (blackout) to 5 (perfect).
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

// §7.2: the four flashcard buttons map to fixed qualities.
export const FLASHCARD_QUALITY = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
} as const satisfies Record<string, Quality>;

// The four flashcard buttons: Otra vez, Difícil, Bien, Fácil.
export type FlashcardRating = keyof typeof FLASHCARD_QUALITY;

// §7.2 and the user decision of 2026-10-05: a wrong exam answer reviews the
// root's item with q = 1 whether or not it was due; a correct one reviews it
// with q = 4 only when it was due, and otherwise leaves SM-2 untouched (no
// interval inflation from repeated attempts). Mirrors examQualityFor in the
// exams module, which study-engine must not import
// (study-engine-knows-no-technique).
export const EXAM_REVIEW_QUALITY = {
  wrong: 1,
  correct: 4,
} as const satisfies Record<string, Quality>;

// §6.1: easiness is >= 1.3 and starts at 2.5.
export const MIN_EASINESS = 1.3;
export const INITIAL_EASINESS = 2.5;

export interface Sm2State {
  readonly easiness: number;
  readonly intervalDays: number;
  readonly repetitions: number;
  readonly dueAt: Date;
  readonly lastQuality: Quality | null;
  readonly lastReviewedAt: Date | null;
  readonly lapses: number;
}

export interface StudyItem extends Sm2State {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly kind: StudyItemKind;
  // Flashcard id, root ExamQuestion id or RecallQuestion id (§6.1).
  readonly sourceId: string;
  readonly suspendedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStudyItemInput {
  id: string;
  ownerId: string;
  pageId: string;
  kind: StudyItemKind;
  sourceId: string;
  now: Date;
}

// A new item is due immediately: interval 0, no repetitions, no lapses.
export function newStudyItem(input: NewStudyItemInput): StudyItem {
  return {
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    kind: input.kind,
    sourceId: input.sourceId,
    easiness: INITIAL_EASINESS,
    intervalDays: 0,
    repetitions: 0,
    dueAt: input.now,
    lastQuality: null,
    lastReviewedAt: null,
    lapses: 0,
    suspendedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
