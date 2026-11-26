import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AiPurpose } from "../../domain/purpose";
import {
  examQuestionsOutput,
  examVariantsOutput,
  flashcardsOutput,
  MAX_EVALUATED_ANSWERS,
  MAX_OUTPUT_CONCEPT_LENGTH,
  MAX_OUTPUT_CONCEPTS,
  MAX_OUTPUT_LIST_ITEMS,
  MAX_OUTPUT_TEXT_LENGTH,
  outputSchemaFor,
  providerSchemaFor,
  purposeOfSchema,
  recallEvaluationOutput,
  recallEvaluationsOutput,
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

describe("recallEvaluationsOutput", () => {
  const evaluation = {
    questionId: "q1",
    score: 4,
    presentConcepts: ["a"],
    missingConcepts: [],
    misconceptions: [],
    justification: "Good.",
  };

  it("accepts one evaluation per answer keyed by a question id", () => {
    expect(
      recallEvaluationsOutput.safeParse({
        evaluations: [evaluation, { ...evaluation, questionId: "q2" }],
      }).success,
    ).toBe(true);
  });

  it("rejects an evaluation without a question id or with a bad score", () => {
    const { questionId: _, ...noId } = evaluation;
    for (const bad of [noId, { ...evaluation, score: 6 }]) {
      expect(
        recallEvaluationsOutput.safeParse({ evaluations: [bad] }).success,
      ).toBe(false);
    }
  });

  it("caps the list at MAX_EVALUATED_ANSWERS, one recall session", () => {
    expect(MAX_EVALUATED_ANSWERS).toBe(10);
    const many = Array.from({ length: MAX_EVALUATED_ANSWERS + 1 }, (_, i) => ({
      ...evaluation,
      questionId: `q${i + 1}`,
    }));
    expect(
      recallEvaluationsOutput.safeParse({ evaluations: many }).success,
    ).toBe(false);
    expect(recallEvaluationsOutput.safeParse({ evaluations: [] }).success).toBe(
      false,
    );
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

// S2: an answer cannot make the model return unbounded text or lists.
describe("output size caps", () => {
  const evaluation = {
    score: 4,
    presentConcepts: ["a"],
    missingConcepts: [],
    misconceptions: [],
    justification: "Good.",
  };
  const feedback = {
    summary: "Well done",
    strengths: ["a"],
    toReinforce: ["b"],
    nextStepSuggestion: "Review b",
  };
  const longText = "x".repeat(MAX_OUTPUT_TEXT_LENGTH + 1);
  const longConcept = "x".repeat(MAX_OUTPUT_CONCEPT_LENGTH + 1);
  const manyConcepts = Array.from(
    { length: MAX_OUTPUT_CONCEPTS + 1 },
    (_, i) => `c${i}`,
  );
  const manyItems = Array.from(
    { length: MAX_OUTPUT_LIST_ITEMS + 1 },
    (_, i) => `i${i}`,
  );

  it("accepts an evaluation that copies the largest manual rubric (30 concepts of 500 characters)", () => {
    const rubric = Array.from({ length: 30 }, (_, i) =>
      `${i}`.padEnd(500, "x"),
    );
    expect(
      recallEvaluationOutput.safeParse({
        ...evaluation,
        presentConcepts: rubric,
        missingConcepts: rubric,
      }).success,
    ).toBe(true);
  });

  it("accepts an evaluation at the caps", () => {
    expect(
      recallEvaluationOutput.safeParse({
        ...evaluation,
        presentConcepts: manyConcepts.slice(1),
        misconceptions: manyItems.slice(1),
        justification: longText.slice(1),
      }).success,
    ).toBe(true);
  });

  it.each([
    ["too many present concepts", { presentConcepts: manyConcepts }],
    ["too many missing concepts", { missingConcepts: manyConcepts }],
    ["an overlong concept", { presentConcepts: [longConcept] }],
    ["too many misconceptions", { misconceptions: manyItems }],
    ["an overlong justification", { justification: longText }],
  ])("rejects an evaluation with %s", (_, override) => {
    expect(
      recallEvaluationOutput.safeParse({ ...evaluation, ...override }).success,
    ).toBe(false);
  });

  it.each([
    ["too many key concepts", { keyConcepts: manyConcepts }],
    ["an overlong key concept", { keyConcepts: [longConcept] }],
    ["an overlong answer summary", { acceptableAnswerSummary: longText }],
  ])("rejects a recall question whose rubric has %s", (_, override) => {
    const rubric = { keyConcepts: ["x"], acceptableAnswerSummary: "X is Y." };
    expect(
      recallQuestionsOutput.safeParse({
        questions: [
          { prompt: "Explain X", rubric: { ...rubric, ...override } },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["an overlong summary", { summary: longText }],
    ["too many strengths", { strengths: manyItems }],
    ["too many items to reinforce", { toReinforce: manyItems }],
    ["an overlong next step", { nextStepSuggestion: longText }],
  ])("rejects feedback with %s", (_, override) => {
    expect(
      sessionFeedbackOutput.safeParse({ ...feedback, ...override }).success,
    ).toBe(false);
  });
});

// The caps are checked on the answer, never sent to the provider: Gemini
// refuses the capped evaluation schema ("too many states for serving").
describe("providerSchemaFor", () => {
  const sizeCaps = (purpose: AiPurpose) =>
    JSON.stringify(z.toJSONSchema(providerSchemaFor(purpose))).match(
      /"(maxLength|maxItems)":(\d+)/g,
    ) ?? [];

  it("sends the recall evaluation without the size caps of its texts and lists", () => {
    expect(sizeCaps("evaluate_recall_answer")).toEqual([
      `"maxItems":${MAX_EVALUATED_ANSWERS}`,
    ]);
  });

  it("sends recall questions and session feedback without size caps", () => {
    expect(sizeCaps("generate_recall_questions")).toEqual([]);
    expect(sizeCaps("session_feedback")).toEqual([]);
  });

  it("keeps the shape of the validated schema", () => {
    const evaluations = {
      evaluations: [
        {
          questionId: "q1",
          score: 4,
          presentConcepts: ["a"],
          missingConcepts: [],
          misconceptions: [],
          justification: "Good.",
        },
      ],
    };
    expect(
      providerSchemaFor("evaluate_recall_answer").safeParse(evaluations)
        .success,
    ).toBe(true);
    expect(
      providerSchemaFor("evaluate_recall_answer").safeParse({
        evaluations: [{ ...evaluations.evaluations[0], score: 9 }],
      }).success,
    ).toBe(false);
  });

  it("is the validated schema for a purpose without size caps", () => {
    expect(providerSchemaFor("generate_flashcards")).toBe(flashcardsOutput);
    expect(providerSchemaFor("generate_exam_questions")).toBe(
      examQuestionsOutput,
    );
  });
});

describe("purposeOfSchema", () => {
  it("names the purpose of a validated schema and of a provider schema", () => {
    expect(purposeOfSchema(recallEvaluationsOutput)).toBe(
      "evaluate_recall_answer",
    );
    expect(purposeOfSchema(providerSchemaFor("evaluate_recall_answer"))).toBe(
      "evaluate_recall_answer",
    );
    expect(purposeOfSchema(providerSchemaFor("session_feedback"))).toBe(
      "session_feedback",
    );
    expect(purposeOfSchema(z.object({}))).toBeNull();
  });
});

describe("outputSchemaFor", () => {
  it("maps every purpose to its schema", () => {
    const expected: Record<AiPurpose, unknown> = {
      generate_flashcards: flashcardsOutput,
      generate_exam_questions: examQuestionsOutput,
      generate_exam_variants: examVariantsOutput,
      generate_recall_questions: recallQuestionsOutput,
      evaluate_recall_answer: recallEvaluationsOutput,
      session_feedback: sessionFeedbackOutput,
    };
    for (const [purpose, schema] of Object.entries(expected)) {
      expect(outputSchemaFor(purpose as AiPurpose)).toBe(schema);
    }
  });
});
