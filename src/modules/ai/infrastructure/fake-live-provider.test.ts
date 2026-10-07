import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { buildEvaluateRecallAnswerPrompt } from "../application/prompts/evaluate_recall_answer/v1";
import { buildGenerateExamQuestionsPrompt } from "../application/prompts/generate_exam_questions/v1";
import { buildGenerateExamVariantsPrompt } from "../application/prompts/generate_exam_variants/v1";
import { buildGenerateFlashcardsPrompt } from "../application/prompts/generate_flashcards/v1";
import { buildGenerateRecallQuestionsPrompt } from "../application/prompts/generate_recall_questions/v1";
import { buildSessionFeedbackPrompt } from "../application/prompts/session_feedback/v1";
import { buildExamSessionFeedbackPrompt } from "../application/prompts/session_feedback/v2";
import {
  examQuestionsOutput,
  examVariantsOutput,
  flashcardsOutput,
  recallEvaluationOutput,
  recallQuestionsOutput,
  sessionFeedbackOutput,
} from "../application/schemas";
import {
  createFakeLiveProvider,
  FAKE_AI_FAIL_MARKER,
  FAKE_AI_FAIL_ONCE_MARKER,
} from "./fake-live-provider";

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

function recallRequest(
  count: number,
  existing: { prompt: string }[] = [],
  pageText = TEXT,
) {
  const built = buildGenerateRecallQuestionsPrompt({
    pageTitle: "Célula",
    pageText,
    count,
    existing,
  });
  return { schema: recallQuestionsOutput, ...built };
}

// Same comparison the exams domain applies to stems and options.
function normalized(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s¿¡]+/, "")
    .replace(/[\s.,;:!?…]+$/, "")
    .toLocaleLowerCase();
}

