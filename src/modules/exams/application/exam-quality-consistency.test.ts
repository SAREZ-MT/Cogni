import { describe, expect, it } from "vitest";
import {
  EXAM_REVIEW_QUALITY,
  examReviewQualityFor,
} from "@/modules/study-engine";
import { EXAM_QUALITY, examQualityFor } from "../domain/exam-quality";

// study-engine owns the q mapping applied by recordExamReviews and may not
// import exams (study-engine-knows-no-technique); this keeps both copies of
// the §7.2 rule in step for every (correct, wasDue) combination.
describe("exam quality rule", () => {
  it("shares the q values with study-engine's EXAM_REVIEW_QUALITY", () => {
    expect(EXAM_QUALITY).toEqual(EXAM_REVIEW_QUALITY);
  });

  it.each([
    { correct: false, wasDue: false },
    { correct: false, wasDue: true },
    { correct: true, wasDue: true },
    { correct: true, wasDue: false },
  ])("agrees with study-engine for correct=$correct, wasDue=$wasDue", (answer) => {
    const exams = examQualityFor(answer);
    const engine = examReviewQualityFor(answer);
    expect(exams.kind === "review" ? exams.quality : null).toBe(engine);
  });

  it("skips a correct answer to an item that is not due on both sides", () => {
    expect(examQualityFor({ correct: true, wasDue: false })).toEqual({
      kind: "skip",
    });
    expect(examReviewQualityFor({ correct: true, wasDue: false })).toBe(null);
  });
});
