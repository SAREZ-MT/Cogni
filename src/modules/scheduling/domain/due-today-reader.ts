import type { DueTodayPage } from "./due-today";

// Read port behind "Repasos de hoy". Owner-scoped: another owner's pages
// never appear. A page is listed only when it has at least one item that
// is not suspended (an archived flashcard suspends its item) and is due at
// or before `now`; archived pages and pages of archived notebooks are
// left out. Ordered by earliestDueAt ascending, then page id.
export interface DueTodayReader {
  listDueToday(ownerId: string, now: Date): Promise<DueTodayPage[]>;
}