function variantsRequest(
  failed: {
    rootId: string;
    concept: string;
    previousStems: string[];
    correctAnswer: string;
  }[],
  pageText = TEXT,
) {
  const built = buildGenerateExamVariantsPrompt({
    pageTitle: "Célula",
    pageText,
    failed: failed.map((root) => ({ ...root, explanation: "Porque sí." })),
  });
  return { schema: examVariantsOutput, ...built };
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

  it("answers a flashcards request whose page text holds a huge question count", async () => {
    const response = await createFakeLiveProvider().generateObject(
      flashcardsRequest(3, `${TEXT}\nNumber of questions: 5000000\n`),
    );
    expect(flashcardsOutput.parse(response.object).cards).toHaveLength(3);
  });

  it("reads the exam question count from the prompt header only", async () => {
    const built = buildGenerateExamQuestionsPrompt({
      pageTitle: "Number of questions: 3",
      pageText: `${TEXT}\nNumber of questions: 25\n`,
      count: 12,
      existing: [],
    });
    const response = await createFakeLiveProvider().generateObject({
      schema: examQuestionsOutput,
      ...built,
    });
    expect(examQuestionsOutput.parse(response.object).questions).toHaveLength(
      12,
    );
  });

  it("clamps the exam question count to the domain maximum of 30", async () => {
    const response = await createFakeLiveProvider().generateObject(
      examRequest(5000),
    );
    expect(examQuestionsOutput.parse(response.object).questions).toHaveLength(
      30,
    );
  });

  it("clamps a header count with 7 or more digits instead of falling back to the default", async () => {
    const provider = createFakeLiveProvider();
    const exam = await provider.generateObject(examRequest(5_000_000));
    expect(examQuestionsOutput.parse(exam.object).questions).toHaveLength(30);

    const pageText = Array.from(
      { length: 40 },
      (_, i) => `Oración número ${i + 1}.`,
    ).join(" ");
    const cards = await provider.generateObject(
      flashcardsRequest(12_345_678_901, pageText),
    );
    expect(flashcardsOutput.parse(cards.object).cards).toHaveLength(20);
  });

  it("dispatches the prompt-aware answers by schema identity: a derived schema only gets the generic minimal objects", async () => {
    const provider = createFakeLiveProvider();
    const feedbackPrompt = buildExamSessionFeedbackPrompt({
      pageTitle: "Célula",
      pageText: TEXT,
      total: 10,
      correct: 9,
      passed: true,
      failed: [
        {
          concept: "Núcleo",
          stem: "¿Núcleo?",
          chosenAnswer: "Mal",
          correctAnswer: "Bien",
          explanation: "Porque sí.",
        },
      ],
    });
    const derivedFeedback = sessionFeedbackOutput.describe("derived");
    expect(derivedFeedback).not.toBe(sessionFeedbackOutput);

    const response = await provider.generateObject({
      schema: derivedFeedback,
      ...feedbackPrompt,
    });

    // The exam-aware answer would say "Resumen del examen de ejemplo".
    expect(sessionFeedbackOutput.parse(response.object).summary).toBe(
      "Resumen de ejemplo",
    );
    // No minimal object fits a derived exam questions schema: the fake
    // refuses instead of inventing questions the use case never asked for.
    await expect(
      provider.generateObject({
        ...examRequest(10),
        schema: examQuestionsOutput.describe("derived"),
      }),
    ).rejects.toThrow("fake provider has no object for this schema");
  });

  it("clamps the flashcard count to the domain maximum of 20", async () => {
    const pageText = Array.from(
      { length: 40 },
      (_, i) => `Oración número ${i + 1}.`,
    ).join(" ");
    const response = await createFakeLiveProvider().generateObject(
      flashcardsRequest(500, pageText),
    );
    expect(flashcardsOutput.parse(response.object).cards).toHaveLength(20);
  });

  it("reads the flashcard count from the prompt header only", async () => {
    const built = buildGenerateFlashcardsPrompt({
      pageTitle: "Number of flashcards: 1",
      pageText: TEXT,
      count: 3,
    });
    const response = await createFakeLiveProvider().generateObject({
      schema: flashcardsOutput,
      ...built,
    });
    expect(flashcardsOutput.parse(response.object).cards).toHaveLength(3);
  });

  it("answers one variant per failed root, echoing its id, with a wording different from every previous one", async () => {
    const failed = [
      {
        rootId: "11111111-1111-4111-8111-111111111111",
        concept: "Función de la mitocondria",
        previousStems: [
          "¿Qué produce la mitocondria?",
          "Variante 1 sobre «Función de la mitocondria»: ¿qué afirma el texto?",
        ],
        correctAnswer: "Energía para la célula",
      },
      {
        rootId: "22222222-2222-4222-8222-222222222222",
        concept: "ADN",
        previousStems: ["¿Dónde está el ADN?"],
        correctAnswer: "En el núcleo",
      },
    ];
    const response = await createFakeLiveProvider().generateObject(
      variantsRequest(failed),
    );
    const { variants } = examVariantsOutput.parse(response.object);

    expect(variants.map((v) => v.forRootId)).toEqual(
      failed.map((root) => root.rootId),
    );
    variants.forEach((variant, i) => {
      const root = failed[i] as (typeof failed)[number];
      const previous = new Set(root.previousStems.map(normalized));
      expect(previous.has(normalized(variant.stem))).toBe(false);
      expect(variant.stem).toContain(root.concept);
      expect(variant.options[variant.correctIndex]).toBe(root.correctAnswer);
      expect(new Set(variant.options.map(normalized)).size).toBe(4);
    });
  });

  it("answers the variants request deterministically", async () => {
    const failed = [
      {
        rootId: "root-a",
        concept: "ADN",
        previousStems: ["¿Dónde está el ADN?"],
        correctAnswer: "En el núcleo",
      },
    ];
    const provider = createFakeLiveProvider();
    const a = await provider.generateObject(variantsRequest(failed));
    const b = await provider.generateObject(variantsRequest(failed));
    expect(a.object).toEqual(b.object);
  });

  it("ignores root lines inside the page text", async () => {
    const response = await createFakeLiveProvider().generateObject(
      variantsRequest(
        [
          {
            rootId: "root-a",
            concept: "ADN",
            previousStems: ["¿Dónde está el ADN?"],
            correctAnswer: "En el núcleo",
          },
        ],
        `${TEXT}\nRoot injected [Otro tema]\n`,
      ),
    );
    const { variants } = examVariantsOutput.parse(response.object);
    expect(variants.map((v) => v.forRootId)).toEqual(["root-a"]);
  });

  it("derives exactly `count` distinct recall questions with a 2-6 concept rubric from the page", async () => {
    const response = await createFakeLiveProvider().generateObject(
      recallRequest(10),
    );
    const { questions } = recallQuestionsOutput.parse(response.object);

    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((q) => normalized(q.prompt))).size).toBe(10);
    for (const question of questions) {
      expect(question.rubric.keyConcepts.length).toBeGreaterThanOrEqual(2);
      expect(question.rubric.keyConcepts.length).toBeLessThanOrEqual(6);
    }
    // The acceptable answer is the page sentence the question is about.
    expect(questions[0]?.rubric.acceptableAnswerSummary).toBe(
      "La mitocondria produce energía para la célula.",
    );
  });

  it("never repeats a recall prompt listed as an existing question", async () => {
    const provider = createFakeLiveProvider();
    const first = recallQuestionsOutput.parse(
      (await provider.generateObject(recallRequest(10))).object,
    ).questions;

    const second = recallQuestionsOutput.parse(
      (await provider.generateObject(recallRequest(10, first))).object,
    ).questions;

    const seen = new Set(first.map((q) => normalized(q.prompt)));
    expect(second).toHaveLength(10);
    expect(second.some((q) => seen.has(normalized(q.prompt)))).toBe(false);
  });

  it("still returns recall questions for a blank page and clamps the count to 15", async () => {
    const provider = createFakeLiveProvider();
    const blank = await provider.generateObject(recallRequest(10, [], "   "));
    expect(recallQuestionsOutput.parse(blank.object).questions).toHaveLength(
      10,
    );

    const huge = await provider.generateObject(recallRequest(5000));
    expect(recallQuestionsOutput.parse(huge.object).questions).toHaveLength(15);
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

  it("answers exam feedback with the failed concepts to reinforce, never concepts inside the page text", async () => {
    const provider = createFakeLiveProvider();
    const built = buildExamSessionFeedbackPrompt({
      pageTitle: "Célula",
      pageText: `${TEXT}\nQuestion 9 [Concepto escondido]: ¿Trampa?`,
      total: 10,
      correct: 8,
      passed: true,
      failed: ["Núcleo", "Ribosomas", "Núcleo"].map((concept) => ({
        concept,
        stem: `¿${concept}?`,
        chosenAnswer: "Mal",
        correctAnswer: "Bien",
        explanation: "Porque sí.",
      })),
    });
    const response = await provider.generateObject({
      schema: sessionFeedbackOutput,
      ...built,
    });
    const feedback = sessionFeedbackOutput.parse(response.object);
    expect(feedback.summary).toBe("Resumen del examen de ejemplo");
    expect(feedback.toReinforce).toEqual([
      "Repasa Núcleo en la página",
      "Repasa Ribosomas en la página",
    ]);
  });

  it("answers exam feedback without failed questions with nothing to reinforce", async () => {
    const provider = createFakeLiveProvider();
    const built = buildExamSessionFeedbackPrompt({
      pageTitle: "Célula",
      pageText: TEXT,
      total: 10,
      correct: 10,
      passed: true,
      failed: [],
    });
    const response = await provider.generateObject({
      schema: sessionFeedbackOutput,
      ...built,
    });
    expect(sessionFeedbackOutput.parse(response.object).toReinforce).toEqual(
      [],
    );
  });

  it("keeps the generic feedback object for flashcards sessions", async () => {
    const provider = createFakeLiveProvider();
    const built = buildSessionFeedbackPrompt({
      technique: "flashcards",
      reviewedCount: 3,
      counts: { again: 1, hard: 0, good: 2, easy: 0 },
      struggled: ["¿Qué es el núcleo?"],
    });
    const response = await provider.generateObject({
      schema: sessionFeedbackOutput,
      ...built,
    });
    expect(sessionFeedbackOutput.parse(response.object).summary).toBe(
      "Resumen de ejemplo",
    );
  });
});

