import type { DbExecutor } from "@/shared/db/client";
import type {
  StudyRepositories,
  StudyUnitOfWork,
} from "../application/study-unit-of-work";
import { DrizzleFlashcardSessionRepository } from "./drizzle-flashcard-session-repository";
import { DrizzlePageMasteryRepository } from "./drizzle-page-mastery-repository";
import { DrizzleReviewLogRepository } from "./drizzle-review-log-repository";
import { DrizzleStudyItemRepository } from "./drizzle-study-item-repository";

// One Postgres transaction per run: every repository is built on the
// transaction handle, so a graded answer's item, log, session counts and
// page mastery commit or roll back together.
export class DrizzleStudyUnitOfWork implements StudyUnitOfWork {
  constructor(private readonly db: DbExecutor) {}

  run<T>(work: (repositories: StudyRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        studyItems: new DrizzleStudyItemRepository(tx),
        reviewLogs: new DrizzleReviewLogRepository(tx),
        pageMastery: new DrizzlePageMasteryRepository(tx),
        sessions: new DrizzleFlashcardSessionRepository(tx),
      }),
    );
  }
}
