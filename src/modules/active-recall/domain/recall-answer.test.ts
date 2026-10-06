import { describe, expect, it } from "vitest";
import { RECALL_ERROR } from "./errors";
import {
  calibrationOf,
  combinedQuality,
  isRecallScore,
  isSkippedAnswer,
  type NewRecallAnswer,
  newRecallAnswer,
  SKIPPED_ANSWER_TEXT,
  skippedEvaluation,
} from "./recall-answer";

const now = new Date("2026-10-06T10:00:00.000Z");

function expectErrorCode(
  result: { ok: boolean; error?: { code: string } },
  code: string,
) {
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe(code);
}

function okValue<T>(result: { ok: boolean; value?: T }): T | undefined {
  expect(result.ok).toBe(true);
  return result.value;
}

describe("isRecallScore", () => {
  it.each([0, 1, 2, 3, 4, 5])("accepts %i", (score) => {
    expect(isRecallScore(score)).toBe(true);
  });

  it.each([
    -1,
    6,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("refuses %s", (score) => {
    expect(isRecallScore(score)).toBe(false);
  });
});

describe("combinedQuality", () => {
  it.each([
    // [ai, self, round(0.6·ai + 0.4·self)]
    [0, 0, 0],
    [5, 5, 5],
    [5, 0, 3],
    [0, 5, 2],
    [4, 2, 3],
    [3, 4, 3],
    [2, 5, 3],
    [1, 2, 1],
    // 0.6·1 + 0.4·4 = 2.2 → 2 and 0.6·4 + 0.4·1 = 2.8 → 3
    [1, 4, 2],
    [4, 1, 3],
  ])("ai %i and self %i combine to %i", (ai, self, expected) => {
    expect(okValue(combinedQuality(ai, self))).toBe(expected);
  });

  it("matches round(0.6·ai + 0.4·self) on the whole 0–5 grid", () => {
    for (let ai = 0; ai <= 5; ai += 1) {
      for (let self = 0; self <= 5; self += 1) {
        expect(okValue(combinedQuality(ai, self))).toBe(
          Math.round(0.6 * ai + 0.4 * self),
        );
      }
    }
  });

  it.each([
    [-1, 3],
    [6, 3],
    [2.5, 3],
    [3, -1],
    [3, 6],
    [3, 4.2],
  ])("refuses ai %s with self %s", (ai, self) => {
    expectErrorCode(combinedQuality(ai, self), RECALL_ERROR.INVALID_SCORE);
  });
});

describe("calibrationOf", () => {
  it.each([
    // [self, ai, signal]
    [4, 2, "overconfident"],
    [5, 0, "overconfident"],
    [4, 3, "calibrated"],
    [3, 2, "calibrated"],
    [1, 4, "underconfident"],
    [0, 5, "underconfident"],
    [1, 3, "calibrated"],
    [2, 4, "calibrated"],
    [3, 3, "calibrated"],
  ] as const)("self %i with ai %i is %s", (self, ai, signal) => {
    expect(okValue(calibrationOf(self, ai))).toBe(signal);
  });

  it.each([
    [6, 2],
    [-1, 2],
    [3, 7],
    [3, 1.5],
  ])("refuses self %s with ai %s", (self, ai) => {
    expectErrorCode(calibrationOf(self, ai), RECALL_ERROR.INVALID_SCORE);
  });
});

describe("skippedEvaluation", () => {
  it("is the auditable record of a skipped answer with ai score 0", () => {
    expect(skippedEvaluation()).toEqual({
      source: "skipped",
      score: 0,
      justification: "Pregunta sin responder.",
    });
  });

  it("returns a fresh object every call", () => {
    expect(skippedEvaluation()).not.toBe(skippedEvaluation());
  });
});

describe("isSkippedAnswer", () => {
  it("recognises the player's skip marker", () => {
    expect(SKIPPED_ANSWER_TEXT).toBe("(sin respuesta)");
    expect(isSkippedAnswer(SKIPPED_ANSWER_TEXT)).toBe(true);
    expect(isSkippedAnswer("  (sin respuesta) ")).toBe(true);
  });

  it.each(["", "   ", "\n"])("treats blank text %j as skipped", (text) => {
    expect(isSkippedAnswer(text)).toBe(true);
  });

  it.each([
    "La luz",
    "(sin respuesta) pero algo",
    "sin respuesta",
  ])("treats %j as an answer", (text) => {
    expect(isSkippedAnswer(text)).toBe(false);
  });
});

describe("newRecallAnswer", () => {
  const input: NewRecallAnswer = {
    id: "ra-1",
    ownerId: "owner-1",
    sessionId: "rs-1",
    questionId: "rq-1",
    answerText: "  La clorofila capta la luz. ",
    selfRating: 4,
  };

  it("creates a pending answer with trimmed text and no evaluation yet", () => {
    expect(okValue(newRecallAnswer(input, now))).toEqual({
      id: "ra-1",
      ownerId: "owner-1",
      sessionId: "rs-1",
      questionId: "rq-1",
      answerText: "La clorofila capta la luz.",
      selfRating: 4,
      evaluationStatus: "pending",
      aiEvaluation: null,
      aiScore: null,
      combinedQuality: null,
      disagreed: false,
      generationId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("stores a blank answer as the skip marker", () => {
    const answer = okValue(
      newRecallAnswer({ ...input, answerText: "  ", selfRating: 0 }, now),
    );

    expect(answer?.answerText).toBe(SKIPPED_ANSWER_TEXT);
  });

  it.each([0, 5])("accepts the bound self-rating %i", (selfRating) => {
    expect(newRecallAnswer({ ...input, selfRating }, now).ok).toBe(true);
  });

  it.each([-1, 6, 3.5])("refuses self-rating %s", (selfRating) => {
    expectErrorCode(
      newRecallAnswer({ ...input, selfRating }, now),
      RECALL_ERROR.INVALID_ANSWER,
    );
  });
});
