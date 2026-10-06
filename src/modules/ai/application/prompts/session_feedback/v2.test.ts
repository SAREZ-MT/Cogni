import { describe, expect, it } from "vitest";
import {
  buildExamSessionFeedbackPrompt,
  EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
  type ExamSessionFeedbackPromptInput,
  MAX_FAILED_FIELD_LENGTH,
  MAX_FAILED_QUESTIONS,
} from "./v2";

const base: ExamSessionFeedbackPromptInput = {
  pageTitle: "Mitocondria",
  pageText: "La mitocondria produce ATP mediante la respiración celular.",
  total: 10,
  correct: 6,
  passed: false,
  failed: [
    {
      concept: "Función de la mitocondria",
      stem: "¿Qué produce la mitocondria?",
      chosenAnswer: "ADN",
      correctAnswer: "ATP",
      explanation: "La respiración celular produce ATP.",
    },
  ],
};

function failedLines(prompt: string): string[] {
  return prompt.split("\n").filter((line) => line.startsWith("Question "));
}

describe("session_feedback/v2 prompt (exams)", () => {
  const built = buildExamSessionFeedbackPrompt(base);

  it("exposes its version, distinct from the flashcards v1", () => {
    expect(EXAM_SESSION_FEEDBACK_PROMPT_VERSION).toBe("session_feedback/v2");
  });

  it("embeds the exam result without any time data", () => {
    expect(built.prompt).toContain("Technique: exam");
    expect(built.prompt).toContain("Page title: Mitocondria");
    expect(built.prompt).toContain("Questions answered: 10");
    expect(built.prompt).toContain("Correct: 6");
    expect(built.prompt).toContain("Result: below 70 %");
    expect(built.prompt).not.toMatch(/duration|minutes|seconds|time/i);
  });

  it("states a passing result", () => {
    const passed = buildExamSessionFeedbackPrompt({
      ...base,
      correct: 9,
      passed: true,
    });
    expect(passed.prompt).toContain("Result: passed (70 % or more)");
  });

  it("lists every failed question with the student's choice, the correct option, the explanation and the concept", () => {
    expect(built.prompt).toContain(
      "Question 1 [Función de la mitocondria]: ¿Qué produce la mitocondria?",
    );
    expect(built.prompt).toContain("  Student answered: ADN");
    expect(built.prompt).toContain("  Correct answer: ATP");
    expect(built.prompt).toContain(
      "  Explanation: La respiración celular produce ATP.",
    );
  });

  it("says so when nothing was failed", () => {
    const clean = buildExamSessionFeedbackPrompt({ ...base, failed: [] });
    expect(clean.prompt).toContain("Failed questions:\n(none)");
  });

  it("puts the page text last so the model explains errors with it", () => {
    expect(built.prompt.endsWith(`Text:\n${base.pageText}`)).toBe(true);
  });

  it("keeps at most the first failed questions, each field flattened and shortened", () => {
    const long = `línea\n${"x".repeat(MAX_FAILED_FIELD_LENGTH + 40)}`;
    const many = Array.from({ length: MAX_FAILED_QUESTIONS + 4 }, (_, i) => ({
      concept: `C${i}`,
      stem: long,
      chosenAnswer: long,
      correctAnswer: long,
      explanation: long,
    }));
    const capped = buildExamSessionFeedbackPrompt({ ...base, failed: many });
    expect(failedLines(capped.prompt)).toHaveLength(MAX_FAILED_QUESTIONS);
    for (const line of capped.prompt.split("\n")) {
      if (line.startsWith("  ")) {
        expect(line.length).toBeLessThanOrEqual(
          MAX_FAILED_FIELD_LENGTH + "  Student answered: ".length,
        );
      }
    }
    expect(capped.prompt).not.toContain("línea\n");
  });

  it("instructs Spanish feedback that explains the errors from the page text only", () => {
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/explain/i);
    expect(built.system).toMatch(/page text/i);
    expect(built.system).toMatch(/never mention study time/i);
    expect(built.system).toMatch(/do not invent/i);
  });

  it("uses an evaluation temperature of at most 0.3", () => {
    expect(built.temperature).toBeLessThanOrEqual(0.3);
  });
});
