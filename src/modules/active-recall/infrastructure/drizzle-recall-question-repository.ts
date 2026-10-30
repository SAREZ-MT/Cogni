import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type RecallQuestionRow, recallQuestions } from "@/shared/db/schema";
import type { RecallQuestion } from "../domain/recall-question";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";

function toQuestion(row: RecallQuestionRow): RecallQuestion {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    prompt: row.prompt,
    rubric: row.rubric,
    origin: row.origin,
    generationId: row.generationId,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of RecallQuestionRepository; every read filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction, so
// the questions join the caller's commit (e.g. with their study items).
export class DrizzleRecallQuestionRepository
  implements RecallQuestionRepository
{
  constructor(private readonly db: DbExecutor) {}

  async saveMany(questions: readonly RecallQuestion[]): Promise<void> {
    if (questions.length === 0) return;
    // One statement: a duplicate id rejects the whole batch.
    await this.db.insert(recallQuestions).values(
      questions.map((question) => ({
        id: question.id,
        ownerId: question.ownerId,
        pageId: question.pageId,
        prompt: question.prompt,
        rubric: {
          keyConcepts: [...question.rubric.keyConcepts],
          acceptableAnswerSummary: question.rubric.acceptableAnswerSummary,
        },
        origin: question.origin,
        generationId: question.generationId,
        archivedAt: question.archivedAt,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      })),
    );
  }

  async listActiveByPage(
    pageId: string,
    ownerId: string,
  ): Promise<RecallQuestion[]> {
    const rows = await this.db
      .select()
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.pageId, pageId),
          eq(recallQuestions.ownerId, ownerId),
          isNull(recallQuestions.archivedAt),
        ),
      )
      .orderBy(asc(recallQuestions.createdAt), asc(recallQuestions.id));
    return rows.map(toQuestion);
  }

  async listByIds(
    ids: readonly string[],
    ownerId: string,
  ): Promise<RecallQuestion[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(recallQuestions)
      .where(
        and(
          inArray(recallQuestions.id, [...ids]),
          eq(recallQuestions.ownerId, ownerId),
        ),
      )
      .orderBy(asc(recallQuestions.createdAt), asc(recallQuestions.id));
    return rows.map(toQuestion);
  }

  async update(question: RecallQuestion): Promise<RecallQuestion | null> {
    const [row] = await this.db
      .update(recallQuestions)
      .set({
        prompt: question.prompt,
        rubric: {
          keyConcepts: [...question.rubric.keyConcepts],
          acceptableAnswerSummary: question.rubric.acceptableAnswerSummary,
        },
        updatedAt: question.updatedAt,
      })
      .where(
        and(
          eq(recallQuestions.id, question.id),
          eq(recallQuestions.ownerId, question.ownerId),
          isNull(recallQuestions.archivedAt),
        ),
      )
      .returning();
    return row ? toQuestion(row) : null;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    // recall_answers_question_owner_fk cascades the question's answers.
    await this.db
      .delete(recallQuestions)
      .where(
        and(eq(recallQuestions.id, id), eq(recallQuestions.ownerId, ownerId)),
      );
  }
}
