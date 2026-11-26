export {
  AiGenerationFailedError,
  type GenerateStructuredDeps,
  type GenerateStructuredInput,
  type GenerateStructuredOutput,
  generateStructured,
  maxTemperatureFor,
} from "./generate-structured";
export type {
  AiGenerationRepository,
  AiProvider,
  AiProviderMap,
  BreakerStore,
  BudgetStore,
  GenerateObjectRequest,
  GenerateObjectResponse,
  GenerationRateLimit,
  GenerationRateLimiter,
  IdGenerator,
  QuotaStore,
} from "./ports";
export {
  type BuiltEvaluateRecallAnswersPrompt,
  buildEvaluateRecallAnswersPrompt,
  EVALUATE_RECALL_ANSWER_PROMPT_VERSION,
  type EvaluatedRecallAnswer,
  MAX_EVALUATED_ANSWER_LENGTH,
} from "./prompts/evaluate_recall_answer/v3";
export {
  buildGenerateExamQuestionsPrompt,
  type ExistingExamQuestion,
  GENERATE_EXAM_QUESTIONS_PROMPT_VERSION,
  type GenerateExamQuestionsPromptInput,
  MAX_EXISTING_QUESTIONS,
} from "./prompts/generate_exam_questions/v2";
export {
  buildGenerateExamVariantsPrompt,
  type FailedExamRoot,
  GENERATE_EXAM_VARIANTS_PROMPT_VERSION,
  type GenerateExamVariantsPromptInput,
} from "./prompts/generate_exam_variants/v2";
export {
  buildGenerateFlashcardsPrompt,
  GENERATE_FLASHCARDS_PROMPT_VERSION,
} from "./prompts/generate_flashcards/v2";
export {
  buildGenerateRecallQuestionsPrompt,
  type ExistingRecallQuestion,
  GENERATE_RECALL_QUESTIONS_PROMPT_VERSION,
  type GenerateRecallQuestionsPromptInput,
  MAX_EXISTING_RECALL_QUESTIONS,
} from "./prompts/generate_recall_questions/v2";
export {
  buildExamSessionFeedbackPrompt,
  EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
  type ExamSessionFeedbackPromptInput,
  type FailedExamQuestion,
  MAX_FAILED_FIELD_LENGTH,
  MAX_FAILED_QUESTIONS,
} from "./prompts/session_feedback/v4";
export {
  buildSessionFeedbackPrompt,
  MAX_RECALLED_ITEMS,
  MAX_SESSION_ITEM_LENGTH,
  MAX_STRUGGLED_ITEMS,
  SESSION_FEEDBACK_PROMPT_VERSION,
  type SessionFeedbackPromptInput,
  type SessionFeedbackTechnique,
} from "./prompts/session_feedback/v5";
export * from "./schemas";
