// Public API of the "flashcards" module. No cross-module import may reach
// past this file (documento-maestro §5.3.5).
export {
  type DeckDeletionView,
  type DeckEditsView,
  type DeckView,
  deleteDeckAction,
  type FlashcardView,
  type GenerationActionError,
  type GenerationStatusView,
  type GenerationView,
  generateFlashcardsAction,
  getGenerationStatusAction,
  listDecksAction,
  listFlashcardsAction,
  previewDeckDeletionAction,
  saveDeckEditsAction,
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
