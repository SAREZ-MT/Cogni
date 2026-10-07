import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { ExamHubPage, ExamHubReader } from "../domain/exam-hub-reader";

// Exam questions due now per page (scheduling's "Repasos de hoy",
// `due.exam_question`); null when that list could not be read.
export interface ExamDueCounts {
  examQuestionsDueByPage(
    ownerId: string,
  ): Promise<ReadonlyMap<string, number> | null>;
  // The roots whose exam study item is due now (same "due" as "Hoy":
  // dueAt <= now, not suspended, page and notebook not archived); null
  // when the due items could not be read.
  examRootsDueNow(ownerId: string): Promise<ReadonlySet<string> | null>;
}

export interface ExamHubEntry {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
  // Roots with an active question.
  questionCount: number;
  // Finished exams of the page, retakes included.
  attempts: number;
  // The last finished exam's whole percent, rounded down (display only,
  // as on the results screen); null when the page was never examined.
  lastScore: number | null;
  // Whether the last finished exam passed; false when never examined.
  passed: boolean;
  lastFinishedAt: Date | null;
  retakePending: boolean;
  // The page's exam questions due today; null when unknown.
  dueToday: number | null;
  // Whether a question failed in the page's last failed exam is due now
  // (the retake banner's "ya están para repasar"); false when the page has
  // no failed questions, null when unknown.
  failedDueNow: boolean | null;
}

// The exams hub and notebook view (documento-maestro §3.3): every page of
// the owner holding active questions, with its exam history, its pending
// retake and its exam questions due today, in the reader's order.
export async function listExamHub(
  deps: { reader: ExamHubReader; due: ExamDueCounts },
  ownerId: string,
): Promise<Result<ExamHubEntry[], DomainError>> {
  const [pages, due] = await Promise.all([
    deps.reader.listExamPages(ownerId),
    deps.due.examQuestionsDueByPage(ownerId),
  ]);
  const hasFailed = (page: ExamHubPage) =>
    page.retakePending && page.failedRootIds.length > 0;
  // Read only when some page waits for a retake: the hub's usual load
  // stays at the reader's queries plus the due counts.
  const rootsDue = pages.some(hasFailed)
    ? await deps.due.examRootsDueNow(ownerId)
    : null;
  const failedDueNow = (page: ExamHubPage): boolean | null => {
    if (!hasFailed(page)) return false;
    if (rootsDue === null) return null;
    return page.failedRootIds.some((rootId) => rootsDue.has(rootId));
  };
  return ok(
    pages.map((page) => ({
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      notebookId: page.notebookId,
      notebookTitle: page.notebookTitle,
      notebookColor: page.notebookColor,
      questionCount: page.activeQuestionCount,
      attempts: page.attempts,
      lastScore: page.lastSession
        ? Math.floor((page.lastSession.correct * 100) / page.lastSession.total)
        : null,
      passed: page.lastSession?.passed ?? false,
      lastFinishedAt: page.lastSession?.finishedAt ?? null,
      retakePending: page.retakePending,
      dueToday: due === null ? null : (due.get(page.pageId) ?? 0),
      failedDueNow: failedDueNow(page),
    })),
  );
}
