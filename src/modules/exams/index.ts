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
export type { ExamReviewNotice } from "./application";
export * from "./domain";
export {
  getExamReviewNoticeAction,
  requestExamFeedbackAction,
} from "./feedback-actions";
export type { ExamFeedbackView } from "./feedback-view";
export { type ExamHubPageView, listExamHubAction } from "./hub-actions";
export {
  type StartedExamRetakeView,
  startExamRetakeAction,
} from "./retake-actions";
export {
  answerExamQuestionAction,
  type ExamAnswerView,
  type ExamPlayerQuestionView,
  type ExamResultQuestionView,
  type ExamResultsView,
  type ExamSessionView,
  type ExamStartView,
  type FinishedExamSessionView,
  finishExamSessionAction,
  getExamResultsAction,
  getExamSessionAction,
  getExamStartAction,
  type StartedExamSessionView,
  startExamSessionAction,
} from "./session-actions";
