import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  notebooks,
  pages,
  recallAnswers,
  recallSessions,
} from "@/shared/db/schema";
import type {
  RecallHubPage,
  RecallHubReader,
  RecallHubSession,
} from "../domain/recall-hub-reader";

// Drizzle implementation of RecallHubReader: one owner-wide read, never one
// per page. Every answer of the owner's finished sessions comes back with
// its session, page and notebook (the inner join leaves out sessions
// without answers), already in the hub's order; the rows are then folded
// into pages and sessions.
export class DrizzleRecallHubReader implements RecallHubReader {
  constructor(private readonly db: DbExecutor) {}

  async listRecallPages(ownerId: string): Promise<RecallHubPage[]> {
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
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
      .innerJoin(pages, eq(pages.id, recallSessions.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(recallSessions.ownerId, ownerId),
          isNotNull(recallSessions.finishedAt),
          eq(pages.ownerId, ownerId),
          isNull(pages.archivedAt),
          isNull(notebooks.archivedAt),
        ),
      )
      .orderBy(
        asc(notebooks.title),
        asc(pages.title),
        asc(pages.id),
        desc(recallSessions.finishedAt),
        desc(recallSessions.id),
        asc(recallAnswers.createdAt),
        asc(recallAnswers.id),
      );

    const byPage = new Map<
      string,
      RecallHubPage & { sessions: RecallHubSession[] }
    >();
    const bySession = new Map<
      string,
      RecallHubSession & { answers: RecallHubSession["answers"][number][] }
    >();
    for (const row of rows) {
      // The where clause keeps finished sessions only.
      if (!row.finishedAt) continue;
      let page = byPage.get(row.pageId);
      if (!page) {
        page = {
          pageId: row.pageId,
          pageTitle: row.pageTitle,
          notebookId: row.notebookId,
          notebookTitle: row.notebookTitle,
          notebookColor: row.notebookColor,
          sessions: [],
        };
        byPage.set(row.pageId, page);
      }
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
