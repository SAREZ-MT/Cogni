import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
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
