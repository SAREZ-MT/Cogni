// "Repasos de hoy" read model (documento-maestro §3.5 vista "Hoy", §3.3):
// one row per page that has study items due now, with how many are due per
// technique so each technique can open that page's session. The study
// engine owns the due dates (§3.4); this module only reads them.

// Mirrors study-engine's StudyItemKind (§6.1). The domain may not import
// another module, so application/list-due-today.ts asserts both stay equal.
export const DUE_KINDS = [
  "flashcard",
  "exam_question",
  "recall_question",
] as const;

export type DueKind = (typeof DUE_KINDS)[number];

export type DueCounts = Record<DueKind, number>;

export interface DueTodayPage {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  // NotebookColor value, or null for a notebook without a stored color.
  notebookColor: string | null;
  // Due items per technique; a technique with nothing due counts 0.
  due: DueCounts;
  // The oldest due_at among the page's due items: the list is ordered by it.
  earliestDueAt: Date;
}

export function emptyDueCounts(): DueCounts {
  return { flashcard: 0, exam_question: 0, recall_question: 0 };
}

// List order: the page that has waited longest first; page id breaks ties
// so the order is stable (same code-unit order Postgres gives uuids).
export function compareDueTodayPages(a: DueTodayPage, b: DueTodayPage): number {
  const byDue = a.earliestDueAt.getTime() - b.earliestDueAt.getTime();
  if (byDue !== 0) return byDue;
  return a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0;
}

// Total study items due now across pages and techniques (Home's "Repasos
// pendientes hoy").
export function totalDueCount(pages: readonly DueTodayPage[]): number {
  let total = 0;
  for (const page of pages) {
    for (const kind of DUE_KINDS) total += page.due[kind];
  }
  return total;
}

// Study items due now per technique across pages (Home's technique count
// cards).
export function sumDueByKind(pages: readonly DueTodayPage[]): DueCounts {
  const counts = emptyDueCounts();
  for (const page of pages) {
    for (const kind of DUE_KINDS) counts[kind] += page.due[kind];
  }
  return counts;
}
