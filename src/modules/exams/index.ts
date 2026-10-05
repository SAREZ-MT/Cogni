// Public API of the "exams" module. No cross-module import may reach past
// this file (documento-maestro §5.3.5).
export {
  createExamQuestionAction,
  type ExamGenerationActionError,
  type ExamGenerationView,
  type ExamQuestionView,
  editExamQuestionAction,
  generateExamQuestionsAction,
  listExamQuestionsAction,
  type RetiredExamQuestionView,
  retireExamQuestionAction,
} from "./actions";
export * from "./domain";
