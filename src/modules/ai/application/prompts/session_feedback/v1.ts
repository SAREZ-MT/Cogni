import type { BuiltPrompt } from "../generate_flashcards/v1";

export const SESSION_FEEDBACK_PROMPT_VERSION = "session_feedback/v1";

// Bounds that keep the prompt far below every provider's input cap: only
// the first struggled items are sent, each one shortened.
export const MAX_STRUGGLED_ITEMS = 8;
export const MAX_STRUGGLED_ITEM_LENGTH = 200;

export type SessionFeedbackTechnique = "flashcards" | "exam" | "recall";

// Session results only (documento-maestro §8.4: technique and results).
// Counts per answer button; never study time (product rule).
export interface SessionFeedbackPromptInput {
  technique: SessionFeedbackTechnique;
  reviewedCount: number;
  counts: { again: number; hard: number; good: number; easy: number };
  // The prompts of the items answered "Otra vez" or "Difícil", hardest first.
  struggled: readonly string[];
}

// Evaluation purpose (documento-maestro §8.1: temperature <= 0.3).
const TEMPERATURE = 0.3;

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_STRUGGLED_ITEM_LENGTH
    ? flat
    : `${flat.slice(0, MAX_STRUGGLED_ITEM_LENGTH - 1)}…`;
}

export function buildSessionFeedbackPrompt(
  input: SessionFeedbackPromptInput,
): BuiltPrompt {
  const system = [
    "You give a student short, encouraging feedback at the end of a study session.",
    "Write every field in Spanish, addressing the student as tú.",
    "summary: one or two sentences on how the session went.",
    "strengths: what the student recalled well (may be empty).",
    "toReinforce: the concepts worth reviewing again, based on the items they struggled with (may be empty).",
    "nextStepSuggestion: one concrete next step.",
    "Base everything strictly on the results given: do not invent topics, facts or numbers.",
    "Never mention study time or durations.",
  ].join("\n");

  const struggled = input.struggled.slice(0, MAX_STRUGGLED_ITEMS).map(shorten);
  const prompt = [
    `Technique: ${input.technique}`,
    `Items reviewed: ${input.reviewedCount}`,
    `Again: ${input.counts.again}`,
    `Hard: ${input.counts.hard}`,
    `Good: ${input.counts.good}`,
    `Easy: ${input.counts.easy}`,
    "",
    "Items the student struggled with:",
    ...(struggled.length > 0 ? struggled.map((s) => `- ${s}`) : ["(none)"]),
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
