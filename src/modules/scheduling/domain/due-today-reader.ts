import type { DueTodayPage } from "./due-today";

// Read port behind "Repasos de hoy". Owner-scoped: another owner's pages
// never appear. A page is listed only when it has at least one item that
// is not suspended (an archived flashcard suspends its item) and is due
// before `dueBefore` (the start of the owner's next local day: reviews are
// due per day, user decision 2026-10-18); archived pages and pages of
// archived notebooks are left out. Ordered by earliestDueAt ascending,
// then page id.
export interface DueTodayReader {
  listDueToday(ownerId: string, dueBefore: Date): Promise<DueTodayPage[]>;
}
