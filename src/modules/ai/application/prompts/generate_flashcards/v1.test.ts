import { describe, expect, it } from "vitest";
import {
  buildGenerateFlashcardsPrompt,
  GENERATE_FLASHCARDS_PROMPT_VERSION,
} from "./v1";

describe("generate_flashcards/v1 prompt", () => {
  const built = buildGenerateFlashcardsPrompt({
    pageTitle: "Mitosis",
    pageText: "La mitosis tiene cuatro fases.",
    count: 7,
  });

  it("exposes its version", () => {
    expect(GENERATE_FLASHCARDS_PROMPT_VERSION).toBe("generate_flashcards/v1");
  });

  it("embeds the page title and text in the prompt", () => {
    expect(built.prompt).toContain("Mitosis");
    expect(built.prompt).toContain("La mitosis tiene cuatro fases.");
  });

  it("asks for exactly the requested number of cards", () => {
    expect(built.system).toContain("exactly 7");
    expect(built.prompt).toContain("7");
  });

  it("instructs Spanish output derived strictly from the text", () => {
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/only (on )?the (provided )?text|strictly/i);
  });

  it("uses a generation temperature of at most 0.7", () => {
    expect(built.temperature).toBeLessThanOrEqual(0.7);
  });
});
