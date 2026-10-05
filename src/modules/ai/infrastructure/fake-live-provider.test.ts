import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { buildGenerateExamQuestionsPrompt } from "../application/prompts/generate_exam_questions/v1";
import { buildGenerateFlashcardsPrompt } from "../application/prompts/generate_flashcards/v1";
import {
  examQuestionsOutput,
  examVariantsOutput,
  flashcardsOutput,
  recallEvaluationOutput,
  recallQuestionsOutput,
  sessionFeedbackOutput,
} from "../application/schemas";
import { createFakeLiveProvider } from "./fake-live-provider";

const TEXT =
  "La mitocondria produce energía para la célula. El núcleo guarda el ADN. " +
  "Los ribosomas sintetizan proteínas. El aparato de Golgi empaqueta moléculas.";

function flashcardsRequest(count: number, pageText = TEXT) {
  const built = buildGenerateFlashcardsPrompt({
    pageTitle: "Célula",
    pageText,
    count,
  });
  return { schema: flashcardsOutput, ...built };
}

function examRequest(
  count: number,
  existing: { stem: string; concept: string }[] = [],
  pageText = TEXT,
) {
  const built = buildGenerateExamQuestionsPrompt({
    pageTitle: "Célula",
    pageText,
    count,
    existing,
  });
  return { schema: examQuestionsOutput, ...built };
}

// Same comparison the exams domain applies to stems and options.
function normalized(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s¿¡]+/, "")
    .replace(/[\s.,;:!?…]+$/, "")
    .toLocaleLowerCase();
}

describe("createFakeLiveProvider", () => {
  it("identifies itself as fake", () => {
    const provider = createFakeLiveProvider();
    expect(provider.id).toBe("fake");
    expect(provider.model).toBe("fake-model");
  });

  it("derives schema-valid cards from the sentences of the prompt", async () => {
    const response = await createFakeLiveProvider().generateObject(
      flashcardsRequest(3),
    );
    const parsed = flashcardsOutput.parse(response.object);
    expect(parsed.cards).toHaveLength(3);
    expect(parsed.cards[0]).toEqual({
      front: "¿Qué dice el texto sobre «La mitocondria produce energía»?",
      back: "La mitocondria produce energía para la célula.",
    });
    expect(response.usage.inputTokens).toBeGreaterThan(0);
    expect(response.usage.outputTokens).toBeGreaterThan(0);
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", async () => {
    const provider = createFakeLiveProvider();
    const a = await provider.generateObject(flashcardsRequest(2));
    const b = await provider.generateObject(flashcardsRequest(2));
    expect(a.object).toEqual(b.object);
  });

  it("never returns zero cards, even for a one-word or empty text", async () => {
    const provider = createFakeLiveProvider();
    for (const text of ["Hola", "   "]) {
      const response = await provider.generateObject(
        flashcardsRequest(4, text),
      );
      expect(
        flashcardsOutput.parse(response.object).cards.length,
      ).toBeGreaterThan(0);
    }
  });

  it("derives exactly `count` distinct, valid exam questions from the prompt, even past the number of sentences", async () => {
    const response = await createFakeLiveProvider().generateObject(
      examRequest(10),
    );
    const { questions } = examQuestionsOutput.parse(response.object);

    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((q) => normalized(q.stem))).size).toBe(10);
    for (const question of questions) {
      expect(new Set(question.options.map(normalized)).size).toBe(4);
      expect(question.concept.length).toBeLessThanOrEqual(120);
    }
    // The correct option is the page sentence the question is about.
    expect(questions[0]?.options[questions[0].correctIndex]).toBe(
      "La mitocondria produce energía para la célula.",
    );
    expect(new Set(questions.map((q) => q.correctIndex)).size).toBe(4);
  });

  it("never repeats a stem listed as an existing question", async () => {
    const provider = createFakeLiveProvider();
    const first = examQuestionsOutput.parse(
      (await provider.generateObject(examRequest(10))).object,
    ).questions;

    const second = examQuestionsOutput.parse(
      (await provider.generateObject(examRequest(10, first))).object,
    ).questions;

    const seen = new Set(first.map((q) => normalized(q.stem)));
    expect(second).toHaveLength(10);
    expect(second.some((q) => seen.has(normalized(q.stem)))).toBe(false);
  });

  it("still returns questions for a blank page text", async () => {
    const response = await createFakeLiveProvider().generateObject(
      examRequest(10, [], "   "),
    );
    expect(examQuestionsOutput.parse(response.object).questions).toHaveLength(
      10,
    );
  });

  it("returns a schema-valid minimal object for the other purposes", async () => {
    const provider = createFakeLiveProvider();
    const base = { system: "s", prompt: "p", temperature: 0.2 };
    const schemas: ZodType<unknown>[] = [
      examQuestionsOutput,
      examVariantsOutput,
      recallQuestionsOutput,
      recallEvaluationOutput,
      sessionFeedbackOutput,
    ];
    for (const schema of schemas) {
      const response = await provider.generateObject({ ...base, schema });
      expect(schema.safeParse(response.object).success).toBe(true);
    }
  });
});
