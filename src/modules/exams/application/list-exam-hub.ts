import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { ExamHubReader } from "../domain/exam-hub-reader";
import { EXAM_MIN_QUESTIONS } from "../domain/exam-session";

// Exam questions due now per page (scheduling's "Repasos de hoy",
// `due.exam_question`); null when that list could not be read.
export interface ExamDueCounts {
  examQuestionsDueByPage(
    ownerId: string,
  ): Promise<ReadonlyMap<string, number> | null>;
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
  // Enough questions to start an exam (at least 10).
  ready: boolean;
  // The page's exam questions due today; null when unknown.
  dueToday: number | null;
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
      ready: page.activeQuestionCount >= EXAM_MIN_QUESTIONS,
      dueToday: due === null ? null : (due.get(page.pageId) ?? 0),
    })),
  );
}
