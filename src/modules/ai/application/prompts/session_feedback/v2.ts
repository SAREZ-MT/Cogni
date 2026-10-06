import type { BuiltPrompt } from "../generate_flashcards/v1";

// Exam session feedback (documento-maestro §3.3: "al final la IA explica
// las preguntas falladas usando el contenido de la página"). v1 carries
// only answer-button counts and struggled prompts, with no page text and no
// per-question detail; prompts are versioned and immutable, so exams get
// v2 and flashcards keep v1. Same output contract (sessionFeedbackOutput).
export const EXAM_SESSION_FEEDBACK_PROMPT_VERSION = "session_feedback/v2";

// Bounds that keep the prompt far below every provider's input cap besides
// the page text (already cut to the page token cap by the caller): only
// the first failed questions are sent, each field flattened and shortened.
export const MAX_FAILED_QUESTIONS = 10;
export const MAX_FAILED_FIELD_LENGTH = 300;

export interface FailedExamQuestion {
  concept: string;
  stem: string;
  // The option the student chose and the correct one, as text.
  chosenAnswer: string;
  correctAnswer: string;
  explanation: string;
}

// Exam results only: counts, outcome and the failed questions, plus the
// page text the explanations must come from. Never study time (product
// rule; the exam's own timer is not sent).
export interface ExamSessionFeedbackPromptInput {
  pageTitle: string;
  pageText: string;
  total: number;
  correct: number;
  passed: boolean;
  // In the exam's question order.
  failed: readonly FailedExamQuestion[];
}

// Evaluation purpose (documento-maestro §8.1: temperature <= 0.3).
const TEMPERATURE = 0.3;

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_FAILED_FIELD_LENGTH
    ? flat
    : `${flat.slice(0, MAX_FAILED_FIELD_LENGTH - 1)}…`;
}

function failedSection(question: FailedExamQuestion, n: number): string[] {
  return [
    `Question ${n} [${shorten(question.concept)}]: ${shorten(question.stem)}`,
    `  Student answered: ${shorten(question.chosenAnswer)}`,
    `  Correct answer: ${shorten(question.correctAnswer)}`,
    `  Explanation: ${shorten(question.explanation)}`,
  ];
}

export function buildExamSessionFeedbackPrompt(
  input: ExamSessionFeedbackPromptInput,
): BuiltPrompt {
  const system = [
    "You give a student short, encouraging feedback at the end of a multiple-choice exam about one page of their notes.",
    "Write every field in Spanish, addressing the student as tú.",
    "summary: one or two sentences on how the exam went.",
    "strengths: what the student showed they understand (may be empty).",
    "toReinforce: one item per failed concept: explain briefly why the correct answer is right and where the student's choice went wrong, using the page text (may be empty when nothing was failed).",
    "nextStepSuggestion: one concrete next step, such as reviewing a specific part of the page before retaking the exam.",
    "Base everything strictly on the results and the page text given: do not invent topics, facts or numbers.",
    "Never mention study time or durations.",
  ].join("\n");

  const failed = input.failed.slice(0, MAX_FAILED_QUESTIONS);
  const prompt = [
    "Technique: exam",
    `Page title: ${shorten(input.pageTitle)}`,
    `Questions answered: ${input.total}`,
    `Correct: ${input.correct}`,
    `Result: ${input.passed ? "passed (70 % or more)" : "below 70 %"}`,
    "",
    "Failed questions:",
    ...(failed.length > 0
      ? failed.flatMap((question, i) => failedSection(question, i + 1))
      : ["(none)"]),
    "",
    "Text:",
    input.pageText,
  ].join("\n");

  return { system, prompt, temperature: TEMPERATURE };
}
