import type { AiProvider } from "../application/ports";

export const FAKE_PROVIDER_ID = "fake";
export const FAKE_MODEL_ID = "fake-model";

const DEFAULT_CARD_COUNT = 5;

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
  const count = Number(/Number of flashcards: (\d+)/.exec(prompt)?.[1]);
  const marker = prompt.indexOf("Text:\n");
  const text = marker === -1 ? prompt : prompt.slice(marker + "Text:\n".length);
  return {
    count: Number.isFinite(count) && count > 0 ? count : DEFAULT_CARD_COUNT,
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

// One schema-valid minimal object per non-flashcard purpose. The provider
// port carries no purpose, so the first candidate the request schema accepts
// is returned.
const MINIMAL_OBJECTS: readonly unknown[] = [
  {
    questions: [
      {
        stem: "Pregunta de ejemplo",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Explicación de ejemplo",
        concept: "Concepto",
      },
    ],
  },
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
      const candidates = [flashcardsFrom(request.prompt), ...MINIMAL_OBJECTS];
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
