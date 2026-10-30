import type { DueTodayPage } from "./due-today";

// Read port behind "Repasos de hoy". Owner-scoped: another owner's pages
// never appear. A page is listed only when it has at least one item that
// is not suspended (an archived flashcard suspends its item) and is due
// before `dueBefore` (the start of the owner's next local day: reviews are
// due per day, user decision 2026-10-18); archived pages and pages of
// archived notebooks are left out. Ordered by earliestDueAt ascending,
// then page id.
//
// With `examsCompletedFrom` (Home and the calendar's "Hoy", H2-T6), the
// exam questions of a page with an exam session finished in
// [examsCompletedFrom, dueBefore) are left out (counts, earliestDueAt and
// the page itself when nothing else is due): that page's exam is done for
// the day. Without it every due exam question is listed (the exams hub).
export interface DueTodayReadOptions {
  examsCompletedFrom?: Date;
}

export interface DueTodayReader {
  listDueToday(
    ownerId: string,
    dueBefore: Date,
    options?: DueTodayReadOptions,
  ): Promise<DueTodayPage[]>;
}
