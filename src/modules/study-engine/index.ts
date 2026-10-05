// Public API of the "study-engine" module: the pure SM-2 engine and page
// mastery (documento-maestro §7) and the flashcard review session. No
// cross-module import may reach past this file (§5.3.5).
export type {
  DueFlashcard,
  ExamReviewAnswer,
  GradedFlashcard,
  MasteryRecomputeSummary,
  PageAccess,
  RecordExamReviewsInput,
  RecordedExamReviews,
  StartedFlashcardSession,
} from "./application";
export * from "./domain";
export {
  createExamReviewRecorder,
  createFlashcardSessionsServerApi,
  createMasteryRecomputeJob,
  createSessionFeedbackSources,
  createStudyItemRepository,
  type ExamReviewRecorder,
  type FlashcardSessionsServerApi,
  type MasteryRecomputeJob,
  type SessionFeedbackSources,
} from "./server-api";
