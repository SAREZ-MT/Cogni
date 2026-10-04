// Public API of the "study-engine" module: the pure SM-2 engine and page
// mastery (documento-maestro §7) and the flashcard review session. No
// cross-module import may reach past this file (§5.3.5).
export type {
  DueFlashcard,
  GradedFlashcard,
  PageAccess,
  StartedFlashcardSession,
} from "./application";
export * from "./domain";
export {
  createFlashcardSessionsServerApi,
  createStudyItemRepository,
  type FlashcardSessionsServerApi,
} from "./server-api";
