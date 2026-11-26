import { z } from "zod";
import type { AiPurpose } from "../../domain/purpose";

// Output contracts per purpose (documento-maestro §8.4). They live in
// application, not domain: domain-is-pure forbids any import outside domain
// and shared/kernel, zod included. Every provider answer is validated against
// these; an answer that does not fit is a failure, never repaired or invented
// (§8.1).

const text = z.string().trim().min(1);

// Size caps of the texts and lists whose content follows untrusted input (a
// student's answer or page): generous for a real answer, small enough that
// an injected instruction cannot make the model return unbounded output
// (security-hardening S2). An answer over a cap is a failure, like any
// other answer that does not fit.
// The concept caps equal what a manual rubric may hold (active-recall's
// edit action: 30 key concepts of 500 characters), since an evaluation
// copies the rubric's concepts; the text cap equals a manual field (4,000).
export const MAX_OUTPUT_CONCEPT_LENGTH = 500;
export const MAX_OUTPUT_CONCEPTS = 30;
export const MAX_OUTPUT_TEXT_LENGTH = 4000;
export const MAX_OUTPUT_LIST_ITEMS = 15;

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

// One recall session at most (RECALL_SESSION_SIZE): every written answer of
// a session is evaluated in one call (evaluate_recall_answer/v4).
export const MAX_EVALUATED_ANSWERS = 10;

// The purposes whose texts and lists follow untrusted input, with their
// size caps (`capped`) or without them. The capped set validates every
// answer. The uncapped one is what a provider receives as its response
// schema: the caps travel as maxLength and maxItems, and Gemini refuses the
// capped evaluation schema ("too many states for serving", 400), so both
// attempts of a recall evaluation failed (2026-11-26).
function cappedShapes(capped: boolean) {
  const concept = capped ? text.max(MAX_OUTPUT_CONCEPT_LENGTH) : text;
  const concepts = capped
    ? z.array(concept).max(MAX_OUTPUT_CONCEPTS)
    : z.array(concept);
  const longText = capped ? text.max(MAX_OUTPUT_TEXT_LENGTH) : text;
  const longTexts = capped
    ? z.array(longText).max(MAX_OUTPUT_LIST_ITEMS)
    : z.array(longText);

  const recallQuestions = z.object({
    questions: z
      .array(
        z.object({
          prompt: text,
          rubric: z.object({
            keyConcepts: concepts,
            acceptableAnswerSummary: longText,
          }),
        }),
      )
      .min(1),
  });

  const recallEvaluation = z.object({
    score: z.number().int().min(0).max(5),
    presentConcepts: concepts,
    missingConcepts: concepts,
    misconceptions: longTexts,
    justification: longText,
  });

  // The batched evaluation: one entry per answer item, keyed by the item's
  // id. The caller checks that every id it sent comes back exactly once.
  const recallEvaluations = z.object({
    evaluations: z
      .array(recallEvaluation.extend({ questionId: text }))
      .min(1)
      .max(MAX_EVALUATED_ANSWERS),
  });

  const sessionFeedback = z.object({
    summary: longText,
    strengths: longTexts,
    toReinforce: longTexts,
    nextStepSuggestion: longText,
  });

  return {
    recallQuestions,
    recallEvaluation,
    recallEvaluations,
    sessionFeedback,
  };
}

const validated = cappedShapes(true);
const sent = cappedShapes(false);

export const recallQuestionsOutput = validated.recallQuestions;
export const recallEvaluationOutput = validated.recallEvaluation;
export const recallEvaluationsOutput = validated.recallEvaluations;
export const sessionFeedbackOutput = validated.sessionFeedback;

const OUTPUT_SCHEMAS = {
  generate_flashcards: flashcardsOutput,
  generate_exam_questions: examQuestionsOutput,
  generate_exam_variants: examVariantsOutput,
  generate_recall_questions: recallQuestionsOutput,
  evaluate_recall_answer: recallEvaluationsOutput,
  session_feedback: sessionFeedbackOutput,
} as const satisfies Record<AiPurpose, z.ZodType>;

export type OutputSchemaMap = typeof OUTPUT_SCHEMAS;

export function outputSchemaFor<P extends AiPurpose>(
  purpose: P,
): OutputSchemaMap[P] {
  return OUTPUT_SCHEMAS[purpose];
}

// What a provider receives as the response schema of a purpose: the same
// shape as the validated schema, without the size caps. The answer is then
// validated with outputSchemaFor, caps included.
const PROVIDER_SCHEMAS = {
  ...OUTPUT_SCHEMAS,
  generate_recall_questions: sent.recallQuestions,
  evaluate_recall_answer: sent.recallEvaluations,
  session_feedback: sent.sessionFeedback,
} as const satisfies Record<AiPurpose, z.ZodType>;

export function providerSchemaFor(purpose: AiPurpose): z.ZodType {
  return PROVIDER_SCHEMAS[purpose];
}

// The purpose a schema belongs to, validated or provider one; null for any
// other schema.
export function purposeOfSchema(schema: unknown): AiPurpose | null {
  for (const schemas of [OUTPUT_SCHEMAS, PROVIDER_SCHEMAS]) {
    for (const [purpose, candidate] of Object.entries(schemas)) {
      if (candidate === schema) return purpose as AiPurpose;
    }
  }
  return null;
}

export type FlashcardsOutput = z.infer<typeof flashcardsOutput>;
export type ExamQuestionsOutput = z.infer<typeof examQuestionsOutput>;
export type ExamVariantsOutput = z.infer<typeof examVariantsOutput>;
export type RecallQuestionsOutput = z.infer<typeof recallQuestionsOutput>;
export type RecallEvaluationOutput = z.infer<typeof recallEvaluationOutput>;
export type RecallEvaluationsOutput = z.infer<typeof recallEvaluationsOutput>;
export type SessionFeedbackOutput = z.infer<typeof sessionFeedbackOutput>;
