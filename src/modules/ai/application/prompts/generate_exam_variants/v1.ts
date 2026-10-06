export const GENERATE_EXAM_VARIANTS_PROMPT_VERSION =
  "generate_exam_variants/v1";

// One root failed in the last exam: what the model needs to reformulate it
// (documento-maestro §7.5.1, §8.4).
export interface FailedExamRoot {
  rootId: string;
  concept: string;
  // Every earlier wording of the root's lineage, retired ones included,
  // oldest first: the new variant must differ from all of them.
  previousStems: readonly string[];
  // The correct option and explanation of the question last shown.
  correctAnswer: string;
  explanation: string;
}

export interface GenerateExamVariantsPromptInput {
  pageTitle: string;
  pageText: string;
  failed: readonly FailedExamRoot[];
}

export interface BuiltExamVariantsPrompt {
  system: string;
  prompt: string;
  temperature: number;
}

// Moderate temperature for generation (documento-maestro §8.1: <= 0.7).
const TEMPERATURE = 0.7;

// One line per field: inner newlines would break the list format.
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function rootSection(root: FailedExamRoot): string[] {
  return [
    `Root ${oneLine(root.rootId)} [${oneLine(root.concept)}]`,
    `  Correct answer: ${oneLine(root.correctAnswer)}`,
    `  Explanation: ${oneLine(root.explanation)}`,
    ...root.previousStems.map((stem) => `  Previous wording: ${oneLine(stem)}`),
  ];
}

// The prompt keeps the header shape of the other generation prompts
// ("Page title: …" then "Number of variants: N") and lists the failed roots
// before the page text.
export function buildGenerateExamVariantsPrompt(
  input: GenerateExamVariantsPromptInput,
): BuiltExamVariantsPrompt {
  const system = [
    "You reformulate multiple-choice exam questions that a student failed, so the retake checks the same idea without repeating any question.",
    "Write every question, option and explanation in Spanish.",
    "Produce exactly one variant for each root listed in the prompt, and set its forRootId to that root's id exactly as written.",
    "A variant evaluates the same concept as its root, with a different wording or approach (for example a different angle, an example or an application): never reuse any of the previous wordings listed for that root, and never ask about another topic.",
    "Each variant has a stem, exactly 4 options of which exactly one is correct, the index (0-3) of the correct option, and a short explanation of why it is correct.",
    "The 3 wrong options must be plausible but clearly wrong according to the text, and all 4 options must be different.",
    "Derive every variant strictly from the provided text and the listed correct answers: do not add facts the text does not contain.",
  ].join("\n");

  const prompt = [
    `Page title: ${input.pageTitle}`,
    `Number of variants: ${input.failed.length}`,
    "",
    "Failed questions:",
    ...input.failed.flatMap(rootSection),
    "",
    "Text:",
    input.pageText,
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
