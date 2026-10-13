import { describe, expect, it } from "vitest";
import {
  accuracyRate,
  examAccuracy,
  flashcardAccuracy,
  recallAccuracy,
} from "./accuracy";

describe("accuracyRate", () => {
  it("is the share of correct outcomes", () => {
    expect(accuracyRate({ correct: 3, total: 4 })).toBe(0.75);
  });

  it("is null when there is nothing to rate", () => {
    expect(accuracyRate({ correct: 0, total: 0 })).toBeNull();
  });
});

describe("flashcardAccuracy", () => {
  it("counts reviews with quality 3 or more as correct", () => {
    expect(
      flashcardAccuracy([
        { quality: 0 },
        { quality: 2 },
        { quality: 3 },
        { quality: 5 },
      ]),
    ).toEqual({ correct: 2, total: 4 });
  });
});

describe("examAccuracy", () => {
  it("counts correct answers", () => {
    expect(
      examAccuracy([
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
      ]),
    ).toEqual({ correct: 2, total: 3 });
  });
});

describe("recallAccuracy", () => {
  it("counts evaluated answers with an AI score of 3 or more as correct", () => {
    expect(
      recallAccuracy([{ aiScore: 2 }, { aiScore: 3 }, { aiScore: 5 }]),
    ).toEqual({ correct: 2, total: 3 });
  });

  it("is an empty tally without answers", () => {
    expect(recallAccuracy([])).toEqual({ correct: 0, total: 0 });
  });
});
