import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  type RecallAnswerRow,
  recallAnswers,
  recallQuestions,
  recallSessions,
} from "@/shared/db/schema";
import type { RecallAnswer } from "../domain/recall-answer";
import type {
  RecallAnswerRepository,
  RecallEvaluationResult,
} from "../domain/recall-answer-repository";

function toAnswer(row: RecallAnswerRow): RecallAnswer {
  return {
    id: row.id,
    ownerId: row.ownerId,
    sessionId: row.sessionId,
    questionId: row.questionId,
    answerText: row.answerText,
    selfRating: row.selfRating,
    evaluationStatus: row.evaluationStatus,
    aiEvaluation: row.aiEvaluation ?? null,
    aiScore: row.aiScore,
    combinedQuality: row.combinedQuality,
    disagreed: row.disagreed,
    generationId: row.generationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function oldestFirst(a: RecallAnswer, b: RecallAnswer): number {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

// Drizzle implementation of RecallAnswerRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction.
export class DrizzleRecallAnswerRepository implements RecallAnswerRepository {
  constructor(private readonly db: DbExecutor) {}

  async upsert(answer: RecallAnswer): Promise<RecallAnswer> {
    // The composite keys tie the session and the question to the owner;
    // the session's page is checked here (neither page ever changes).
    const [session] = await this.db
      .select({ pageId: recallSessions.pageId })
      .from(recallSessions)
      .where(
        and(
          eq(recallSessions.id, answer.sessionId),
          eq(recallSessions.ownerId, answer.ownerId),
        ),
      );
    const [question] = await this.db
      .select({ pageId: recallQuestions.pageId })
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.id, answer.questionId),
          eq(recallQuestions.ownerId, answer.ownerId),
        ),
      );
    if (!session || !question || question.pageId !== session.pageId) {
      throw new Error("recall answer does not fit its session and question");
    }
    // Only an unclaimed pending answer takes the new text and rating.
    await this.db
      .insert(recallAnswers)
      .values({
        id: answer.id,
        ownerId: answer.ownerId,
        sessionId: answer.sessionId,
        questionId: answer.questionId,
        answerText: answer.answerText,
        selfRating: answer.selfRating,
        evaluationStatus: answer.evaluationStatus,
        aiEvaluation: answer.aiEvaluation ?? null,
        aiScore: answer.aiScore,
        combinedQuality: answer.combinedQuality,
        generationId: answer.generationId,
        disagreed: answer.disagreed,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      })
      .onConflictDoUpdate({
        target: [recallAnswers.sessionId, recallAnswers.questionId],
        set: {
          answerText: answer.answerText,
          selfRating: answer.selfRating,
          updatedAt: answer.updatedAt,
        },
        setWhere: and(
          eq(recallAnswers.evaluationStatus, "pending"),
          isNull(recallAnswers.evaluationClaimedAt),
        ),
      });
    const [row] = await this.db
      .select()
      .from(recallAnswers)
      .where(
        and(
          eq(recallAnswers.sessionId, answer.sessionId),
          eq(recallAnswers.questionId, answer.questionId),
          eq(recallAnswers.ownerId, answer.ownerId),
        ),
      );
    if (!row) throw new Error("recall answer vanished after its upsert");
    return toAnswer(row);
  }

  async listBySession(
    sessionId: string,
    ownerId: string,
  ): Promise<RecallAnswer[]> {
    const rows = await this.db
      .select()
      .from(recallAnswers)
      .where(inSession(sessionId, ownerId))
      .orderBy(asc(recallAnswers.createdAt), asc(recallAnswers.id));
    return rows.map(toAnswer);
  }

  async claimPendingForEvaluation(
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<RecallAnswer[]> {
    // A conditional UPDATE: a concurrent run waits for the row lock, then
    // re-checks the claim and skips the rows this one took.
    const rows = await this.db
      .update(recallAnswers)
      .set({ evaluationClaimedAt: now, updatedAt: now })
      .where(
        and(
          inSession(sessionId, ownerId),
          eq(recallAnswers.evaluationStatus, "pending"),
          or(
            isNull(recallAnswers.evaluationClaimedAt),
            lt(recallAnswers.evaluationClaimedAt, staleBefore),
          ),
        ),
      )
      .returning();
    return rows.map(toAnswer).sort(oldestFirst);
  }

  async saveEvaluation(
    id: string,
    ownerId: string,
    result: RecallEvaluationResult,
    now: Date,
  ): Promise<RecallAnswer | null> {
    // Only a pending answer is resolved; the score and status checks
    // reject an out-of-range score. A resolved one is read back unchanged.
    await this.db
      .update(recallAnswers)
      .set({
        evaluationStatus: result.status,
        aiEvaluation: result.aiEvaluation ?? null,
        aiScore: result.status === "done" ? result.aiScore : null,
        combinedQuality:
          result.status === "done" ? result.combinedQuality : null,
        generationId: result.generationId,
        evaluationClaimedAt: null,
        updatedAt: now,
      })
      .where(
        and(owned(id, ownerId), eq(recallAnswers.evaluationStatus, "pending")),
      );
    return this.find(id, ownerId);
  }

  async requeueFailed(
    sessionId: string,
    ownerId: string,
    now: Date,
  ): Promise<number> {
    const rows = await this.db
      .update(recallAnswers)
      .set({
        evaluationStatus: "pending",
        evaluationClaimedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          inSession(sessionId, ownerId),
          eq(recallAnswers.evaluationStatus, "failed"),
        ),
      )
      .returning({ id: recallAnswers.id });
    return rows.length;
  }

  async markDisagreed(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<RecallAnswer | null> {
    // Idempotent: an answer already disagreed keeps its first updated_at.
    await this.db
      .update(recallAnswers)
      .set({ disagreed: true, updatedAt: now })
      .where(and(owned(id, ownerId), eq(recallAnswers.disagreed, false)));
    return this.find(id, ownerId);
  }

  private async find(id: string, ownerId: string) {
    const [row] = await this.db
      .select()
      .from(recallAnswers)
      .where(owned(id, ownerId));
    return row ? toAnswer(row) : null;
  }
}

function owned(id: string, ownerId: string) {
  return and(eq(recallAnswers.id, id), eq(recallAnswers.ownerId, ownerId));
}

function inSession(sessionId: string, ownerId: string) {
  return and(
    eq(recallAnswers.sessionId, sessionId),
    eq(recallAnswers.ownerId, ownerId),
  );
}
