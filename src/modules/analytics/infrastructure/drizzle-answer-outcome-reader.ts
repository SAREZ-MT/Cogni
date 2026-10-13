import { and, asc, eq, gte, isNotNull, lt } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  examAnswers,
  examSessions,
  notebooks,
  pages,
  recallAnswers,
  recallSessions,
} from "@/shared/db/schema";
import type {
  AnswerOutcomeReader,
  ExamAnswerFact,
  RecallAnswerFact,
} from "../domain/readers";
import { livePage } from "./live-pages";

// Read-only access to the exams and active-recall answer tables (master
// doc §5.2: analytics reads the techniques). Each answer reaches its page
// through its session.
export class DrizzleAnswerOutcomeReader implements AnswerOutcomeReader {
  constructor(private readonly db: DbExecutor) {}

  async listExamAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<ExamAnswerFact[]> {
    return this.db
      .select({
        pageId: pages.id,
        isCorrect: examAnswers.isCorrect,
        answeredAt: examAnswers.answeredAt,
      })
      .from(examAnswers)
      .innerJoin(examSessions, eq(examSessions.id, examAnswers.sessionId))
      .innerJoin(pages, eq(pages.id, examSessions.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(examAnswers.ownerId, ownerId),
          isNotNull(examSessions.finishedAt),
          gte(examAnswers.answeredAt, from),
          lt(examAnswers.answeredAt, to),
          ...livePage,
        ),
      )
      .orderBy(asc(examAnswers.answeredAt), asc(examAnswers.questionId));
  }

  async listRecallAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<RecallAnswerFact[]> {
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        selfRating: recallAnswers.selfRating,
        aiScore: recallAnswers.aiScore,
        answeredAt: recallAnswers.createdAt,
      })
      .from(recallAnswers)
      .innerJoin(recallSessions, eq(recallSessions.id, recallAnswers.sessionId))
      .innerJoin(pages, eq(pages.id, recallSessions.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(recallAnswers.ownerId, ownerId),
          eq(recallAnswers.evaluationStatus, "done"),
          gte(recallAnswers.createdAt, from),
          lt(recallAnswers.createdAt, to),
          ...livePage,
        ),
      )
      .orderBy(asc(recallAnswers.createdAt), asc(recallAnswers.id));
    // A "done" answer always has its AI score (recall_answers_evaluation_check).
    return rows.map((row) => ({ ...row, aiScore: row.aiScore as number }));
  }
}
