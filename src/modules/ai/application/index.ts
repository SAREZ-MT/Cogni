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
  GenerateObjectRequest,
  GenerateObjectResponse,
  GenerationRateLimit,
  GenerationRateLimiter,
  IdGenerator,
  QuotaStore,
} from "./ports";
export {
  buildGenerateExamQuestionsPrompt,
  type ExistingExamQuestion,
  GENERATE_EXAM_QUESTIONS_PROMPT_VERSION,
  type GenerateExamQuestionsPromptInput,
  MAX_EXISTING_QUESTIONS,
} from "./prompts/generate_exam_questions/v1";
export {
  buildGenerateExamVariantsPrompt,
  type FailedExamRoot,
  GENERATE_EXAM_VARIANTS_PROMPT_VERSION,
  type GenerateExamVariantsPromptInput,
} from "./prompts/generate_exam_variants/v1";
export {
  buildGenerateFlashcardsPrompt,
  GENERATE_FLASHCARDS_PROMPT_VERSION,
} from "./prompts/generate_flashcards/v1";
export {
  buildGenerateRecallQuestionsPrompt,
  type ExistingRecallQuestion,
  GENERATE_RECALL_QUESTIONS_PROMPT_VERSION,
  type GenerateRecallQuestionsPromptInput,
  MAX_EXISTING_RECALL_QUESTIONS,
} from "./prompts/generate_recall_questions/v1";
export {
  buildSessionFeedbackPrompt,
  MAX_STRUGGLED_ITEM_LENGTH,
  MAX_STRUGGLED_ITEMS,
  SESSION_FEEDBACK_PROMPT_VERSION,
  type SessionFeedbackPromptInput,
  type SessionFeedbackTechnique,
} from "./prompts/session_feedback/v1";
export {
  buildExamSessionFeedbackPrompt,
  EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
  type ExamSessionFeedbackPromptInput,
  type FailedExamQuestion,
  MAX_FAILED_FIELD_LENGTH,
  MAX_FAILED_QUESTIONS,
} from "./prompts/session_feedback/v2";
export * from "./schemas";
