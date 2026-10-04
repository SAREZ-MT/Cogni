// Public API of the "flashcards" module. No cross-module import may reach
// past this file (documento-maestro §5.3.5). Study sessions arrive in Fase 4.
export {
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
