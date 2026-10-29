import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type ExamQuestionRow, examQuestions } from "@/shared/db/schema";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamQuestionRepository } from "../domain/exam-question-repository";

function toQuestion(row: ExamQuestionRow): ExamQuestion {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    stem: row.stem,
    options: row.options,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    concept: row.concept,
    rootId: row.rootId,
    variantOf: row.variantOf,
    origin: row.origin,
    generationId: row.generationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    retiredAt: row.retiredAt,
  };
}

// Drizzle implementation of ExamQuestionRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction, so a
// question joins the caller's commit (e.g. with its study item).
export class DrizzleExamQuestionRepository implements ExamQuestionRepository {
  constructor(private readonly db: DbExecutor) {}

  async save(question: ExamQuestion): Promise<void> {
    await this.db.insert(examQuestions).values({
      id: question.id,
      ownerId: question.ownerId,
      pageId: question.pageId,
      stem: question.stem,
      options: [...question.options],
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      concept: question.concept,
      rootId: question.rootId,
      variantOf: question.variantOf,
      origin: question.origin,
      generationId: question.generationId,
      retiredAt: question.retiredAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    });
  }

  async update(question: ExamQuestion): Promise<ExamQuestion | null> {
    const [row] = await this.db
      .update(examQuestions)
      .set({
        stem: question.stem,
        options: [...question.options],
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        concept: question.concept,
        updatedAt: question.updatedAt,
      })
      .where(owned(question.id, question.ownerId))
      .returning();
    return row ? toQuestion(row) : null;
  }

  async findById(id: string, ownerId: string): Promise<ExamQuestion | null> {
    const [row] = await this.db
      .select()
      .from(examQuestions)
      .where(owned(id, ownerId));
    return row ? toQuestion(row) : null;
  }

  async listByIds(
    ids: readonly string[],
    ownerId: string,
  ): Promise<ExamQuestion[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(examQuestions)
      .where(
        and(
          inArray(examQuestions.id, [...ids]),
          eq(examQuestions.ownerId, ownerId),
        ),
      );
    return rows.map(toQuestion);
  }

  async listActiveByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamQuestion[]> {
    const rows = await this.db
      .select()
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.pageId, pageId),
          eq(examQuestions.ownerId, ownerId),
          isNull(examQuestions.retiredAt),
        ),
      )
      .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id));
    return rows.map(toQuestion);
  }

  async listShownAt(
    pageId: string,
    ownerId: string,
    at: Date,
  ): Promise<ExamQuestion[]> {
    const rows = await this.db
      .select()
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.pageId, pageId),
          eq(examQuestions.ownerId, ownerId),
          lte(examQuestions.createdAt, at),
          or(isNull(examQuestions.retiredAt), gt(examQuestions.retiredAt, at)),
        ),
      )
      .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id));
    return rows.map(toQuestion);
  }

  async listLineage(rootId: string, ownerId: string): Promise<ExamQuestion[]> {
    const rows = await this.db
      .select()
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.rootId, rootId),
          eq(examQuestions.ownerId, ownerId),
        ),
      )
      .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id));
    return rows.map(toQuestion);
  }

  async lockLineage(rootId: string, ownerId: string): Promise<void> {
    // SELECT … FOR UPDATE in id order, so two transactions locking the same
    // lineage take its rows in the same order and never deadlock.
    await this.db
      .select({ id: examQuestions.id })
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.rootId, rootId),
          eq(examQuestions.ownerId, ownerId),
        ),
      )
      .orderBy(asc(examQuestions.id))
      .for("update");
  }

  async retire(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<ExamQuestion | null> {
    // Only an active question changes; a retired one keeps its first
    // retired_at and is read back unchanged.
    await this.db
      .update(examQuestions)
      .set({ retiredAt: now, updatedAt: now })
      .where(and(owned(id, ownerId), isNull(examQuestions.retiredAt)));
    return this.findById(id, ownerId);
  }

  async deleteLineage(rootId: string, ownerId: string): Promise<void> {
    // One statement: the lineage's own foreign keys (root, variant_of) are
    // checked at its end, when every row of the lineage is gone.
    await this.db
      .delete(examQuestions)
      .where(
        and(
          eq(examQuestions.rootId, rootId),
          eq(examQuestions.ownerId, ownerId),
        ),
      );
  }
}

function owned(id: string, ownerId: string) {
  return and(eq(examQuestions.id, id), eq(examQuestions.ownerId, ownerId));
}
