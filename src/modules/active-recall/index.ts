// Public API of the "active-recall" module (Fase 6 — Recordación activa).
// No cross-module import may reach past this file (documento-maestro §5.3.5).
export {
  generateRecallQuestionsAction,
  type RecallGenerationActionError,
  type RecallGenerationView,
  type RecallQuestionView,
} from "./actions";
export * from "./domain";
export {
  type FinishedRecallSessionView,
  finishRecallSessionAction,
  getRecallSessionPlanAction,
  type RecallSessionPlanView,
  type RecallSessionQuestionView,
  type SavedRecallAnswerView,
  type StartedRecallSessionView,
  saveRecallAnswerAction,
  startRecallSessionAction,
} from "./session-actions";
