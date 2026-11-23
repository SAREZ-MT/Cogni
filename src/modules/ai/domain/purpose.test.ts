import { describe, expect, it } from "vitest";
import { AI_BUDGET_GROUPS, AI_PURPOSES, budgetGroupOf } from "./purpose";

describe("budgetGroupOf", () => {
  it("charges every generation purpose to the generation budget", () => {
    for (const purpose of [
      "generate_flashcards",
      "generate_exam_questions",
      "generate_exam_variants",
      "generate_recall_questions",
    ] as const) {
      expect(budgetGroupOf(purpose)).toBe("generation");
    }
  });

  it("keeps evaluation and feedback in their own budgets", () => {
    expect(budgetGroupOf("evaluate_recall_answer")).toBe("evaluation");
    expect(budgetGroupOf("session_feedback")).toBe("feedback");
  });

  it("maps every purpose to a known group", () => {
    for (const purpose of AI_PURPOSES) {
      expect(AI_BUDGET_GROUPS).toContain(budgetGroupOf(purpose));
    }
  });
});
