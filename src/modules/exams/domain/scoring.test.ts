import { describe, expect, it } from "vitest";
import { EXAM_ERROR } from "./errors";
import { type ExamAnswer, initialExamPageState } from "./exam-session";
import { scoreExam } from "./scoring";

const answeredAt = new Date("2026-10-05T10:01:00.000Z");

function answers(total: number, correct: number): ExamAnswer[] {
  return Array.from({ length: total }, (_, i) => ({
    sessionId: "s-1",
    questionId: `v-${i}`,
    rootId: `r-${i}`,
    selectedIndex: 0,
    isCorrect: i < correct,
    answeredAt,
  }));
}

const previous = initialExamPageState("page-1", "owner-1");

describe("scoreExam", () => {
  it.each([
    // [total, correct, passed] — pass iff score >= 0.70.
    [10, 7, true],
    [10, 6, false],
    [100, 70, true],
    [100, 69, false],
    [20, 14, true],
    [20, 13, false],
    [30, 21, true],
    [30, 20, false],
    [10, 10, true],
    [10, 0, false],
  ])("%i answers with %i correct → passed %s", (total, correct, passed) => {
    const result = scoreExam({
      sessionId: "s-1",
      answers: answers(total, correct),
      previous,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(total);
    expect(result.value.correct).toBe(correct);
    expect(result.value.score).toBeCloseTo(correct / total, 10);
    expect(result.value.passed).toBe(passed);
  });

  it("agrees with integer arithmetic on the threshold for every N in [10, 30]", () => {
    for (let total = 10; total <= 30; total++) {
      // Smallest passing count: ceil(0.7 * total) computed without floats.
      const minPassing = Math.ceil((7 * total) / 10);
      const pass = scoreExam({
        sessionId: "s-1",
        answers: answers(total, minPassing),
        previous,
      });
      const fail = scoreExam({
        sessionId: "s-1",
        answers: answers(total, minPassing - 1),
        previous,
      });
      expect(pass.ok && pass.value.passed).toBe(true);
      expect(fail.ok && fail.value.passed).toBe(false);
    }
  });

  it("marks a retake pending with the failed roots when the exam fails", () => {
    const result = scoreExam({
      sessionId: "s-2",
      answers: answers(10, 6).map((a) => ({ ...a, sessionId: "s-2" })),
      previous: { ...previous, lastPassedSessionId: "s-0" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.failedRootIds).toEqual(["r-6", "r-7", "r-8", "r-9"]);
    expect(result.value.nextState).toEqual({
      pageId: "page-1",
      ownerId: "owner-1",
      retakePending: true,
      failedRootIds: ["r-6", "r-7", "r-8", "r-9"],
      // A failure keeps the last pass: the feedback policy reads it.
      lastPassedSessionId: "s-0",
    });
  });

  it("lists every root when all answers are wrong", () => {
    const result = scoreExam({
      sessionId: "s-1",
      answers: answers(10, 0),
      previous,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.score).toBe(0);
    expect(result.value.failedRootIds).toHaveLength(10);
  });

  it("clears a pending retake and records the passing session", () => {
    const result = scoreExam({
      sessionId: "s-3",
      answers: answers(10, 8).map((a) => ({ ...a, sessionId: "s-3" })),
      previous: {
        ...previous,
        retakePending: true,
        failedRootIds: ["r-1"],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Wrong answers on a passing exam still count as failed roots for the
    // feedback, but they do not leave a retake pending.
    expect(result.value.failedRootIds).toEqual(["r-8", "r-9"]);
    expect(result.value.nextState).toEqual({
      pageId: "page-1",
      ownerId: "owner-1",
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: "s-3",
    });
  });

  it("lists a failed root once even if two answers share it", () => {
    const duplicated = [
      ...answers(10, 0),
      { ...answers(1, 0)[0], questionId: "v-x" },
    ];

    const result = scoreExam({
      sessionId: "s-1",
      answers: duplicated,
      previous,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.failedRootIds.filter((id) => id === "r-0"),
    ).toHaveLength(1);
  });

  it("refuses an exam without answers", () => {
    const result = scoreExam({ sessionId: "s-1", answers: [], previous });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.NO_ANSWERS);
  });

  it("refuses an answer of another session", () => {
    const mixed = answers(10, 10);
    mixed[3] = { ...mixed[3], sessionId: "s-other" };

    const result = scoreExam({ sessionId: "s-1", answers: mixed, previous });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_ANSWER);
  });
});
