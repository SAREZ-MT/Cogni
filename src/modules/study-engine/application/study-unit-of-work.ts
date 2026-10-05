import type { FlashcardSessionRepository } from "../domain/flashcard-session-repository";
import type { PageMasteryRepository } from "../domain/page-mastery-repository";
import type { ReviewLogRepository } from "../domain/review-log-repository";
import type { StudyItemRepository } from "../domain/study-item-repository";

export interface StudyRepositories {
  readonly studyItems: StudyItemRepository;
  readonly reviewLogs: ReviewLogRepository;
  readonly pageMastery: PageMasteryRepository;
  readonly sessions: FlashcardSessionRepository;
}

// Unit of work over one graded answer: the item's new SM-2 state, its
// ReviewLog, the session counts and the page's PageMastery commit together
// or not at all (a thrown error rolls everything back).
export interface StudyUnitOfWork {
  run<T>(work: (repositories: StudyRepositories) => Promise<T>): Promise<T>;
}
