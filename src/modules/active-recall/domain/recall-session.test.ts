import { describe, expect, it } from "vitest";
import type { RecallEvaluationStatus } from "./recall-answer";
import {
  averageCombinedQuality,
  newRecallSession,
  sessionCalibration,
  sessionEvaluationStatus,
  sessionScore,
} from "./recall-session";

const now = new Date("2026-10-06T10:00:00.000Z");

function statuses(...values: RecallEvaluationStatus[]) {
  return values.map((evaluationStatus) => ({ evaluationStatus }));
}

describe("newRecallSession", () => {
  it("opens a session awaiting its evaluation", () => {
    expect(
      newRecallSession(
        { id: "rs-1", ownerId: "owner-1", pageId: "page-1" },
        now,
      ),
    ).toEqual({
      id: "rs-1",
      ownerId: "owner-1",
      pageId: "page-1",
      startedAt: now,
      finishedAt: null,
      evaluationStatus: "pending",
    });
  });
});

describe("sessionEvaluationStatus", () => {
  it("is done for a session without answers", () => {
    expect(sessionEvaluationStatus([])).toBe("done");
  });

  it("is done when every answer is evaluated", () => {
    expect(sessionEvaluationStatus(statuses("done", "done"))).toBe("done");
  });

  it.each([
    [statuses("pending")],
    [statuses("done", "pending")],
    [statuses("failed", "pending", "done")],
  ])("is pending while any answer is pending (%j)", (answers) => {
    expect(sessionEvaluationStatus(answers)).toBe("pending");
  });

  it.each([
    [statuses("failed")],
    [statuses("done", "failed")],
  ])("is partial when an answer failed and none is pending (%j)", (answers) => {
    expect(sessionEvaluationStatus(answers)).toBe("partial");
  });
});

describe("sessionScore", () => {
  it("has no percentage when nothing was evaluated", () => {
    expect(sessionScore([])).toEqual({
      correct: 0,
      partial: 0,
      incorrect: 0,
      percentage: null,
    });
    expect(
      sessionScore([
        { aiScore: null, combinedQuality: null },
        { aiScore: null, combinedQuality: null },
      ]),
    ).toEqual({ correct: 0, partial: 0, incorrect: 0, percentage: null });
  });

  it("buckets ai scores: correct ≥ 4, partial 2–3, incorrect ≤ 1", () => {
    const answers = [0, 1, 2, 3, 4, 5].map((aiScore) => ({
      aiScore,
      combinedQuality: aiScore,
    }));

    expect(sessionScore(answers)).toMatchObject({
      correct: 2,
      partial: 2,
      incorrect: 2,
    });
  });

  it("is the average combined quality × 20, rounded", () => {
    // (5 + 4 + 2) / 3 × 20 = 73.33… → 73
    expect(
      sessionScore([
        { aiScore: 5, combinedQuality: 5 },
        { aiScore: 4, combinedQuality: 4 },
        { aiScore: 1, combinedQuality: 2 },
      ]).percentage,
    ).toBe(73);
  });

  it.each([
    [[0], 0],
    [[5], 100],
    [[5, 0], 50],
    // (3 + 4) / 2 × 20 = 70
    [[3, 4], 70],
    // (2 + 2 + 3) / 3 × 20 = 46.67 → 47
    [[2, 2, 3], 47],
  ])("combined %j gives %i %", (combined, expected) => {
    const answers = combined.map((value) => ({
      aiScore: value,
      combinedQuality: value,
    }));

    expect(sessionScore(answers).percentage).toBe(expected);
  });

  it("ignores failed or pending answers in buckets and percentage", () => {
    expect(
      sessionScore([
        { aiScore: 5, combinedQuality: 5 },
        { aiScore: null, combinedQuality: null },
      ]),
    ).toEqual({ correct: 1, partial: 0, incorrect: 0, percentage: 100 });
  });
});

describe("averageCombinedQuality", () => {
  it("averages the combined quality of the evaluated answers only", () => {
    expect(
      averageCombinedQuality([
        { combinedQuality: 4 },
        { combinedQuality: null },
        { combinedQuality: 3 },
        { combinedQuality: 3 },
      ]),
    ).toBeCloseTo(10 / 3);
  });

  it("is null when nothing was evaluated", () => {
    expect(averageCombinedQuality([])).toBeNull();
    expect(averageCombinedQuality([{ combinedQuality: null }])).toBeNull();
  });
});

describe("sessionCalibration", () => {
  it("counts over- and underconfident evaluated answers (RF-AR-05)", () => {
    expect(
      sessionCalibration([
        { selfRating: 5, aiScore: 1 },
        { selfRating: 4, aiScore: 2 },
        { selfRating: 1, aiScore: 4 },
        { selfRating: 3, aiScore: 3 },
        { selfRating: 5, aiScore: null },
      ]),
    ).toEqual({ overconfident: 2, underconfident: 1 });
  });

  it("counts nothing for a session without evaluated answers", () => {
    expect(sessionCalibration([])).toEqual({
      overconfident: 0,
      underconfident: 0,
    });
  });

  it("leaves out an answer whose scores are out of range", () => {
    expect(sessionCalibration([{ selfRating: 9, aiScore: 0 }])).toEqual({
      overconfident: 0,
      underconfident: 0,
    });
  });
});
