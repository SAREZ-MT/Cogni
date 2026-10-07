import { createStudyItemRepository } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import type {
  RecallQuestionRepositories,
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
        studyItems: createStudyItemRepository(tx),
        fingerprints: new DrizzleRecallFingerprints(tx),
      }),
    );
  }
}
