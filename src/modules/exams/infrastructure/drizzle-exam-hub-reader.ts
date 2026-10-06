import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  examPageState,
  examQuestions,
  examSessions,
  notebooks,
  pages,
} from "@/shared/db/schema";
import type { ExamHubPage, ExamHubReader } from "../domain/exam-hub-reader";

// Drizzle implementation of ExamHubReader: two owner-wide reads, never one
// per page. The first groups the active questions by page (with the page's
// notebook and retake state); the second takes each page's latest finished
// session and the count of finished sessions.
export class DrizzleExamHubReader implements ExamHubReader {
  constructor(private readonly db: DbExecutor) {}

  async listExamPages(ownerId: string): Promise<ExamHubPage[]> {
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        activeQuestionCount: countDistinct(examQuestions.rootId),
        retakePending: sql<boolean>`coalesce(${examPageState.retakePending}, false)`,
      })
      .from(examQuestions)
      .innerJoin(pages, eq(pages.id, examQuestions.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .leftJoin(
        examPageState,
        and(
          eq(examPageState.pageId, pages.id),
          eq(examPageState.ownerId, ownerId),
        ),
      )
      .where(
        and(
          eq(examQuestions.ownerId, ownerId),
          isNull(examQuestions.retiredAt),
          eq(pages.ownerId, ownerId),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .groupBy(pages.id, notebooks.id, examPageState.retakePending)
      .orderBy(asc(notebooks.title), asc(pages.title), asc(pages.id));
    if (rows.length === 0) return [];

    const latest = await this.db
      .selectDistinctOn([examSessions.pageId], {
        pageId: examSessions.pageId,
        finishedAt: examSessions.finishedAt,
        total: examSessions.total,
        correct: examSessions.correct,
        passed: examSessions.passed,
        attempts: sql<number>`count(*) over (partition by ${examSessions.pageId})::int`,
      })
      .from(examSessions)
      .where(
        and(
          eq(examSessions.ownerId, ownerId),
          isNotNull(examSessions.finishedAt),
          inArray(
            examSessions.pageId,
            rows.map((row) => row.pageId),
          ),
        ),
      )
      .orderBy(
        examSessions.pageId,
        desc(examSessions.finishedAt),
        desc(examSessions.id),
      );
    const byPage = new Map(latest.map((session) => [session.pageId, session]));

    return rows.map((row) => {
      const session = byPage.get(row.pageId);
      return {
        ...row,
        attempts: session?.attempts ?? 0,
        // A finished session always carries its result (0010 CHECK).
        lastSession:
          session?.finishedAt &&
          session.total !== null &&
          session.correct !== null
            ? {
                finishedAt: session.finishedAt,
                total: session.total,
                correct: session.correct,
                passed: session.passed === true,
              }
            : null,
      };
    });
  }
}
