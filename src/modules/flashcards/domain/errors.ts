// DomainError codes for the flashcards module.
export const FLASHCARD_ERROR = {
  EMPTY: "FLASHCARD_EMPTY",
  TOO_LONG: "FLASHCARD_TOO_LONG",
  NOT_FOUND: "FLASHCARD_NOT_FOUND",
  // Archiving it would leave the page's deck empty (a deck is never empty).
  LAST_CARD: "FLASHCARD_LAST_CARD",
  // Session feedback is requested before the review session was finished.
  FEEDBACK_SESSION_OPEN: "FLASHCARDS_FEEDBACK_SESSION_OPEN",
  // Session feedback is requested for a session without graded answers.
  FEEDBACK_NOTHING_REVIEWED: "FLASHCARDS_FEEDBACK_NOTHING_REVIEWED",
  SESSION_REQUIRED: "FLASHCARDS_SESSION_REQUIRED",
  INVALID_INPUT: "FLASHCARDS_INVALID_INPUT",
  UNEXPECTED: "FLASHCARDS_UNEXPECTED",
} as const;
