import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type {
  RecallHubReader,
  RecallHubSession,
} from "../domain/recall-hub-reader";
import { sessionScore } from "../domain/recall-session";

// Study-engine page mastery (RF-SE-02, ADR-007), the score 0–1 per page of
// the owner; null when it could not be read. A page without a row was
// never reviewed and counts as 0 (computeMastery's "Nuevo").
export interface RecallPageMasterySource {
  masteryByPage(ownerId: string): Promise<ReadonlyMap<string, number> | null>;
}

// Recall questions due now per page (the same "due" as "Repasos de hoy");
// null when the due items could not be read.
export interface RecallDueCounts {
  recallQuestionsDueByPage(
    ownerId: string,
  ): Promise<ReadonlyMap<string, number> | null>;
}

export interface RecallHubSessionEntry {
  id: string;
  finishedAt: Date;
  // The questions answered (or skipped) in the session.
  questionCount: number;
  // AI score buckets (≥ 4 / 2–3 / ≤ 1) of the evaluated answers.
  correct: number;
  partial: number;
  incorrect: number;
  // Average combined quality × 20 (0–100); null while nothing is evaluated.
  percentage: number | null;
}

export interface RecallHubEntry {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
  // Newest first.
  sessions: RecallHubSessionEntry[];
  // The page's study-engine mastery as a whole percent; null when unknown.
  mastery: number | null;
  // The page's recall questions due today; null when unknown.
  dueToday: number | null;
}

export interface RecallHub {
  pages: RecallHubEntry[];
  // The listed pages' average mastery as a whole percent; null when no
  // page is listed or the mastery could not be read.
  averageMastery: number | null;
}

function toSessionEntry(session: RecallHubSession): RecallHubSessionEntry {
  const score = sessionScore(session.answers);
  return {
    id: session.id,
    finishedAt: session.finishedAt,
    questionCount: session.answers.length,
    correct: score.correct,
    partial: score.partial,
    incorrect: score.incorrect,
    percentage: score.percentage,
  };
}

// The active recall hub and notebook view (documento-maestro §3.3): every
// page of the owner with a finished session, its sessions with their
// scores (decision in force: average combined × 20 and AI score buckets),
// the page mastery from study-engine — never a recall-local formula — and
// its recall questions due today, in the reader's order.
export async function listRecallHub(
  deps: {
    reader: RecallHubReader;
    mastery: RecallPageMasterySource;
    due: RecallDueCounts;
  },
  ownerId: string,
): Promise<Result<RecallHub, DomainError>> {
  const [pages, masteryByPage, due] = await Promise.all([
    deps.reader.listRecallPages(ownerId),
    deps.mastery.masteryByPage(ownerId),
    deps.due.recallQuestionsDueByPage(ownerId),
  ]);
  const entries = pages.map((page) => ({
    pageId: page.pageId,
    pageTitle: page.pageTitle,
    notebookId: page.notebookId,
    notebookTitle: page.notebookTitle,
    notebookColor: page.notebookColor,
    sessions: page.sessions.map(toSessionEntry),
    mastery:
      masteryByPage === null
        ? null
        : Math.round((masteryByPage.get(page.pageId) ?? 0) * 100),
    dueToday: due === null ? null : (due.get(page.pageId) ?? 0),
  }));
  const averageMastery =
    masteryByPage === null || pages.length === 0
      ? null
      : Math.round(
          (pages.reduce(
            (sum, page) => sum + (masteryByPage.get(page.pageId) ?? 0),
            0,
          ) /
            pages.length) *
            100,
        );
  return ok({ pages: entries, averageMastery });
}
