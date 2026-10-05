import { describe, expect, it } from "vitest";
import { EXAM_ERROR } from "./errors";
import {
  type ExamQuestion,
  editExamQuestion,
  MAX_CONCEPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_STEM_LENGTH,
  type NewExamQuestion,
  newExamQuestion,
  newVariant,
  retireExamQuestion,
} from "./exam-question";

const now = new Date("2026-10-05T10:00:00.000Z");
const later = new Date("2026-10-06T10:00:00.000Z");

const manual: NewExamQuestion = {
  id: "q-1",
  ownerId: "owner-1",
  pageId: "page-1",
  stem: "  ¿Qué organelo produce ATP?  ",
  options: [" Mitocondria ", "Ribosoma", "Lisosoma", "Núcleo"],
  correctIndex: 0,
  explanation: "  La mitocondria realiza la respiración celular. ",
  concept: "  Mitocondria  ",
  origin: "manual",
  generationId: null,
};

function createdQuestion(overrides: Partial<NewExamQuestion> = {}) {
  const result = newExamQuestion({ ...manual, ...overrides }, now);
  if (!result.ok) throw result.error;
  return result.value;
}

function expectErrorCode(
  result: { ok: boolean; error?: { code: string } },
  code: string,
) {
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe(code);
}

describe("newExamQuestion", () => {
  it("creates an original question that is its own root", () => {
    const result = newExamQuestion(manual, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      id: "q-1",
      ownerId: "owner-1",
      pageId: "page-1",
      stem: "¿Qué organelo produce ATP?",
      options: ["Mitocondria", "Ribosoma", "Lisosoma", "Núcleo"],
      correctIndex: 0,
      explanation: "La mitocondria realiza la respiración celular.",
      concept: "Mitocondria",
      rootId: "q-1",
      variantOf: null,
      origin: "manual",
      generationId: null,
      createdAt: now,
      updatedAt: now,
      retiredAt: null,
    });
  });

  it("accepts an AI question linked to its generation", () => {
    const question = createdQuestion({ origin: "ai", generationId: "gen-1" });

    expect(question.origin).toBe("ai");
    expect(question.generationId).toBe("gen-1");
  });

  it("accepts an empty explanation", () => {
    expect(createdQuestion({ explanation: "   " }).explanation).toBe("");
  });

  it.each([
    ["a blank stem", { stem: "  " }],
    ["a stem over the limit", { stem: "x".repeat(MAX_STEM_LENGTH + 1) }],
    ["three options", { options: ["a", "b", "c"] }],
    ["five options", { options: ["a", "b", "c", "d", "e"] }],
    ["a blank option", { options: ["a", " ", "c", "d"] }],
    [
      "an option over the limit",
      { options: ["a", "b", "c", "x".repeat(MAX_OPTION_LENGTH + 1)] },
    ],
    ["duplicated options", { options: ["Sí", "No", " sí ", "Tal vez"] }],
    ["a negative correct index", { correctIndex: -1 }],
    ["a correct index past the options", { correctIndex: 4 }],
    ["a fractional correct index", { correctIndex: 1.5 }],
    [
      "an explanation over the limit",
      { explanation: "x".repeat(MAX_EXPLANATION_LENGTH + 1) },
    ],
    ["a blank concept", { concept: "" }],
    [
      "a concept over the limit",
      { concept: "x".repeat(MAX_CONCEPT_LENGTH + 1) },
    ],
    [
      "an AI question without a generation",
      { origin: "ai", generationId: null },
    ],
    ["a manual question with a generation", { generationId: "gen-1" }],
  ] as const)("rejects %s", (_label, overrides) => {
    const result = newExamQuestion(
      { ...manual, ...(overrides as Partial<NewExamQuestion>) },
      now,
    );

    expectErrorCode(result, EXAM_ERROR.INVALID_QUESTION);
  });

  it("accepts every field exactly at its limit", () => {
    const question = createdQuestion({
      stem: "s".repeat(MAX_STEM_LENGTH),
      options: ["a", "b", "c", "o".repeat(MAX_OPTION_LENGTH)],
      correctIndex: 3,
      explanation: "e".repeat(MAX_EXPLANATION_LENGTH),
      concept: "c".repeat(MAX_CONCEPT_LENGTH),
    });

    expect(question.correctIndex).toBe(3);
  });
});

