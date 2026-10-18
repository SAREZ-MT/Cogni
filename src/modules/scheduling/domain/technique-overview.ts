import type { DueKind } from "./due-today";

// Home's technique cards (Phase 8 H2-T5f, H2-T5i): per technique, how many
// live study items the owner has (due or not), when the next one is due
// from tomorrow on, and today's progress in study UNITS. A unit is one page
// × technique (a page's flashcard deck, recall session or exam) — the same
// unit as one "Para repasar hoy" row — so five exams due read "0 de 5",
// not "0 de 100" questions (user decision 2026-10-18). Live = not
// suspended, on a page and notebook that are not archived (the same scope
// as "Repasos de hoy").
export interface TechniqueTotals {
  total: number;
  // The earliest due_at at or after the reader's bound (the start of
  // tomorrow in the owner's zone), or null when nothing is due from then.
  nextDueAt: Date | null;
  // Pages with at least one item of the technique due today.
  pendingUnits: number;
  // Pages reviewed today in the technique with nothing of it still due
  // today. A partially reviewed page is pending only. Exams also count a
  // page whose exam session was completed today, whatever is still due.
  doneUnits: number;
}

export type TechniqueOverview = Record<DueKind, TechniqueTotals>;

// What the reader returns per technique: the totals plus the page ids the
// units are counted from.
export interface TechniqueReadout {
  total: number;
  nextDueAt: Date | null;
  // Live pages with an item of the technique due today (due_at before the
  // start of tomorrow).
  duePageIds: string[];
  // Live pages with a review log of the technique today (reviewed_at in
  // [start of today, start of tomorrow)).
  reviewedPageIds: string[];
  // Live pages whose session of the technique was completed today
  // (finished in [start of today, start of tomorrow)). Only exams have
  // such a session (exam_sessions.finished_at); empty for the others.
  completedPageIds: string[];
}

export type TechniqueSnapshot = Record<DueKind, TechniqueReadout>;

// review_logs.session_kind of each technique's reviews.
export const REVIEW_SESSION_KIND: Record<
  DueKind,
  "flashcards" | "recall" | "exam"
> = {
  flashcard: "flashcards",
  recall_question: "recall",
  exam_question: "exam",
};

export function emptyTechniqueSnapshot(): TechniqueSnapshot {
  const empty = (): TechniqueReadout => ({
    total: 0,
    nextDueAt: null,
    duePageIds: [],
    reviewedPageIds: [],
    completedPageIds: [],
  });
  return {
    flashcard: empty(),
    exam_question: empty(),
    recall_question: empty(),
  };
}

export function emptyTechniqueOverview(): TechniqueOverview {
  return toTechniqueOverview(emptyTechniqueSnapshot());
}

// A completed session closes its page for the day (user decision
// 2026-10-18, H2-T6): an exam serves 10–30 questions, so a page with more
// due could otherwise never be done. Such a page is done, never pending.
function toTotals(readout: TechniqueReadout): TechniqueTotals {
  const completed = new Set(readout.completedPageIds);
  const due = new Set(readout.duePageIds.filter((id) => !completed.has(id)));
  const done = new Set(
    [...readout.reviewedPageIds, ...completed].filter((id) => !due.has(id)),
  );
  return {
    total: readout.total,
    nextDueAt: readout.nextDueAt,
    pendingUnits: due.size,
    doneUnits: done.size,
  };
}

// Today's units per technique, each technique counted on its own (a page
// can be done in flashcards and pending in exams).
export function toTechniqueOverview(
  snapshot: TechniqueSnapshot,
): TechniqueOverview {
  return {
    flashcard: toTotals(snapshot.flashcard),
    exam_question: toTotals(snapshot.exam_question),
    recall_question: toTotals(snapshot.recall_question),
  };
}
