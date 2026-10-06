export const GENERATE_RECALL_QUESTIONS_PROMPT_VERSION =
  "generate_recall_questions/v1";

// The prompt lists at most this many existing questions (the most recent
// ones): enough for the model to avoid repeating a page's questions without
// letting a long question bank crowd out the page text.
export const MAX_EXISTING_RECALL_QUESTIONS = 60;

export interface ExistingRecallQuestion {
  prompt: string;
}

export interface GenerateRecallQuestionsPromptInput {
  pageTitle: string;
  pageText: string;
  count: number;
  // The page's active questions, oldest first.
  existing: readonly ExistingRecallQuestion[];
}

export interface BuiltRecallQuestionsPrompt {
  system: string;
  prompt: string;
  temperature: number;
}

// Moderate temperature for generation (documento-maestro §8.1: <= 0.7).
const TEMPERATURE = 0.7;

// One line per question: inner newlines would break the list format.
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function existingSection(existing: readonly ExistingRecallQuestion[]): string {
  if (existing.length === 0) return "Existing questions: none";
  const recent = existing.slice(-MAX_EXISTING_RECALL_QUESTIONS);
  return [
    "Existing questions:",
    ...recent.map((q) => `- ${oneLine(q.prompt)}`),
  ].join("\n");
}

// documento-maestro §8.4 generate_recall_questions(plain_text, count) and
// §8.5: the rubric is what the evaluation later scores an answer against,
// so it must come from the page and nowhere else.
export function buildGenerateRecallQuestionsPrompt(
  input: GenerateRecallQuestionsPromptInput,
): BuiltRecallQuestionsPrompt {
  const system = [
    "You create open questions for active recall practice from a student's notes.",
    "Write every question, key concept and answer summary in Spanish.",
    `Produce exactly ${input.count} questions.`,
    "Each question is an open question that makes the student retrieve and explain an idea in their own words (explain, describe, compare, justify why or how). Never write yes/no questions, multiple-choice questions or questions answered by a single word or number.",
    "Each question has a rubric with 2 to 6 key concepts (a few words each) that a complete answer must mention, and an acceptable answer summary of one to three sentences.",
    "Derive every question, key concept and acceptable answer summary strictly and only from the provided text: do not add facts, examples or definitions that the text does not contain.",
    "Do not repeat any of the existing questions listed in the prompt, and do not ask about the same idea twice.",
  ].join("\n");

  const prompt = [
    `Page title: ${input.pageTitle}`,
    `Number of questions: ${input.count}`,
    "",
    existingSection(input.existing),
    "",
    "Text:",
    input.pageText,
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
