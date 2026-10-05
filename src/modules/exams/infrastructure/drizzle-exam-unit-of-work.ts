import { createStudyItemRepository } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import type {
  ExamQuestionRepositories,
  ExamUnitOfWork,
} from "../application/exam-unit-of-work";
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
        studyItems: createStudyItemRepository(tx),
      }),
    );
  }
}
