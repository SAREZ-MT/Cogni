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
