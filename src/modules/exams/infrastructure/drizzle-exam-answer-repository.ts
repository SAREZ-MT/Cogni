import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { examAnswers, examSessions } from "@/shared/db/schema";
import type { ExamAnswerRepository } from "../domain/exam-answer-repository";
import type { ExamAnswer } from "../domain/exam-session";

// Drizzle implementation of ExamAnswerRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction.
export class DrizzleExamAnswerRepository implements ExamAnswerRepository {
  constructor(private readonly db: DbExecutor) {}

  async saveMany(
    answers: readonly ExamAnswer[],
    ownerId: string,
  ): Promise<void> {
    if (answers.length === 0) return;
    // The session foreign key alone would accept another owner's session.
    const sessionIds = [...new Set(answers.map((a) => a.sessionId))];
    const owned = await this.db
      .select({ id: examSessions.id })
      .from(examSessions)
      .where(
        and(
          inArray(examSessions.id, sessionIds),
          eq(examSessions.ownerId, ownerId),
        ),
      );
    if (owned.length !== sessionIds.length) {
      throw new Error("exam answers reference a session the owner lacks");
    }
    // One statement: the (session, question) and (session, root) keys
    // reject a duplicate and the whole batch with it.
    await this.db.insert(examAnswers).values(
      answers.map((answer) => ({
        ownerId,
        sessionId: answer.sessionId,
        questionId: answer.questionId,
        rootId: answer.rootId,
        selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt,
      })),
    );
  }

  async listBySession(
    sessionId: string,
    ownerId: string,
  ): Promise<ExamAnswer[]> {
    return this.db
      .select({
        sessionId: examAnswers.sessionId,
        questionId: examAnswers.questionId,
        rootId: examAnswers.rootId,
        selectedIndex: examAnswers.selectedIndex,
        isCorrect: examAnswers.isCorrect,
        answeredAt: examAnswers.answeredAt,
      })
      .from(examAnswers)
      .where(
        and(
          eq(examAnswers.sessionId, sessionId),
          eq(examAnswers.ownerId, ownerId),
        ),
      )
      .orderBy(asc(examAnswers.answeredAt), asc(examAnswers.questionId));
  }
}
