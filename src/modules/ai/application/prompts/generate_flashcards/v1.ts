export const GENERATE_FLASHCARDS_PROMPT_VERSION = "generate_flashcards/v1";

export interface GenerateFlashcardsPromptInput {
  pageTitle: string;
  pageText: string;
  count: number;
}

export interface BuiltPrompt {
  system: string;
  prompt: string;
  temperature: number;
}

// Moderate temperature for generation (documento-maestro §8.1: <= 0.7).
const TEMPERATURE = 0.7;

export function buildGenerateFlashcardsPrompt(
  input: GenerateFlashcardsPromptInput,
): BuiltPrompt {
  const system = [
    "You create study flashcards from a student's notes.",
    "Write every card in Spanish.",
    "Each card has a front (a concise question or cue) and a back (a precise, short answer).",
    `Produce exactly ${input.count} cards.`,
    "Derive every card strictly from the provided text: do not add facts, examples or definitions that the text does not contain.",
    "Do not repeat the same idea in two cards. Keep fronts and backs concise.",
  ].join("\n");

  const prompt = [
    `Page title: ${input.pageTitle}`,
    `Number of flashcards: ${input.count}`,
    "",
    "Text:",
    input.pageText,
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
