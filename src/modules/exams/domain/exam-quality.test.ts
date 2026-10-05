import { describe, expect, it } from "vitest";
import { examQualityFor } from "./exam-quality";

describe("examQualityFor", () => {
  it.each([
    // A wrong answer always reviews with q = 1, due or not.
    [
      { correct: false, wasDue: true },
      { kind: "review", quality: 1 },
    ],
    [
      { correct: false, wasDue: false },
      { kind: "review", quality: 1 },
    ],
    // A correct answer reviews with q = 4 only when the item was due.
    [
      { correct: true, wasDue: true },
      { kind: "review", quality: 4 },
    ],
    // Otherwise SM-2 is left alone (no interval inflation from retries).
    [{ correct: true, wasDue: false }, { kind: "skip" }],
  ])("%o → %o", (input, expected) => {
    expect(examQualityFor(input)).toEqual(expected);
  });
});
