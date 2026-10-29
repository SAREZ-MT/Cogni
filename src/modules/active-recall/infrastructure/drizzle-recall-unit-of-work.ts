import { and, eq } from "drizzle-orm";
import {
  createStudyItemRepository,
  type StudyItemKind,
} from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import { studyItems } from "@/shared/db/schema";
import type {
  RecallQuestionRepositories,
  RecallStudyItems,
  RecallUnitOfWork,
} from "../application/recall-unit-of-work";
import { DrizzleRecallFingerprints } from "./drizzle-recall-fingerprints";
import { DrizzleRecallQuestionRepository } from "./drizzle-recall-question-repository";

// One Postgres transaction per run: the question repository and the
// study-engine repository are both built on the transaction handle, so a
// generation's questions and their study items commit or roll back
// together. Inside a caller's transaction Drizzle uses a savepoint.
export class DrizzleRecallUnitOfWork implements RecallUnitOfWork {
  constructor(private readonly db: DbExecutor) {}

  run<T>(
    work: (repositories: RecallQuestionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        questions: new DrizzleRecallQuestionRepository(tx),
        studyItems: recallStudyItems(tx),
        fingerprints: new DrizzleRecallFingerprints(tx),
      }),
    );
  }
}

// study-engine's repository plus the delete the edit page needs (Phase 8
// H18). study_items carries no foreign key to its source, so deleting a
// question leaves its item behind unless this removes it; review_logs
// cascade from the item.
export function recallStudyItems(db: DbExecutor): RecallStudyItems {
  const items = createStudyItemRepository(db);
  return {
    save: (item) => items.save(item),
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