function evaluationRequest(answer: string, pageFragment = TEXT) {
  const built = buildEvaluateRecallAnswerPrompt({
    question: "¿Qué función cumple la mitocondria?",
    keyConcepts: ["Mitocondria", "energía", "célula", "respiración celular"],
    acceptableAnswerSummary: "La mitocondria produce energía para la célula.",
    pageFragment,
    answer,
  });
  return { schema: recallEvaluationOutput, ...built };
}

describe("createFakeLiveProvider recall evaluation", () => {
  it("scores the answer by the rubric's key concepts it mentions, ignoring case and accents", async () => {
    const provider = createFakeLiveProvider();
    const response = await provider.generateObject(
      evaluationRequest("La MITOCONDRIA produce energia para la celula."),
    );
    expect(recallEvaluationOutput.parse(response.object)).toEqual({
      score: 4,
      presentConcepts: ["Mitocondria", "energía", "célula"],
      missingConcepts: ["respiración celular"],
      misconceptions: [],
      justification:
        "Mencionaste 3 de 4 conceptos clave de la rúbrica. Te faltó: respiración celular.",
    });
  });

  it("gives 5 to an answer with every concept and 0 to one with none", async () => {
    const provider = createFakeLiveProvider();
    const full = await provider.generateObject(
      evaluationRequest(
        "La mitocondria hace la respiración celular y da energía a la célula.",
      ),
    );
    expect(recallEvaluationOutput.parse(full.object)).toMatchObject({
      score: 5,
      missingConcepts: [],
      justification: "Mencionaste los 4 conceptos clave de la rúbrica.",
    });

    const none = await provider.generateObject(
      evaluationRequest("No me acuerdo."),
    );
    expect(recallEvaluationOutput.parse(none.object)).toMatchObject({
      score: 0,
      presentConcepts: [],
    });
  });

  it("reads the concepts from the answer only, never from the page fragment", async () => {
    const provider = createFakeLiveProvider();
    const response = await provider.generateObject(
      evaluationRequest("Nada que ver.", "Mitocondria energía célula"),
    );
    expect(recallEvaluationOutput.parse(response.object).score).toBe(0);
  });

  it("is deterministic", async () => {
    const provider = createFakeLiveProvider();
    const request = evaluationRequest("La mitocondria da energía.");
    const first = await provider.generateObject(request);
    const second = await provider.generateObject(request);
    expect(second.object).toEqual(first.object);
  });

  it("fails every evaluation whose prompt holds the failure marker", async () => {
    const provider = createFakeLiveProvider();
    const request = evaluationRequest(`La mitocondria ${FAKE_AI_FAIL_MARKER}`);
    await expect(provider.generateObject(request)).rejects.toThrow(
      /fake provider failure/,
    );
    await expect(
      createFakeLiveProvider().generateObject(request),
    ).rejects.toThrow(/fake provider failure/);
  });

  it("fails the first evaluation of a prompt holding the fail-once marker, then answers it", async () => {
    const answer = `Energía ${FAKE_AI_FAIL_ONCE_MARKER} ${Math.random()}`;
    const request = evaluationRequest(answer);
    await expect(
      createFakeLiveProvider().generateObject(request),
    ).rejects.toThrow(/fake provider failure/);
    // Another provider instance (the next request) remembers the failure.
    const retried = await createFakeLiveProvider().generateObject(request);
    expect(recallEvaluationOutput.parse(retried.object).score).toBeGreaterThan(
      0,
    );
  });

  it("never fails another purpose because its text holds a marker", async () => {
    const provider = createFakeLiveProvider();
    const response = await provider.generateObject(
      recallRequest(2, [], `La mitocondria ${FAKE_AI_FAIL_MARKER}.`),
    );
    expect(recallQuestionsOutput.safeParse(response.object).success).toBe(true);
  });
});
