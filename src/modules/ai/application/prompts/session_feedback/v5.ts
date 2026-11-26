import type { BuiltPrompt } from "../generate_flashcards/v2";
import { oneLine, untrustedDataRule, wrapUntrusted } from "../untrusted";

// Flashcards session feedback in a tutor's voice (user decision
// 2026-11-26). v3 asked for "short, encouraging feedback" from the counts
// and the struggled card fronts alone, so the praise could name no topic.
// v5 also carries the fronts the student recalled well and asks for a
// Socratic tutor: hints and guiding questions, never the answer. The card
// backs are not sent, so the model has no answer to reveal. Same output
// contract (sessionFeedbackOutput); exams keep their own prompt (v4).
export const SESSION_FEEDBACK_PROMPT_VERSION = "session_feedback/v5";

// Bounds that keep the prompt far below every provider's input cap: only
// the first items of each block are sent, each one shortened.
export const MAX_STRUGGLED_ITEMS = 8;
export const MAX_RECALLED_ITEMS = 8;
export const MAX_SESSION_ITEM_LENGTH = 200;

export type SessionFeedbackTechnique = "flashcards" | "exam" | "recall";

// Session results only (documento-maestro §8.4: technique and results).
// Counts per answer button; never study time (product rule).
export interface SessionFeedbackPromptInput {
  technique: SessionFeedbackTechnique;
  reviewedCount: number;
  counts: { again: number; hard: number; good: number; easy: number };
  // The prompts of the items answered "Bien" or "Fácil", easiest first.
  recalled: readonly string[];
  // The prompts of the items answered "Otra vez" or "Difícil", hardest first.
  struggled: readonly string[];
}

// Evaluation purpose (documento-maestro §8.1: temperature <= 0.3).
const TEMPERATURE = 0.3;

function shorten(text: string): string {
  const flat = oneLine(text);
  return flat.length <= MAX_SESSION_ITEM_LENGTH
    ? flat
    : `${flat.slice(0, MAX_SESSION_ITEM_LENGTH - 1)}…`;
}

function listOf(items: readonly string[], max: number): string {
  return items
    .slice(0, max)
    .map((item) => `- ${shorten(item)}`)
    .join("\n");
}

export function buildSessionFeedbackPrompt(
  input: SessionFeedbackPromptInput,
): BuiltPrompt {
  const system = [
    "You are a warm, attentive tutor talking to one student right after their flashcard review session.",
    'Write every field in Spanish, addressing the student as tú and speaking in the first person, as a tutor who followed the session (for example "Considero que…", "Me parece que…").',
    "You follow the Socratic method: you guide the student towards the answer with hints and guiding questions. Never state, define or explain the answer of a card.",
    "summary: two or three sentences on how the session went, personal and specific. When most answers were Good or Easy, congratulate the student sincerely and say which topics they handled well. When several were Again or Hard, encourage them and say they have opportunities to improve.",
    "strengths: the topics the student handled well, taken from <recalled_items>, each one a short phrase naming the topic (at most 4; empty when there is none).",
    'toReinforce: one entry per topic worth reinforcing, taken from <struggled_items> (at most 4; empty when there is none). Each entry presents the topic as an "oportunidad de mejora": name the topic, tell the student which precise aspect to focus on, and end with one guiding question that points them towards the answer without giving it.',
    "nextStepSuggestion: one concrete, encouraging next step that names what to focus on and what the student will gain from it (for example a better understanding of the whole topic).",
    "Never say the student was wrong, failed or made mistakes: speak only of what they handled well and of opportunities to improve.",
    'No generic advice such as "study more", "review the topic" or "approach it differently": always name the topic and the aspect to focus on.',
    "Base everything strictly on the results given: do not invent topics, facts or numbers.",
    "Never mention study time or durations.",
    untrustedDataRule(["recalled_items", "struggled_items"], { title: false }),
  ].join("\n");

  const prompt = [
    `Technique: ${input.technique}`,
    `Items reviewed: ${input.reviewedCount}`,
    `Again: ${input.counts.again}`,
    `Hard: ${input.counts.hard}`,
    `Good: ${input.counts.good}`,
    `Easy: ${input.counts.easy}`,
    "",
    "Items the student recalled well:",
    wrapUntrusted("recalled_items", listOf(input.recalled, MAX_RECALLED_ITEMS)),
    "",
    "Items the student struggled with:",
    wrapUntrusted(
      "struggled_items",
      listOf(input.struggled, MAX_STRUGGLED_ITEMS),
    ),
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
