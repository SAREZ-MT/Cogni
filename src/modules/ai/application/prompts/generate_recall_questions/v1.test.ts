import { describe, expect, it } from "vitest";
import {
  buildGenerateRecallQuestionsPrompt,
  GENERATE_RECALL_QUESTIONS_PROMPT_VERSION,
  MAX_EXISTING_RECALL_QUESTIONS,
} from "./v1";

describe("generate_recall_questions/v1 prompt", () => {
  const built = buildGenerateRecallQuestionsPrompt({
    pageTitle: "Mitocondria",
    pageText: "La mitocondria produce ATP.",
    count: 10,
    existing: [
      { prompt: "¿Qué función\n cumple la mitocondria?" },
      { prompt: "Explica dónde está el ADN." },
    ],
  });

  it("exposes its version", () => {
    expect(GENERATE_RECALL_QUESTIONS_PROMPT_VERSION).toBe(
      "generate_recall_questions/v1",
    );
  });

  it("starts with the page title and the count header, with the text last", () => {
    const [title, count] = built.prompt.split("\n");
    expect(title).toBe("Page title: Mitocondria");
    expect(count).toBe("Number of questions: 10");
    expect(built.prompt.endsWith("Text:\nLa mitocondria produce ATP.")).toBe(
      true,
    );
  });

  it("asks for exactly the requested number of questions", () => {
    expect(built.system).toContain("exactly 10");
  });

  it("asks for open questions that require recall or explanation, never yes/no", () => {
    expect(built.system).toMatch(/open questions/i);
    expect(built.system).toMatch(/explain/i);
    expect(built.system).toMatch(/yes\/no/i);
  });

  it("asks for a rubric of 2 to 6 key concepts and an acceptable answer summary", () => {
    expect(built.system).toContain("rubric");
    expect(built.system).toContain("2 to 6 key concepts");
    expect(built.system).toMatch(/acceptable answer summary/i);
  });

  it("instructs Spanish output drawn strictly from the text", () => {
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/strictly/i);
    expect(built.system).toMatch(/only from the provided text/i);
  });

  it("lists the existing questions on one line each so the model avoids duplicates", () => {
    expect(built.system).toMatch(/existing questions/i);
    expect(built.prompt).toContain(
      "Existing questions:\n- ¿Qué función cumple la mitocondria?\n- Explica dónde está el ADN.",
    );
  });

  it("says there are no existing questions when the page has none", () => {
    const empty = buildGenerateRecallQuestionsPrompt({
      pageTitle: "T",
      pageText: "x",
      count: 10,
      existing: [],
    });
    expect(empty.prompt).toContain("Existing questions: none");
  });

  it("keeps only the most recent existing questions when there are too many", () => {
    const existing = Array.from(
      { length: MAX_EXISTING_RECALL_QUESTIONS + 5 },
      (_, i) => ({ prompt: `Pregunta ${i}` }),
    );
    const many = buildGenerateRecallQuestionsPrompt({
      pageTitle: "T",
      pageText: "x",
      count: 10,
      existing,
    });
    expect(many.prompt).not.toContain("- Pregunta 4\n");
    expect(many.prompt).toContain("- Pregunta 5\n");
    expect(many.prompt).toContain(
      `- Pregunta ${MAX_EXISTING_RECALL_QUESTIONS + 4}`,
    );
  });

  it("uses a generation temperature of at most 0.7", () => {
    expect(built.temperature).toBeLessThanOrEqual(0.7);
  });
});
