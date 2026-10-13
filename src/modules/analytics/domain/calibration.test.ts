import { describe, expect, it } from "vitest";
import { type CalibratedAnswer, rollupCalibration } from "./calibration";

const answer = (
  overrides: Partial<CalibratedAnswer> = {},
): CalibratedAnswer => ({
  pageId: "p-1",
  pageTitle: "Mitocondria",
  notebookId: "nb-1",
  notebookTitle: "Biología",
  selfRating: 3,
  aiScore: 3,
  signal: "calibrated",
  ...overrides,
});

describe("rollupCalibration", () => {
  it("counts each answer's signal and averages the ratings per page", () => {
    const rollup = rollupCalibration([
      answer({ selfRating: 5, aiScore: 1, signal: "overconfident" }),
      answer({ selfRating: 4, aiScore: 4 }),
      answer({ selfRating: 0, aiScore: 4, signal: "underconfident" }),
    ]);

    expect(rollup.pages).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        notebookTitle: "Biología",
        answers: 3,
        overconfident: 1,
        underconfident: 1,
        calibrated: 1,
        selfAverage: 3,
        aiAverage: 3,
      },
    ]);
    expect(rollup.totals).toEqual({
      answers: 3,
      overconfident: 1,
      underconfident: 1,
      calibrated: 1,
    });
  });

  it("puts the pages with the largest miscalibrated share first", () => {
    const rollup = rollupCalibration([
      answer({ pageId: "p-calm" }),
      answer({ pageId: "p-half", signal: "overconfident" }),
      answer({ pageId: "p-half" }),
      answer({ pageId: "p-all", signal: "underconfident" }),
      answer({ pageId: "p-tie", signal: "underconfident" }),
    ]);

    expect(rollup.pages.map((page) => page.pageId)).toEqual([
      "p-all",
      "p-tie",
      "p-half",
      "p-calm",
    ]);
  });

  it("is empty without answers", () => {
    expect(rollupCalibration([])).toEqual({
      pages: [],
      totals: {
        answers: 0,
        overconfident: 0,
        underconfident: 0,
        calibrated: 0,
      },
    });
  });
});