describe("newVariant", () => {
  const variantInput = {
    id: "q-2",
    stem: "¿Dónde ocurre la respiración celular?",
    options: ["Ribosoma", "Mitocondria", "Aparato de Golgi", "Vacuola"],
    correctIndex: 1,
    explanation: "Ocurre en la mitocondria.",
    generationId: "gen-2",
  };

  it("keeps the root, the concept and the owner, and points at the replaced question", () => {
    const original = createdQuestion();

    const result = newVariant(original, [], variantInput, later);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: "q-2",
      ownerId: "owner-1",
      pageId: "page-1",
      rootId: "q-1",
      variantOf: "q-1",
      concept: "Mitocondria",
      origin: "ai_variant",
      generationId: "gen-2",
      correctIndex: 1,
      createdAt: later,
      updatedAt: later,
      retiredAt: null,
    });
  });

  it("keeps the original root across a chain of variants", () => {
    const original = createdQuestion();
    const first = newVariant(original, [], variantInput, later);
    if (!first.ok) throw first.error;

    const second = newVariant(
      first.value,
      [original],
      { ...variantInput, id: "q-3", stem: "¿Qué orgánulo tiene crestas?" },
      later,
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.rootId).toBe("q-1");
    expect(second.value.variantOf).toBe("q-2");
  });

  it("refuses the wording of the replaced question, ignoring case and spaces", () => {
    const original = createdQuestion();

    const result = newVariant(
      original,
      [],
      { ...variantInput, stem: "  ¿QUÉ   organelo produce atp? " },
      later,
    );

    expectErrorCode(result, EXAM_ERROR.VARIANT_SAME_WORDING);
  });

  describe("across a chain original → v1 → v2", () => {
    function firstVariant(original: ExamQuestion) {
      const result = newVariant(original, [original], variantInput, later);
      if (!result.ok) throw result.error;
      return result.value;
    }

    it.each([
      ["the exact original wording", "¿Qué organelo produce ATP?"],
      ["a different case", "¿qué ORGANELO produce atp?"],
      ["extra spaces", "  ¿Qué   organelo\tproduce ATP?  "],
      ["no question marks", "Qué organelo produce ATP"],
      ["other trailing punctuation", "¿Qué organelo produce ATP?..."],
    ])("refuses %s in v2", (_label, stem) => {
      const original = createdQuestion();
      const v1 = firstVariant(original);

      const result = newVariant(
        v1,
        [original, v1],
        { ...variantInput, id: "q-3", stem },
        later,
      );

      expectErrorCode(result, EXAM_ERROR.VARIANT_SAME_WORDING);
    });

    it("refuses the original wording even when the lineage omits the replaced question", () => {
      const original = createdQuestion();
      const v1 = firstVariant(original);

      const result = newVariant(
        v1,
        [original],
        { ...variantInput, id: "q-3", stem: "¿Qué organelo produce ATP" },
        later,
      );

      expectErrorCode(result, EXAM_ERROR.VARIANT_SAME_WORDING);
    });

    it("refuses a lineage holding a question of another root", () => {
      const original = createdQuestion();
      const other = createdQuestion({ id: "q-9", stem: "¿Otra pregunta?" });

      const result = newVariant(
        original,
        [original, other],
        variantInput,
        later,
      );

      expectErrorCode(result, EXAM_ERROR.INVALID_QUESTION);
    });
  });

  it("refuses to vary a retired question", () => {
    const retired = retireExamQuestion(createdQuestion(), later);
    if (!retired.ok) throw retired.error;

    expectErrorCode(
      newVariant(retired.value, [], variantInput, later),
      EXAM_ERROR.QUESTION_RETIRED,
    );
  });

  it("validates the variant like any question", () => {
    expectErrorCode(
      newVariant(
        createdQuestion(),
        [],
        { ...variantInput, correctIndex: 7 },
        later,
      ),
      EXAM_ERROR.INVALID_QUESTION,
    );
  });
});

describe("editExamQuestion", () => {
  it("changes the question in place and keeps its identity and root", () => {
    const original = createdQuestion({ origin: "ai", generationId: "gen-1" });

    const result = editExamQuestion(
      original,
      {
        stem: " ¿Qué produce ATP? ",
        options: ["Mitocondria", "Cloroplasto", "Ribosoma", "Centriolo"],
        correctIndex: 0,
        explanation: "Respiración celular.",
        concept: "ATP",
      },
      later,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edited: ExamQuestion = result.value;
    expect(edited).toMatchObject({
      id: "q-1",
      rootId: "q-1",
      variantOf: null,
      origin: "ai",
      generationId: "gen-1",
      stem: "¿Qué produce ATP?",
      concept: "ATP",
      createdAt: now,
      updatedAt: later,
    });
  });

  it("keeps every field the patch leaves out", () => {
    const original = createdQuestion();

    const result = editExamQuestion(original, { correctIndex: 2 }, later);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      ...original,
      correctIndex: 2,
      updatedAt: later,
    });
  });

  it("validates the edited question", () => {
    expectErrorCode(
      editExamQuestion(createdQuestion(), { stem: "" }, later),
      EXAM_ERROR.INVALID_QUESTION,
    );
  });

  it("refuses to edit a retired question", () => {
    const retired = retireExamQuestion(createdQuestion(), later);
    if (!retired.ok) throw retired.error;

    expectErrorCode(
      editExamQuestion(retired.value, { concept: "Otro" }, later),
      EXAM_ERROR.QUESTION_RETIRED,
    );
  });
});

describe("retireExamQuestion", () => {
  it("stamps retiredAt and updatedAt", () => {
    const result = retireExamQuestion(createdQuestion(), later);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.retiredAt).toEqual(later);
    expect(result.value.updatedAt).toEqual(later);
  });

  it("refuses to retire a question twice", () => {
    const retired = retireExamQuestion(createdQuestion(), later);
    if (!retired.ok) throw retired.error;

    expectErrorCode(
      retireExamQuestion(retired.value, later),
      EXAM_ERROR.QUESTION_RETIRED,
    );
  });
});
