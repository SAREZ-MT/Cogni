import { describe, expect, it } from "vitest";
import {
  buildGenerateExamVariantsPrompt,
  GENERATE_EXAM_VARIANTS_PROMPT_VERSION,
} from "./v1";

describe("generate_exam_variants/v1 prompt", () => {
  const built = buildGenerateExamVariantsPrompt({
    pageTitle: "Mitocondria",
    pageText: "La mitocondria produce ATP.",
    failed: [
      {
        rootId: "root-a",
        concept: "Función de la\n mitocondria",
        previousStems: [
          "¿Qué produce la\n mitocondria?",
          "¿Cuál es el producto?",
        ],
        correctAnswer: "ATP",
        explanation: "La respiración celular\nproduce ATP.",
      },
      {
        rootId: "root-b",
        concept: "ADN",
        previousStems: ["¿Dónde está el ADN?"],
        correctAnswer: "En el núcleo",
        explanation: "El núcleo guarda el ADN.",
      },
    ],
  });

  it("exposes its version", () => {
    expect(GENERATE_EXAM_VARIANTS_PROMPT_VERSION).toBe(
      "generate_exam_variants/v1",
    );
  });

  it("starts with the page title and the number of variants, and ends with the text", () => {
    const [title, count] = built.prompt.split("\n");
    expect(title).toBe("Page title: Mitocondria");
    expect(count).toBe("Number of variants: 2");
    expect(built.prompt.endsWith("Text:\nLa mitocondria produce ATP.")).toBe(
      true,
    );
  });

  it("lists every failed root with its concept, correct answer, explanation and every previous wording on one line each", () => {
    expect(built.prompt).toContain(
      [
        "Failed questions:",
        "Root root-a [Función de la mitocondria]",
        "  Correct answer: ATP",
        "  Explanation: La respiración celular produce ATP.",
        "  Previous wording: ¿Qué produce la mitocondria?",
        "  Previous wording: ¿Cuál es el producto?",
        "Root root-b [ADN]",
        "  Correct answer: En el núcleo",
        "  Explanation: El núcleo guarda el ADN.",
        "  Previous wording: ¿Dónde está el ADN?",
      ].join("\n"),
    );
  });

  it("asks for one reformulated variant per root: same concept, new wording, never a previous one", () => {
    expect(built.system).toMatch(/exactly one variant for each root/i);
    expect(built.system).toContain("forRootId");
    expect(built.system).toMatch(/same concept/i);
    expect(built.system).toMatch(/never reuse.*previous wording/i);
    expect(built.system).toMatch(/another topic/i);
  });

  it("describes the multiple-choice shape and Spanish output from the text only", () => {
    expect(built.system).toContain("4 options");
    expect(built.system).toMatch(/exactly one (is )?correct/i);
    expect(built.system).toContain("explanation");
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/strictly/i);
  });

  it("uses a moderate generation temperature", () => {
    expect(built.temperature).toBeGreaterThan(0);
    expect(built.temperature).toBeLessThanOrEqual(0.7);
  });
});
