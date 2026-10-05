import { describe, expect, it } from "vitest";
import { EXAM_ERROR } from "./errors";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  EXAM_PASS_THRESHOLD,
  type ExamAnswer,
  examSessionDurationMs,
  finishExamSession,
  gradeExamAnswer,
  initialExamPageState,
  isPassingScore,
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
  questionIds: ["q-1", "q-2", "q-3"],
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
      questionIds: ["q-1", "q-2", "q-3"],
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

  it.each([
    ["none", []],
    ["more than requested", Array.from({ length: 11 }, (_, n) => `q-${n}`)],
    ["a repeated one", ["q-1", "q-2", "q-1"]],
  ])("refuses a question list with %s", (_label, questionIds) => {
    const result = newExamSession({ ...base, questionIds }, startedAt);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_SESSION_QUESTIONS);
  });

  it.each([9, 31])("refuses %i requested questions", (requestedCount) => {
    const result = newExamSession({ ...base, requestedCount }, startedAt);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION_COUNT);
  });
});

describe("finishExamSession and examSessionDurationMs", () => {
  function opened(requestedCount = EXAM_DEFAULT_QUESTIONS) {
    const result = newExamSession({ ...base, requestedCount }, startedAt);
    if (!result.ok) throw result.error;
    return result.value;
  }

  function answers(total: number, correct: number): ExamAnswer[] {
    return Array.from({ length: total }, (_, i) => ({
      sessionId: "s-1",
      questionId: `v-${i}`,
      rootId: `r-${i}`,
      selectedIndex: 0,
      isCorrect: i < correct,
      answeredAt: finishedAt,
    }));
  }

  function expectCode(
    result: { ok: true } | { ok: false; error: { code: string } },
    code: string,
  ) {
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  }

  it("has no duration while open", () => {
    expect(examSessionDurationMs(opened())).toBeNull();
  });

  it("derives the result from the answers and the duration from start and finish", () => {
    const result = finishExamSession(opened(), answers(10, 7), finishedAt);

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

  it.each([
    [10, 6, false],
    [30, 21, true],
    [30, 20, false],
  ])("%i answers with %i correct → passed %s", (total, correct, passed) => {
    const result = finishExamSession(
      opened(30),
      answers(total, correct),
      finishedAt,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.correct).toBe(correct);
    expect(result.value.score).toBe(correct / total);
    expect(result.value.passed).toBe(passed);
    expect(result.value.passed).toBe(isPassingScore(correct, total));
  });

  it("refuses to finish a session twice", () => {
    const first = finishExamSession(opened(), answers(10, 2), finishedAt);
    if (!first.ok) throw first.error;

    expectCode(
      finishExamSession(first.value, answers(10, 9), finishedAt),
      EXAM_ERROR.SESSION_FINISHED,
    );
  });

  it("refuses to finish without answers", () => {
    expectCode(
      finishExamSession(opened(), [], finishedAt),
      EXAM_ERROR.NO_ANSWERS,
    );
  });

  it("refuses an answer of another session", () => {
    const mixed = answers(10, 10);
    mixed[2] = { ...mixed[2], sessionId: "s-other" };

    expectCode(
      finishExamSession(opened(), mixed, finishedAt),
      EXAM_ERROR.INVALID_ANSWER,
    );
  });

  it("refuses two answers to the same question", () => {
    const duplicated = [...answers(9, 9), { ...answers(1, 1)[0] }];

    expectCode(
      finishExamSession(opened(), duplicated, finishedAt),
      EXAM_ERROR.DUPLICATE_ANSWER,
    );
  });

  it("refuses two answers to the same root", () => {
    const duplicated = [
      ...answers(9, 9),
      { ...answers(1, 1)[0], questionId: "v-other" },
    ];

    expectCode(
      finishExamSession(opened(), duplicated, finishedAt),
      EXAM_ERROR.DUPLICATE_ANSWER,
    );
  });

  it("refuses more answers than requested questions", () => {
    expectCode(
      finishExamSession(opened(10), answers(11, 11), finishedAt),
      EXAM_ERROR.INVALID_SESSION_FINISH,
    );
  });

  it("refuses a finish before the start", () => {
    expectCode(
      finishExamSession(
        opened(),
        answers(10, 10),
        new Date(startedAt.getTime() - 1),
      ),
      EXAM_ERROR.INVALID_SESSION_FINISH,
    );
  });

  it("accepts a finish at the start instant", () => {
    const result = finishExamSession(opened(), answers(10, 10), startedAt);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(examSessionDurationMs(result.value)).toBe(0);
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
