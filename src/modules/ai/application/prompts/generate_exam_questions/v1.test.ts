import { describe, expect, it } from "vitest";
import {
  buildGenerateExamQuestionsPrompt,
  GENERATE_EXAM_QUESTIONS_PROMPT_VERSION,
  MAX_EXISTING_QUESTIONS,
} from "./v1";

describe("generate_exam_questions/v1 prompt", () => {
  const built = buildGenerateExamQuestionsPrompt({
    pageTitle: "Mitocondria",
    pageText: "La mitocondria produce ATP.",
    count: 12,
    existing: [
      { stem: "¿Qué produce la\n mitocondria?", concept: "Función" },
      { stem: "¿Dónde está el ADN?", concept: "ADN" },
    ],
  });

  it("exposes its version", () => {
    expect(GENERATE_EXAM_QUESTIONS_PROMPT_VERSION).toBe(
      "generate_exam_questions/v1",
    );
  });

  it("embeds the page title and text, with the text last", () => {
    expect(built.prompt).toContain("Page title: Mitocondria");
    expect(built.prompt.endsWith("Text:\nLa mitocondria produce ATP.")).toBe(
      true,
    );
  });

  it("asks for exactly the requested number of questions", () => {
    expect(built.system).toContain("exactly 12");
    expect(built.prompt).toContain("Number of questions: 12");
  });

  it("describes the multiple-choice shape: 4 options, one correct, explanation and concept", () => {
    expect(built.system).toContain("4 options");
    expect(built.system).toMatch(/exactly one (is )?correct/i);
    expect(built.system).toContain("explanation");
    expect(built.system).toContain("concept");
  });

  it("instructs Spanish output derived strictly from the text", () => {
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/strictly/i);
  });

  it("lists the existing questions on one line each so the model avoids duplicates", () => {
    expect(built.system).toMatch(/existing questions/i);
    expect(built.prompt).toContain(
      "Existing questions:\n- [Función] ¿Qué produce la mitocondria?\n- [ADN] ¿Dónde está el ADN?",
    );
  });

  it("says there are no existing questions when the page has none", () => {
    const empty = buildGenerateExamQuestionsPrompt({
      pageTitle: "T",
      pageText: "x",
      count: 10,
      existing: [],
    });
    expect(empty.prompt).toContain("Existing questions: none");
  });

  it("keeps only the most recent existing questions when there are too many", () => {
    const existing = Array.from(
      { length: MAX_EXISTING_QUESTIONS + 5 },
      (_, i) => ({ stem: `Pregunta ${i}`, concept: `c${i}` }),
    );
    const many = buildGenerateExamQuestionsPrompt({
      pageTitle: "T",
      pageText: "x",
      count: 10,
      existing,
    });
    expect(many.prompt).not.toContain("- [c4] Pregunta 4\n");
    expect(many.prompt).toContain("- [c5] Pregunta 5\n");
    expect(many.prompt).toContain(`- [c${MAX_EXISTING_QUESTIONS + 4}]`);
  });

  it("uses a generation temperature of at most 0.7", () => {
    expect(built.temperature).toBeLessThanOrEqual(0.7);
  });
});
