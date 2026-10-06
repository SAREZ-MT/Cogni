// Public API of the "study-engine" module: the pure SM-2 engine and page
// mastery (documento-maestro §7) and the flashcard review session. No
// cross-module import may reach past this file (§5.3.5).
export type {
  DueFlashcard,
  ExamReviewAnswer,
  GradedFlashcard,
  MasteryRecomputeSummary,
  PageAccess,
  RecallReview,
  RecordExamReviewsInput,
  RecordedExamReviews,
  RecordedRecallReviews,
  RecordRecallReviewsInput,
  StartedFlashcardSession,
} from "./application";
export * from "./domain";
export {
  createExamReviewRecorder,
  createFlashcardSessionsServerApi,
  createMasteryRecomputeJob,
  createRecallReviewRecorder,
  createSessionFeedbackSources,
  createStudyItemRepository,
  type ExamReviewRecorder,
  type FlashcardSessionsServerApi,
  type MasteryRecomputeJob,
  type RecallReviewRecorder,
  type SessionFeedbackSources,
} from "./server-api";
