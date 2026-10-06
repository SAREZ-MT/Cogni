import { describe, expect, it } from "vitest";
import { RECALL_ERROR } from "./errors";
import { type NewRecallQuestion, newRecallQuestion } from "./recall-question";

const now = new Date("2026-10-06T10:00:00.000Z");

const aiQuestion: NewRecallQuestion = {
  id: "rq-1",
  ownerId: "owner-1",
  pageId: "page-1",
  prompt: "  Explica la fotosíntesis.  ",
  rubric: {
    keyConcepts: ["  clorofila ", "luz"],
    acceptableAnswerSummary: "  Las plantas convierten luz en energía. ",
  },
  origin: "ai",
  generationId: "gen-1",
};

function expectErrorCode(
  result: { ok: boolean; error?: { code: string } },
  code: string,
) {
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe(code);
}

describe("newRecallQuestion", () => {
  it("creates an active question with trimmed prompt and rubric", () => {
    const result = newRecallQuestion(aiQuestion, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      id: "rq-1",
      ownerId: "owner-1",
      pageId: "page-1",
      prompt: "Explica la fotosíntesis.",
      rubric: {
        keyConcepts: ["clorofila", "luz"],
        acceptableAnswerSummary: "Las plantas convierten luz en energía.",
      },
      origin: "ai",
      generationId: "gen-1",
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("accepts a manual question without a generation id", () => {
    const result = newRecallQuestion(
      { ...aiQuestion, origin: "manual", generationId: null },
      now,
    );

    expect(result.ok).toBe(true);
  });

  it("does not share the caller's key concept array", () => {
    const keyConcepts = ["a concept"];
    const result = newRecallQuestion(
      { ...aiQuestion, rubric: { ...aiQuestion.rubric, keyConcepts } },
      now,
    );
    keyConcepts.push("mutated");

    expect(result.ok && result.value.rubric.keyConcepts).toEqual(["a concept"]);
  });

  it.each([
    ["a blank prompt", { prompt: "   " }],
    ["no key concepts", { rubric: { ...aiQuestion.rubric, keyConcepts: [] } }],
    [
      "a blank key concept",
      { rubric: { ...aiQuestion.rubric, keyConcepts: ["luz", "  "] } },
    ],
    [
      "a blank answer summary",
      { rubric: { ...aiQuestion.rubric, acceptableAnswerSummary: " " } },
    ],
    ["an AI question without a generation id", { generationId: null }],
    [
      "a manual question with a generation id",
      { origin: "manual" as const, generationId: "gen-1" },
    ],
  ])("refuses %s", (_label, overrides) => {
    expectErrorCode(
      newRecallQuestion({ ...aiQuestion, ...overrides }, now),
      RECALL_ERROR.INVALID_QUESTION,
    );
  });
});
