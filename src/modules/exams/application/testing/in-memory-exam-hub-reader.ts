import type { ExamHubPage, ExamHubReader } from "../../domain/exam-hub-reader";
import type { createInMemoryExamRepositories } from "./in-memory-exam-repositories";

// What the pages and notebooks tables would answer for one page.
export interface InMemoryHubPage {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
  ownerId: string;
  // The page or its notebook is archived.
  archived: boolean;
}

type InMemoryExamRepositories = ReturnType<
  typeof createInMemoryExamRepositories
>;

// In-memory ExamHubReader over the in-memory exam repositories; `page`
// stands in for the pages/notebooks tables. Satisfies the shared contract
// (exam-hub-reader.contract.ts).
export class InMemoryExamHubReader implements ExamHubReader {
  constructor(
    private readonly repositories: InMemoryExamRepositories,
    private readonly page: (pageId: string) => InMemoryHubPage | undefined,
  ) {}

  async listExamPages(ownerId: string): Promise<ExamHubPage[]> {
    const roots = new Map<string, Set<string>>();
    for (const question of this.repositories.questions.snapshot()) {
      if (question.ownerId !== ownerId || question.retiredAt !== null) {
        continue;
      }
      const pageRoots = roots.get(question.pageId) ?? new Set<string>();
      pageRoots.add(question.rootId);
      roots.set(question.pageId, pageRoots);
    }
    const sessions = this.repositories.sessions
      .snapshot()
      .filter((s) => s.ownerId === ownerId && s.finishedAt !== null);
    const states = this.repositories.pageStates
      .snapshot()
      .filter((state) => state.ownerId === ownerId);

    const rows: ExamHubPage[] = [];
    for (const [pageId, pageRoots] of roots) {
      const page = this.page(pageId);
      if (!page || page.ownerId !== ownerId || page.archived) continue;
      const finished = sessions
        .filter((s) => s.pageId === pageId)
        .sort(
          (a, b) =>
            (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0) ||
            (a.id < b.id ? 1 : -1),
        );
      const last = finished[0];
      const state = states.find((candidate) => candidate.pageId === pageId);
      rows.push({
        pageId,
        pageTitle: page.pageTitle,
        notebookId: page.notebookId,
        notebookTitle: page.notebookTitle,
        notebookColor: page.notebookColor,
        activeQuestionCount: pageRoots.size,
        attempts: finished.length,
        lastSession:
          last?.finishedAt && last.total !== null && last.correct !== null
            ? {
                finishedAt: last.finishedAt,
                total: last.total,
                correct: last.correct,
                passed: last.passed === true,
              }
            : null,
        retakePending: state?.retakePending ?? false,
        failedRootIds: [...(state?.failedRootIds ?? [])],
      });
    }
    return rows.sort(
      (a, b) =>
        a.notebookTitle.localeCompare(b.notebookTitle) ||
        a.pageTitle.localeCompare(b.pageTitle) ||
        (a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0),
    );
  }
}
