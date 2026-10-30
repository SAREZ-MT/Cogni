import {
  and,
  asc,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  notebooks,
  pages,
  recallAnswers,
  recallQuestions,
  recallSessions,
} from "@/shared/db/schema";
import type {
  RecallHubPage,
  RecallHubReader,
  RecallHubSession,
} from "../domain/recall-hub-reader";

// Drizzle implementation of RecallHubReader: two owner-wide reads, never
// one per page. The first lists the pages (with their notebook) holding an
// active recall question or a finished session with answers, already in
// the hub's order; the second takes every answer of the owner's finished
// sessions (the inner join leaves out sessions without answers), which are
// then folded into those pages.
export class DrizzleRecallHubReader implements RecallHubReader {
  constructor(private readonly db: DbExecutor) {}

  async listRecallPages(ownerId: string): Promise<RecallHubPage[]> {
    const finishedSessionWithAnswers = this.db
      .select({ id: recallSessions.id })
      .from(recallSessions)
      .innerJoin(
        recallAnswers,
        and(
          eq(recallAnswers.sessionId, recallSessions.id),
          eq(recallAnswers.ownerId, ownerId),
        ),
      )
      .where(
        and(
          eq(recallSessions.pageId, pages.id),
          eq(recallSessions.ownerId, ownerId),
          isNotNull(recallSessions.finishedAt),
        ),
      );
    const activeQuestion = this.db
      .select({ id: recallQuestions.id })
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.pageId, pages.id),
          eq(recallQuestions.ownerId, ownerId),
          isNull(recallQuestions.archivedAt),
        ),
      );
    // Phase 8 H17: the page's active question count and newest question,
    // as correlated subqueries of this same read (no query per page).
    const activeQuestions = sql`from ${recallQuestions} where ${recallQuestions.pageId} = ${pages.id} and ${recallQuestions.ownerId} = ${ownerId} and ${recallQuestions.archivedAt} is null`;
    const pageRows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        questionCount: sql<number>`(select count(*)::int ${activeQuestions})`,
        latestQuestionAt:
          sql<Date | null>`(select max(${recallQuestions.createdAt}) ${activeQuestions})`.mapWith(
            (value: string | Date | null) =>
              value === null ? null : new Date(value),
          ),
      })
      .from(pages)
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(pages.ownerId, ownerId),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
          or(exists(activeQuestion), exists(finishedSessionWithAnswers)),
        ),
      )
      .orderBy(asc(notebooks.title), asc(pages.title), asc(pages.id));

    const rows = await this.db
      .select({
        pageId: recallSessions.pageId,
        sessionId: recallSessions.id,
        finishedAt: recallSessions.finishedAt,
        aiScore: recallAnswers.aiScore,
        combinedQuality: recallAnswers.combinedQuality,
      })
      .from(recallSessions)
      .innerJoin(
        recallAnswers,
        and(
          eq(recallAnswers.sessionId, recallSessions.id),
          eq(recallAnswers.ownerId, ownerId),
        ),
      )
      .where(
        and(
          eq(recallSessions.ownerId, ownerId),
          isNotNull(recallSessions.finishedAt),
        ),
      )
      .orderBy(
        desc(recallSessions.finishedAt),
        desc(recallSessions.id),
        asc(recallAnswers.createdAt),
        asc(recallAnswers.id),
      );

    const byPage = new Map<
      string,
      RecallHubPage & { sessions: RecallHubSession[] }
    >(pageRows.map((row) => [row.pageId, { ...row, sessions: [] }]));
    const bySession = new Map<
      string,
      RecallHubSession & { answers: RecallHubSession["answers"][number][] }
    >();
    for (const row of rows) {
      // The where clause keeps finished sessions only; sessions of a page
      // left out (archived, another notebook's archive) are skipped.
      const page = byPage.get(row.pageId);
      if (!row.finishedAt || !page) continue;
      let session = bySession.get(row.sessionId);
      if (!session) {
        session = {
          id: row.sessionId,
          finishedAt: row.finishedAt,
          answers: [],
        };
        bySession.set(row.sessionId, session);
        page.sessions.push(session);
      }
      session.answers.push({
        aiScore: row.aiScore,
        combinedQuality: row.combinedQuality,
      });
    }
    return [...byPage.values()];
  }
}
