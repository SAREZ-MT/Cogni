// Every reason the app calls a model (documento-maestro §8.4). Later phases
// plug into the purposes already declared here.
export const AI_PURPOSES = [
  "generate_flashcards",
  "generate_exam_questions",
  "generate_exam_variants",
  "generate_recall_questions",
  "evaluate_recall_answer",
  "session_feedback",
] as const;

export type AiPurpose = (typeof AI_PURPOSES)[number];

// The app-wide daily budgets (S1b): every provider attempt is charged to the
// budget of its purpose's group, across all users.
export const AI_BUDGET_GROUPS = [
  "generation",
  "evaluation",
  "feedback",
] as const;

export type AiBudgetGroup = (typeof AI_BUDGET_GROUPS)[number];

export function budgetGroupOf(purpose: AiPurpose): AiBudgetGroup {
  if (purpose === "evaluate_recall_answer") return "evaluation";
  if (purpose === "session_feedback") return "feedback";
  return "generation";
}
