import type { AiProvider } from "../application/ports";
import { examQuestionsOutput, flashcardsOutput } from "../application/schemas";

export const FAKE_PROVIDER_ID = "fake";
export const FAKE_MODEL_ID = "fake-model";

const DEFAULT_CARD_COUNT = 5;
// Flashcards generation bounds (MAX_CARD_COUNT 20).
const MAX_FAKE_CARD_COUNT = 20;

// Reads the count from the prompt header the builders emit as its first two
// lines ("Page title: …" then "Number of <label>: N"), never from the page
// text, and clamps it to [1, max] so a prompt can never ask for an unbounded
// answer.
function headerCount(
  prompt: string,
  label: string,
  fallback: number,
  max: number,
): number {
  const [, countLine] = prompt.split("\n", 2);
  const match = new RegExp(`^Number of ${label}: (\\d{1,6})$`).exec(
    countLine ?? "",
  );
  if (!match) return fallback;
  return Math.min(Math.max(Number(match[1]), 1), max);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Reads the prompt shape produced by `buildGenerateFlashcardsPrompt`:
// "Number of flashcards: N" and the page text after "Text:".
function parseFlashcardsPrompt(prompt: string): {
  count: number;
  text: string;
} {
  const marker = prompt.indexOf("Text:\n");
  const text = marker === -1 ? prompt : prompt.slice(marker + "Text:\n".length);
  return {
    count: headerCount(
      prompt,
      "flashcards",
      DEFAULT_CARD_COUNT,
      MAX_FAKE_CARD_COUNT,
    ),
    text,
  };
}

function flashcardsFrom(prompt: string) {
  const { count, text } = parseFlashcardsPrompt(prompt);
  const sentences = splitSentences(text);
  const source = sentences.length > 0 ? sentences : ["Contenido de la página."];
  const cards = source.slice(0, count).map((sentence) => {
    const topic = sentence.replace(/[.!?]+$/, "");
    const short = topic.split(/\s+/).slice(0, 4).join(" ");
    return {
      front: `¿Qué dice el texto sobre «${short}»?`,
      back: sentence,
    };
  });
  return { cards };
}

const DEFAULT_QUESTION_COUNT = 10;
// Exams domain bound (EXAM_MAX_QUESTIONS 30).
const MAX_FAKE_QUESTION_COUNT = 30;
// Domain bounds (exams MAX_OPTION_LENGTH 300, MAX_CONCEPT_LENGTH 120).
const MAX_FAKE_OPTION_LENGTH = 280;
const MAX_FAKE_CONCEPT_LENGTH = 120;

function normalizeStem(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s¿¡]+/, "")
    .replace(/[\s.,;:!?…]+$/, "")
    .toLocaleLowerCase();
}

// Reads the prompt shape produced by `buildGenerateExamQuestionsPrompt`:
// "Number of questions: N", the "- [concept] stem" lines under "Existing
// questions:" and the page text after "Text:".
function parseExamQuestionsPrompt(prompt: string): {
  count: number;
  existingStems: Set<string>;
  text: string;
} {
  const marker = prompt.indexOf("\nText:\n");
  const head = marker === -1 ? prompt : prompt.slice(0, marker);
  const text =
    marker === -1 ? prompt : prompt.slice(marker + "\nText:\n".length);
  const existingStems = new Set(
    head
      .split("\n")
      .filter((line) => line.startsWith("- ["))
      .map((line) => normalizeStem(line.slice(line.indexOf("] ") + 2))),
  );
  return {
    count: headerCount(
      prompt,
      "questions",
      DEFAULT_QUESTION_COUNT,
      MAX_FAKE_QUESTION_COUNT,
    ),
    existingStems,
    text,
  };
}

// Exactly `count` distinct questions, cycling over the page sentences, with
// numbered stems that skip every existing one: a second generation on the
// same page adds new questions instead of duplicates.
function examQuestionsFrom(prompt: string) {
  const { count, existingStems, text } = parseExamQuestionsPrompt(prompt);
  const sentences = splitSentences(text);
  const source = sentences.length > 0 ? sentences : ["Contenido de la página."];
  const questions = [];
  let number = existingStems.size;
  while (questions.length < count) {
    number += 1;
    const sentence = source[questions.length % source.length] as string;
    const short = sentence
      .replace(/[.!?]+$/, "")
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    const stem = `Pregunta ${number}: ¿qué afirma el texto sobre «${short}»?`;
    if (existingStems.has(normalizeStem(stem))) continue;
    const correctIndex = (number - 1) % 4;
    const options = [
      `El texto no menciona «${short}».`,
      `«${short}» pertenece a otra materia.`,
      "Ninguna de las otras opciones es correcta.",
    ];
    options.splice(correctIndex, 0, sentence.slice(0, MAX_FAKE_OPTION_LENGTH));
    questions.push({
      stem,
      options,
      correctIndex,
      explanation: `El texto dice: ${sentence}`,
      concept: short.slice(0, MAX_FAKE_CONCEPT_LENGTH),
    });
  }
  return { questions };
}

// One schema-valid minimal object per purpose without a prompt-aware
// branch. The first candidate the request schema accepts is returned.
const MINIMAL_OBJECTS: readonly unknown[] = [
  {
    variants: [
      {
        forRootId: "root-1",
        stem: "Variante de ejemplo",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Explicación de ejemplo",
      },
    ],
  },
  {
    questions: [
      {
        prompt: "Pregunta de recuerdo",
        rubric: {
          keyConcepts: ["concepto"],
          acceptableAnswerSummary: "Resumen aceptable",
        },
      },
    ],
  },
  {
    score: 3,
    presentConcepts: ["concepto"],
    missingConcepts: [],
    misconceptions: [],
    justification: "Evaluación de ejemplo",
  },
  {
    summary: "Resumen de ejemplo",
    strengths: ["Constancia"],
    toReinforce: ["Repaso"],
    nextStepSuggestion: "Repasa mañana",
  },
];

// Deterministic provider for e2e and CI (AI_PROVIDER_MODE=fake): no network,
// ~5 ms latency, plausible token usage.
export function createFakeLiveProvider(): AiProvider {
  return {
    id: FAKE_PROVIDER_ID,
    model: FAKE_MODEL_ID,
    async generateObject(request) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      // The port carries no purpose, but each purpose passes its own output
      // schema: only the matching prompt-aware answer is built.
      const schema: unknown = request.schema;
      const candidates =
        schema === flashcardsOutput
          ? [flashcardsFrom(request.prompt)]
          : schema === examQuestionsOutput
            ? [examQuestionsFrom(request.prompt)]
            : MINIMAL_OBJECTS;
      const object = candidates.find(
        (candidate) => request.schema.safeParse(candidate).success,
      );
      if (object === undefined) {
        throw new Error("fake provider has no object for this schema");
      }
      return {
        object,
        usage: {
          inputTokens: Math.ceil(
            (request.system.length + request.prompt.length) / 4,
          ),
          outputTokens: Math.ceil(JSON.stringify(object).length / 4),
        },
        latencyMs: 5,
      };
    },
  };
}
