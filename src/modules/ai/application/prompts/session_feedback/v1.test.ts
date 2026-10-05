import { describe, expect, it } from "vitest";
import {
  buildSessionFeedbackPrompt,
  MAX_STRUGGLED_ITEM_LENGTH,
  MAX_STRUGGLED_ITEMS,
  SESSION_FEEDBACK_PROMPT_VERSION,
} from "./v1";

const base = {
  technique: "flashcards" as const,
  reviewedCount: 6,
  counts: { again: 1, hard: 2, good: 2, easy: 1 },
  struggled: ["¿Qué produce la mitocondria?", "¿Qué es la mitosis?"],
};

describe("session_feedback/v1 prompt", () => {
  const built = buildSessionFeedbackPrompt(base);

  it("exposes its version", () => {
    expect(SESSION_FEEDBACK_PROMPT_VERSION).toBe("session_feedback/v1");
  });

  it("embeds the session results per answer", () => {
    expect(built.prompt).toContain("Technique: flashcards");
    expect(built.prompt).toContain("Items reviewed: 6");
    expect(built.prompt).toContain("Again: 1");
    expect(built.prompt).toContain("Hard: 2");
    expect(built.prompt).toContain("Good: 2");
    expect(built.prompt).toContain("Easy: 1");
  });

  it("lists the items the student struggled with", () => {
    expect(built.prompt).toContain("- ¿Qué produce la mitocondria?");
    expect(built.prompt).toContain("- ¿Qué es la mitosis?");
  });

  it("says so when nothing was hard", () => {
    const easy = buildSessionFeedbackPrompt({ ...base, struggled: [] });
    expect(easy.prompt).toContain("(none)");
  });

  it("keeps at most the first struggled items, each one shortened", () => {
    const long = "x".repeat(MAX_STRUGGLED_ITEM_LENGTH + 50);
    const many = Array.from(
      { length: MAX_STRUGGLED_ITEMS + 3 },
      (_, i) => `${i}-${long}`,
    );
    const capped = buildSessionFeedbackPrompt({ ...base, struggled: many });
    const lines = capped.prompt
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(lines).toHaveLength(MAX_STRUGGLED_ITEMS);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(MAX_STRUGGLED_ITEM_LENGTH + 3);
    }
  });

  it("instructs Spanish, encouraging output without time or invented facts", () => {
    expect(built.system).toContain("Spanish");
    expect(built.system).toMatch(/never mention study time/i);
    expect(built.system).toMatch(/do not invent/i);
  });

  it("uses an evaluation temperature of at most 0.3", () => {
    expect(built.temperature).toBeLessThanOrEqual(0.3);
  });
});
