// Public API of the "flashcards" module. No cross-module import may reach
// past this file (documento-maestro §5.3.5).
export {
  type ArchiveDeckView,
  type ArchiveView,
  archiveDeckAction,
  archiveFlashcardAction,
  type DeckView,
  type FlashcardView,
  type GenerationActionError,
  type GenerationStatusView,
  type GenerationView,
  generateFlashcardsAction,
  getGenerationStatusAction,
  listDecksAction,
  listFlashcardsAction,
} from "./actions";
export * from "./domain";
export {
  finishFlashcardSessionAction,
  type GradeView,
  gradeFlashcardAction,
  type ReviewCardView,
  type ReviewSessionView,
  type ReviewSummaryView,
  requestSessionFeedbackAction,
  type SessionFeedbackView,
  startFlashcardSessionAction,
} from "./session-actions";
