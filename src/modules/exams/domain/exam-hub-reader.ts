// Read port of the exams hub (documento-maestro §3.3: a page shows up in
// the exam screens once it holds questions, whether or not it was ever
// examined). One row per page of the owner that has at least one active
// (not retired) question, with what the hub and notebook views display.

export interface ExamHubLastSession {
  readonly finishedAt: Date;
  readonly total: number;
  readonly correct: number;
  readonly passed: boolean;
}

export interface ExamHubPage {
  readonly pageId: string;
  readonly pageTitle: string;
  readonly notebookId: string;
  readonly notebookTitle: string;
  // NotebookColor value, or null for a notebook without a stored color.
  readonly notebookColor: string | null;
  // Roots with an active question (an exam needs at least 10), the same
  // count the exam start screen shows.
  readonly activeQuestionCount: number;
  // Finished sessions of the page, retakes included; open ones never count.
  readonly attempts: number;
  // The page's most recently finished session; null when never finished.
  readonly lastSession: ExamHubLastSession | null;
  readonly retakePending: boolean;
}

export interface ExamHubReader {
  // Owner-scoped. Archived pages and pages of archived notebooks are left
  // out. Ordered by notebook title, then page title, then page id.
  listExamPages(ownerId: string): Promise<ExamHubPage[]>;
}
