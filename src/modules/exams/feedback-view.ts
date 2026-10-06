import type { ExamFeedback } from "./application";

// The AI feedback of a finished exam as the results screen shows it
// (§3.3, §8.4). "failed" (and a "pending" held by a concurrent request)
// carry no content: the UI shows a calm note and the exam stays closed
// either way. `reused`: the feedback of the last passing exam, shown again
// for a later pass without a new AI call (user decision 2026-10-05).
export interface ExamFeedbackView {
  status: "pending" | "done" | "failed";
  reused: boolean;
  content: {
    summary: string;
    strengths: string[];
    toReinforce: string[];
    nextStepSuggestion: string;
  } | null;
}

export function toExamFeedbackView({
  feedback,
  reused,
}: ExamFeedback): ExamFeedbackView {
  const { status, content } = feedback;
  return {
    status,
    reused,
    content: content && {
      summary: content.summary,
      strengths: [...content.strengths],
      toReinforce: [...content.toReinforce],
      nextStepSuggestion: content.nextStepSuggestion,
    },
  };
}
