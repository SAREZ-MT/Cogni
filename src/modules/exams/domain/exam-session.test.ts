import { describe, expect, it } from "vitest";
import { EXAM_ERROR } from "./errors";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  EXAM_PASS_THRESHOLD,
  examSessionDurationMs,
  finishExamSession,
  gradeExamAnswer,
  initialExamPageState,
  isValidQuestionCount,
  newExamSession,
} from "./exam-session";

const startedAt = new Date("2026-10-05T10:00:00.000Z");
const finishedAt = new Date("2026-10-05T10:12:30.000Z");

const base = {
  id: "s-1",
  ownerId: "owner-1",
  pageId: "page-1",
  requestedCount: EXAM_DEFAULT_QUESTIONS,
  retakeOfSessionId: null,
};

describe("constants", () => {
  it("match the user decisions of 2026-10-05", () => {
    expect(EXAM_MIN_QUESTIONS).toBe(10);
    expect(EXAM_MAX_QUESTIONS).toBe(30);
    expect(EXAM_DEFAULT_QUESTIONS).toBe(10);
    expect(EXAM_PASS_THRESHOLD).toBe(0.7);
  });
});

describe("isValidQuestionCount", () => {
  it.each([
    [9, false],
    [10, true],
    [20, true],
    [30, true],
    [31, false],
    [10.5, false],
    [Number.NaN, false],
  ])("%s → %s", (count, expected) => {
    expect(isValidQuestionCount(count)).toBe(expected);
  });
});

describe("newExamSession", () => {
  it("opens a first attempt", () => {
    const result = newExamSession(base, startedAt);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      id: "s-1",
      ownerId: "owner-1",
      pageId: "page-1",
      requestedCount: 10,
      isRetake: false,
      retakeOfSessionId: null,
      startedAt,
      finishedAt: null,
      total: null,
      correct: null,
      score: null,
      passed: null,
    });
  });

  it("marks a retake of a previous session", () => {
    const result = newExamSession(
      { ...base, requestedCount: 30, retakeOfSessionId: "s-0" },
      startedAt,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isRetake).toBe(true);
    expect(result.value.retakeOfSessionId).toBe("s-0");
  });

  it.each([9, 31])("refuses %i requested questions", (requestedCount) => {
    const result = newExamSession({ ...base, requestedCount }, startedAt);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION_COUNT);
  });
});

describe("finishExamSession and examSessionDurationMs", () => {
  function opened() {
    const result = newExamSession(base, startedAt);
    if (!result.ok) throw result.error;
    return result.value;
  }

  it("has no duration while open", () => {
    expect(examSessionDurationMs(opened())).toBeNull();
  });

  it("stores the score and derives the duration from start and finish", () => {
    const result = finishExamSession(
      opened(),
      { total: 10, correct: 7, score: 0.7, passed: true },
      finishedAt,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      finishedAt,
      total: 10,
      correct: 7,
      score: 0.7,
      passed: true,
    });
    expect(examSessionDurationMs(result.value)).toBe(750_000);
  });

  it("refuses to finish a session twice", () => {
    const first = finishExamSession(
      opened(),
      { total: 10, correct: 2, score: 0.2, passed: false },
      finishedAt,
    );
    if (!first.ok) throw first.error;

    const second = finishExamSession(
      first.value,
      { total: 10, correct: 9, score: 0.9, passed: true },
      finishedAt,
    );

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe(EXAM_ERROR.SESSION_FINISHED);
  });
});

describe("gradeExamAnswer", () => {
  const question = { id: "v-1", rootId: "q-1", correctIndex: 2 };
  const answeredAt = new Date("2026-10-05T10:01:00.000Z");

  it("records the shown question, its root and a correct choice", () => {
    const result = gradeExamAnswer({
      sessionId: "s-1",
      question,
      selectedIndex: 2,
      answeredAt,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: "s-1",
        questionId: "v-1",
        rootId: "q-1",
        selectedIndex: 2,
        isCorrect: true,
        answeredAt,
      },
    });
  });

  it("records a wrong choice", () => {
    const result = gradeExamAnswer({
      sessionId: "s-1",
      question,
      selectedIndex: 0,
      answeredAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isCorrect).toBe(false);
  });

  it.each([-1, 4, 1.5])("refuses selected index %s", (selectedIndex) => {
    const result = gradeExamAnswer({
      sessionId: "s-1",
      question,
      selectedIndex,
      answeredAt,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_ANSWER);
  });
});

describe("initialExamPageState", () => {
  it("has nothing pending and no passed session", () => {
    expect(initialExamPageState("page-1", "owner-1")).toEqual({
      pageId: "page-1",
      ownerId: "owner-1",
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: null,
    });
  });
});
