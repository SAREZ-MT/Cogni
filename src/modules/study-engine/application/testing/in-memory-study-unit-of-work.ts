import type { StudyRepositories, StudyUnitOfWork } from "../study-unit-of-work";
import { InMemoryFlashcardSessionRepository } from "./in-memory-flashcard-session-repository";
import { InMemoryPageMasteryRepository } from "./in-memory-page-mastery-repository";
import { InMemoryReviewLogRepository } from "./in-memory-review-log-repository";
import { InMemoryStudyItemRepository } from "./in-memory-study-item-repository";

// Runs `work` directly against the fakes and, like a transaction, restores
// every fake to its state before the run when `work` throws. Postgres
// atomicity is proven by tests/db/drizzle-study-unit-of-work.test.ts.
export class InMemoryStudyUnitOfWork implements StudyUnitOfWork {
  runs = 0;

  constructor(
    readonly studyItems = new InMemoryStudyItemRepository(),
    readonly reviewLogs = new InMemoryReviewLogRepository(),
    readonly pageMastery = new InMemoryPageMasteryRepository(),
    readonly sessions = new InMemoryFlashcardSessionRepository(),
  ) {}

  async run<T>(work: (repositories: StudyRepositories) => Promise<T>) {
    this.runs += 1;
    const restores = [
      this.studyItems.snapshot(),
      this.reviewLogs.snapshot(),
      this.pageMastery.snapshot(),
      this.sessions.snapshot(),
    ];
    try {
      return await work({
        studyItems: this.studyItems,
        reviewLogs: this.reviewLogs,
        pageMastery: this.pageMastery,
        sessions: this.sessions,
      });
    } catch (error) {
      for (const restore of restores) restore();
      throw error;
    }
  }
}
