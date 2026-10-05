import { describe, expect, it } from "vitest";
import { EXAM_REVIEW_QUALITY } from "@/modules/study-engine";
import { EXAM_QUALITY, examQualityFor } from "../domain/exam-quality";

// study-engine owns the q mapping applied by recordExamReviews and may not
// import exams (study-engine-knows-no-technique); this keeps both copies of
// the §7.2 rule in step.
describe("exam quality rule", () => {
  it("matches study-engine's EXAM_REVIEW_QUALITY", () => {
    expect(EXAM_QUALITY).toEqual(EXAM_REVIEW_QUALITY);
    expect(examQualityFor({ correct: false, wasDue: false })).toEqual({
      kind: "review",
      quality: EXAM_REVIEW_QUALITY.wrong,
    });
    expect(examQualityFor({ correct: true, wasDue: true })).toEqual({
      kind: "review",
      quality: EXAM_REVIEW_QUALITY.correct,
    });
  });
});
