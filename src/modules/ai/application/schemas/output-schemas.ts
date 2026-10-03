import { z } from "zod";
import type { AiPurpose } from "../../domain/purpose";

// Output contracts per purpose (documento-maestro §8.4). They live in
// application, not domain: domain-is-pure forbids any import outside domain
// and shared/kernel, zod included. Every provider answer is validated against
// these; an answer that does not fit is a failure, never repaired or invented
// (§8.1).

const text = z.string().trim().min(1);
const options = z.array(text).length(4);
const correctIndex = z.number().int().min(0).max(3);

export const flashcardsOutput = z.object({
  cards: z.array(z.object({ front: text, back: text })).min(1),
});

export const examQuestionsOutput = z.object({
  questions: z
    .array(
      z.object({
        stem: text,
        options,
        correctIndex,
        explanation: text,
        concept: text,
      }),
    )
    .min(1),
});

export const examVariantsOutput = z.object({
  variants: z
    .array(
      z.object({
        forRootId: text,
        stem: text,
        options,
        correctIndex,
        explanation: text,
      }),
    )
    .min(1),
});

export const recallQuestionsOutput = z.object({
  questions: z
    .array(
      z.object({
        prompt: text,
        rubric: z.object({
          keyConcepts: z.array(text),
          acceptableAnswerSummary: text,
        }),
      }),
    )
    .min(1),
});

export const recallEvaluationOutput = z.object({
  score: z.number().int().min(0).max(5),
  presentConcepts: z.array(text),
  missingConcepts: z.array(text),
  misconceptions: z.array(text),
  justification: text,
});

export const sessionFeedbackOutput = z.object({
  summary: text,
  strengths: z.array(text),
  toReinforce: z.array(text),
  nextStepSuggestion: text,
});

const OUTPUT_SCHEMAS = {
  generate_flashcards: flashcardsOutput,
  generate_exam_questions: examQuestionsOutput,
  generate_exam_variants: examVariantsOutput,
  generate_recall_questions: recallQuestionsOutput,
  evaluate_recall_answer: recallEvaluationOutput,
  session_feedback: sessionFeedbackOutput,
} as const satisfies Record<AiPurpose, z.ZodType>;

export type OutputSchemaMap = typeof OUTPUT_SCHEMAS;

export function outputSchemaFor<P extends AiPurpose>(
  purpose: P,
): OutputSchemaMap[P] {
  return OUTPUT_SCHEMAS[purpose];
}

export type FlashcardsOutput = z.infer<typeof flashcardsOutput>;
export type ExamQuestionsOutput = z.infer<typeof examQuestionsOutput>;
export type ExamVariantsOutput = z.infer<typeof examVariantsOutput>;
export type RecallQuestionsOutput = z.infer<typeof recallQuestionsOutput>;
export type RecallEvaluationOutput = z.infer<typeof recallEvaluationOutput>;
export type SessionFeedbackOutput = z.infer<typeof sessionFeedbackOutput>;
