import { and, eq } from "drizzle-orm";
import {
  createStudyItemRepository,
  type StudyItemKind,
} from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import { studyItems } from "@/shared/db/schema";
import type {
  ExamQuestionRepositories,
  ExamStudyItems,
  ExamUnitOfWork,
} from "../application/exam-unit-of-work";
import { DrizzleExamFingerprints } from "./drizzle-exam-fingerprints";
import { DrizzleExamLineageReferences } from "./drizzle-exam-lineage-references";
import { DrizzleExamQuestionRepository } from "./drizzle-exam-question-repository";

// One Postgres transaction per run: the question repository and the
// study-engine repository are both built on the transaction handle, so a
// root and its study item (or a retire and its suspension) commit or roll
// back together. Inside a caller's transaction Drizzle uses a savepoint.
export class DrizzleExamUnitOfWork implements ExamUnitOfWork {
  constructor(private readonly db: DbExecutor) {}

  run<T>(
    work: (repositories: ExamQuestionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        questions: new DrizzleExamQuestionRepository(tx),
        studyItems: examStudyItems(tx),
        fingerprints: new DrizzleExamFingerprints(tx),
        lineageRefs: new DrizzleExamLineageReferences(tx),
      }),
    );
  }
}

// study-engine's repository plus the delete the edit page needs (Phase 8
// H18). study_items carries no foreign key to its source, so deleting a
// lineage leaves its root's item behind unless this removes it;
// review_logs cascade from the item.
export function examStudyItems(db: DbExecutor): ExamStudyItems {
  const items = createStudyItemRepository(db);
  return {
    save: (item) => items.save(item),
    findBySource: (kind, sourceId, ownerId) =>
      items.findBySource(kind, sourceId, ownerId),
    suspend: (id, ownerId, now) => items.suspend(id, ownerId, now),
    async deleteBySource(
      kind: StudyItemKind,
      sourceId: string,
      ownerId: string,
    ): Promise<void> {
      await db
        .delete(studyItems)
        .where(
          and(
            eq(studyItems.kind, kind),
            eq(studyItems.sourceId, sourceId),
            eq(studyItems.ownerId, ownerId),
          ),
        );
    },
  };
}
