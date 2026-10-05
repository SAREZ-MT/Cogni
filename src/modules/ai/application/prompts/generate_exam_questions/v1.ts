export const GENERATE_EXAM_QUESTIONS_PROMPT_VERSION =
  "generate_exam_questions/v1";

// The prompt lists at most this many existing questions (the most recent
// ones): enough for the model to avoid repeating a page's questions without
// letting a long question bank crowd out the page text.
export const MAX_EXISTING_QUESTIONS = 60;

export interface ExistingExamQuestion {
  stem: string;
  concept: string;
}

export interface GenerateExamQuestionsPromptInput {
  pageTitle: string;
  pageText: string;
  count: number;
  // The page's active questions (and those already generated earlier in
  // the same request), oldest first.
  existing: readonly ExistingExamQuestion[];
}

export interface BuiltExamQuestionsPrompt {
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

function existingSection(existing: readonly ExistingExamQuestion[]): string {
  if (existing.length === 0) return "Existing questions: none";
  const recent = existing.slice(-MAX_EXISTING_QUESTIONS);
  return [
    "Existing questions:",
    ...recent.map((q) => `- [${oneLine(q.concept)}] ${oneLine(q.stem)}`),
  ].join("\n");
}

export function buildGenerateExamQuestionsPrompt(
  input: GenerateExamQuestionsPromptInput,
): BuiltExamQuestionsPrompt {
  const system = [
    "You create multiple-choice exam questions from a student's notes.",
    "Write every question, option, explanation and concept in Spanish.",
    `Produce exactly ${input.count} questions.`,
    "Each question has a stem, exactly 4 options of which exactly one is correct, the index (0-3) of the correct option, a short explanation of why it is correct, and a short concept (a few words) naming the idea it evaluates.",
    "The 3 wrong options must be plausible but clearly wrong according to the text, and all 4 options must be different.",
    "Derive every question strictly from the provided text: do not add facts, examples or definitions that the text does not contain.",
    "Do not repeat any of the existing questions listed in the prompt, and do not ask about the same idea twice in the same way.",
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
