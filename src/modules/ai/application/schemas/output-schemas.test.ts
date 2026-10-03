import { describe, expect, it } from "vitest";
import type { AiPurpose } from "../../domain/purpose";
import {
  examQuestionsOutput,
  examVariantsOutput,
  flashcardsOutput,
  outputSchemaFor,
  recallEvaluationOutput,
  recallQuestionsOutput,
  sessionFeedbackOutput,
} from "./output-schemas";

const options = ["a", "b", "c", "d"];

describe("flashcardsOutput", () => {
  it("accepts cards and trims their text", () => {
    const parsed = flashcardsOutput.parse({
      cards: [{ front: "  Q ", back: " A  " }],
    });
    expect(parsed.cards[0]).toEqual({ front: "Q", back: "A" });
  });

  it("rejects an empty deck", () => {
    expect(flashcardsOutput.safeParse({ cards: [] }).success).toBe(false);
  });

  it("rejects a blank side", () => {
    expect(
      flashcardsOutput.safeParse({ cards: [{ front: "  ", back: "A" }] })
        .success,
    ).toBe(false);
  });
});

describe("examQuestionsOutput", () => {
  const question = {
    stem: "Which one?",
    options,
    correctIndex: 2,
    explanation: "Because.",
    concept: "Concept",
  };

  it("accepts a valid question", () => {
    expect(
      examQuestionsOutput.safeParse({ questions: [question] }).success,
    ).toBe(true);
  });

  it("rejects three options", () => {
    const bad = { ...question, options: ["a", "b", "c"] };
    expect(examQuestionsOutput.safeParse({ questions: [bad] }).success).toBe(
      false,
    );
  });

  it("rejects correctIndex 4", () => {
    const bad = { ...question, correctIndex: 4 };
    expect(examQuestionsOutput.safeParse({ questions: [bad] }).success).toBe(
      false,
    );
  });

  it("rejects a missing concept", () => {
    const { concept: _, ...bad } = question;
    expect(examQuestionsOutput.safeParse({ questions: [bad] }).success).toBe(
      false,
    );
  });
});

describe("examVariantsOutput", () => {
  const variant = {
    forRootId: "root-1",
    stem: "Rephrased?",
    options,
    correctIndex: 0,
    explanation: "Because.",
  };

  it("accepts a valid variant", () => {
    expect(examVariantsOutput.safeParse({ variants: [variant] }).success).toBe(
      true,
    );
  });

  it("rejects correctIndex -1", () => {
    expect(
      examVariantsOutput.safeParse({
        variants: [{ ...variant, correctIndex: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe("recallQuestionsOutput", () => {
  const question = {
    prompt: "Explain X",
    rubric: { keyConcepts: ["x"], acceptableAnswerSummary: "X is Y." },
  };

  it("accepts a question with a rubric", () => {
    expect(
      recallQuestionsOutput.safeParse({ questions: [question] }).success,
    ).toBe(true);
  });

  it("rejects a question without a rubric", () => {
    expect(
      recallQuestionsOutput.safeParse({ questions: [{ prompt: "Explain X" }] })
        .success,
    ).toBe(false);
  });
});

describe("recallEvaluationOutput", () => {
  const evaluation = {
    score: 4,
    presentConcepts: ["a"],
    missingConcepts: [],
    misconceptions: [],
    justification: "Good.",
  };

  it("accepts a score from 0 to 5", () => {
    expect(recallEvaluationOutput.safeParse(evaluation).success).toBe(true);
    expect(
      recallEvaluationOutput.safeParse({ ...evaluation, score: 0 }).success,
    ).toBe(true);
  });

  it("rejects score 6", () => {
    expect(
      recallEvaluationOutput.safeParse({ ...evaluation, score: 6 }).success,
    ).toBe(false);
  });

  it("rejects a fractional score", () => {
    expect(
      recallEvaluationOutput.safeParse({ ...evaluation, score: 3.5 }).success,
    ).toBe(false);
  });
});

describe("sessionFeedbackOutput", () => {
  it("accepts feedback and rejects a missing summary", () => {
    const feedback = {
      summary: "Well done",
      strengths: ["a"],
      toReinforce: ["b"],
      nextStepSuggestion: "Review b",
    };
    expect(sessionFeedbackOutput.safeParse(feedback).success).toBe(true);
    const { summary: _, ...bad } = feedback;
    expect(sessionFeedbackOutput.safeParse(bad).success).toBe(false);
  });
});

describe("outputSchemaFor", () => {
  it("maps every purpose to its schema", () => {
    const expected: Record<AiPurpose, unknown> = {
      generate_flashcards: flashcardsOutput,
      generate_exam_questions: examQuestionsOutput,
      generate_exam_variants: examVariantsOutput,
      generate_recall_questions: recallQuestionsOutput,
      evaluate_recall_answer: recallEvaluationOutput,
      session_feedback: sessionFeedbackOutput,
    };
    for (const [purpose, schema] of Object.entries(expected)) {
      expect(outputSchemaFor(purpose as AiPurpose)).toBe(schema);
    }
  });
});
