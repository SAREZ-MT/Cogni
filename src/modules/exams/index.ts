// Public API of the "exams" module. No cross-module import may reach past
// this file (documento-maestro §5.3.5).
export {
  createExamQuestionAction,
  type ExamQuestionView,
  editExamQuestionAction,
  listExamQuestionsAction,
  type RetiredExamQuestionView,
  retireExamQuestionAction,
} from "./actions";
export * from "./domain";
