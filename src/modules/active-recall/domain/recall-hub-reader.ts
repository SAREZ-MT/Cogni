// Read port of the active recall hub and notebook view (documento-maestro
// §3.3: a page shows up in the recall screens once it has recall questions
// or a finished session, Phase 8 H16). One row per page of the owner with
// an active recall question or a finished session that holds an answer,
// with the finished sessions those screens list.

// What a session's scores are derived from (sessionScore): one entry per
// saved answer, null while the answer is not evaluated.
export interface RecallHubAnswerScore {
  readonly aiScore: number | null;
  readonly combinedQuality: number | null;
}

export interface RecallHubSession {
  readonly id: string;
  readonly finishedAt: Date;
  // At least one: a finished session without answers is left out.
  readonly answers: readonly RecallHubAnswerScore[];
}

export interface RecallHubPage {
  readonly pageId: string;
  readonly pageTitle: string;
  readonly notebookId: string;
  readonly notebookTitle: string;
  // NotebookColor value, or null for a notebook without a stored color.
  readonly notebookColor: string | null;
  // Finished sessions with answers, newest first (finishedAt, then id,
  // both descending). Empty while the page only has questions (freshly
  // generated, or every session still open).
  readonly sessions: readonly RecallHubSession[];
  // Active (not archived) recall questions of the page (Phase 8 H17).
  readonly questionCount: number;
  // When the newest active question was created; null without any.
  readonly latestQuestionAt: Date | null;
}

export interface RecallHubReader {
  // Owner-scoped. Archived pages and pages of archived notebooks are left
  // out, and so are open sessions and archived questions. Ordered by notebook title, then page
  // title, then page id.
  listRecallPages(ownerId: string): Promise<RecallHubPage[]>;
}
