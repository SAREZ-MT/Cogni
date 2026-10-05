import { describe, expect, it } from "vitest";
import { composeExam, composeRetake, type ExamCandidate } from "./composition";
import { EXAM_ERROR } from "./errors";

const now = new Date("2026-10-05T10:00:00.000Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

function candidate(
  rootId: string,
  overrides: Partial<ExamCandidate> = {},
): ExamCandidate {
  return {
    rootId,
    questionId: `q-${rootId}`,
    failedLastTime: false,
    dueAt: day(10),
    lastSeenAt: day(-1),
    ...overrides,
  };
}

// n not-due, already seen candidates r-00..r-(n-1), all seen at the same
// instant so only the id breaks the tie.
function plain(n: number): ExamCandidate[] {
  return Array.from({ length: n }, (_, i) =>
    candidate(`r-${String(i).padStart(2, "0")}`),
  );
}

function roots(result: ReturnType<typeof composeExam>): string[] {
  if (!result.ok) throw result.error;
  return result.value.map((item) => item.rootId);
}

function errorCode(result: { ok: boolean; error?: { code: string } }) {
  expect(result.ok).toBe(false);
  return result.error?.code;
}

describe("composeExam", () => {
  it.each([
    [9, EXAM_ERROR.INVALID_QUESTION_COUNT],
    [31, EXAM_ERROR.INVALID_QUESTION_COUNT],
    [12.5, EXAM_ERROR.INVALID_QUESTION_COUNT],
  ])("refuses N = %s", (requestedCount, code) => {
    expect(
      errorCode(composeExam({ requestedCount, candidates: plain(40), now })),
    ).toBe(code);
  });

  it.each([
    // [N, available roots, expected length]
    [10, 10, 10],
    [10, 40, 10],
    [30, 40, 30],
    [30, 12, 12],
  ])("N = %i with %i roots → %i questions", (requestedCount, available, length) => {
    const result = composeExam({
      requestedCount,
      candidates: plain(available),
      now,
    });

    expect(roots(result)).toHaveLength(length);
  });

  it.each([0, 9])("refuses a page with %i active roots", (available) => {
    expect(
      errorCode(
        composeExam({ requestedCount: 10, candidates: plain(available), now }),
      ),
    ).toBe(EXAM_ERROR.NOT_ENOUGH_QUESTIONS);
  });

  it("orders failed roots first, then due roots, then least recently seen", () => {
    const candidates = [
      candidate("seen-old", { lastSeenAt: day(-9) }),
      candidate("due-recent", { dueAt: day(-1) }),
      candidate("never-seen", { lastSeenAt: null, dueAt: null }),
      candidate("failed", { failedLastTime: true, dueAt: day(1) }),
      candidate("due-old", { dueAt: day(-5) }),
      candidate("due-now", { dueAt: now }),
      candidate("seen-new", { lastSeenAt: day(-1) }),
      ...plain(5),
    ];

    expect(
      roots(composeExam({ requestedCount: 10, candidates, now })).slice(0, 7),
    ).toEqual([
      "failed",
      "due-old",
      "due-recent",
      "due-now",
      "never-seen",
      "seen-old",
      // Ties on lastSeenAt break by root id: r-00 < seen-new.
      "r-00",
    ]);
  });

  it("orders several failed roots by due date, then by id", () => {
    const candidates = [
      candidate("f-b", { failedLastTime: true, dueAt: day(1) }),
      candidate("f-a", { failedLastTime: true, dueAt: day(1) }),
      candidate("f-c", { failedLastTime: true, dueAt: day(-2) }),
      ...plain(8),
    ];

    expect(
      roots(composeExam({ requestedCount: 10, candidates, now })).slice(0, 3),
    ).toEqual(["f-c", "f-a", "f-b"]);
  });

  it("sorts a failed root without a due date after dated ones", () => {
    const candidates = [
      candidate("f-none-b", { failedLastTime: true, dueAt: null }),
      candidate("f-none-a", { failedLastTime: true, dueAt: null }),
      candidate("f-dated", { failedLastTime: true, dueAt: day(3) }),
      ...plain(8),
    ];

    expect(
      roots(composeExam({ requestedCount: 10, candidates, now })).slice(0, 3),
    ).toEqual(["f-dated", "f-none-a", "f-none-b"]);
  });

  it("breaks a tie between never-seen roots by id, before seen ones", () => {
    const candidates = [
      ...plain(8),
      candidate("new-b", { lastSeenAt: null }),
      candidate("new-a", { lastSeenAt: null }),
    ];

    expect(
      roots(composeExam({ requestedCount: 10, candidates, now })).slice(0, 3),
    ).toEqual(["new-a", "new-b", "r-00"]);
  });

  it("breaks a full tie on the same root by question id", () => {
    const candidates = [
      ...plain(9),
      candidate("twin", { questionId: "q-b" }),
      candidate("twin", { questionId: "q-a" }),
    ];

    const result = composeExam({ requestedCount: 10, candidates, now });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.find((item) => item.rootId === "twin")).toEqual({
      rootId: "twin",
      questionId: "q-a",
    });
  });

  it("puts every root first when all failed last time", () => {
    const candidates = plain(12).map((c) => ({ ...c, failedLastTime: true }));

    expect(roots(composeExam({ requestedCount: 10, candidates, now }))).toEqual(
      plain(10).map((c) => c.rootId),
    );
  });

  it("is stable regardless of the input order", () => {
    const candidates = plain(15);
    const reversed = [...candidates].reverse();

    expect(
      roots(composeExam({ requestedCount: 10, candidates: reversed, now })),
    ).toEqual(roots(composeExam({ requestedCount: 10, candidates, now })));
  });

  it("returns one question per root", () => {
    const candidates = [
      ...plain(10),
      candidate("r-00", { questionId: "q-zz" }),
    ];

    const result = composeExam({ requestedCount: 30, candidates, now });

    expect(roots(result)).toHaveLength(10);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ rootId: "r-00", questionId: "q-r-00" });
  });
});

describe("composeRetake", () => {
  const failedRootIds = ["r-02", "r-07"];
  const variantsByRoot = new Map([
    ["r-02", "v-02"],
    ["r-07", "v-07"],
  ]);
  const shownQuestionIds = ["q-r-02", "q-r-07"];

  it("puts one fresh variant per failed root first, then the rest in exam order", () => {
    const otherCandidates = [
      ...plain(12),
      candidate("due", { dueAt: day(-3) }),
    ];

    const result = composeRetake({
      requestedCount: 10,
      failedRootIds,
      variantsByRoot,
      shownQuestionIds,
      otherCandidates,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(10);
    expect(result.value.slice(0, 3)).toEqual([
      { rootId: "r-02", questionId: "v-02" },
      { rootId: "r-07", questionId: "v-07" },
      { rootId: "due", questionId: "q-due" },
    ]);
    // The failed roots never come back with another question.
    const rootIds = result.value.map((item) => item.rootId);
    expect(new Set(rootIds).size).toBe(10);
  });

  it("caps the rest at the requested count", () => {
    const result = composeRetake({
      requestedCount: 12,
      failedRootIds,
      variantsByRoot,
      shownQuestionIds,
      otherCandidates: plain(40),
      now,
    });

    expect(result.ok && result.value.length).toBe(12);
  });

  it("returns every failed root when the requested count equals them", () => {
    const many = plain(10).map((c) => c.rootId);
    const result = composeRetake({
      requestedCount: 10,
      failedRootIds: many,
      variantsByRoot: new Map(many.map((id) => [id, `v-${id}`])),
      shownQuestionIds: [],
      otherCandidates: plain(10),
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.questionId)).toEqual(
      many.map((id) => `v-${id}`),
    );
  });

  it("blocks the retake when a failed root has no variant", () => {
    expect(
      errorCode(
        composeRetake({
          requestedCount: 10,
          failedRootIds,
          variantsByRoot: new Map([["r-02", "v-02"]]),
          shownQuestionIds,
          otherCandidates: plain(12),
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.RETAKE_VARIANT_MISSING);
  });

  it("blocks the retake when a variant is the wording already shown", () => {
    expect(
      errorCode(
        composeRetake({
          requestedCount: 10,
          failedRootIds,
          variantsByRoot: new Map([
            ["r-02", "v-02"],
            ["r-07", "q-r-07"],
          ]),
          shownQuestionIds,
          otherCandidates: plain(12),
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.RETAKE_VARIANT_MISSING);
  });

  it("refuses a retake without failed roots", () => {
    expect(
      errorCode(
        composeRetake({
          requestedCount: 10,
          failedRootIds: [],
          variantsByRoot: new Map(),
          shownQuestionIds: [],
          otherCandidates: plain(12),
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.NO_RETAKE_PENDING);
  });

  it.each([9, 31])("refuses N = %i", (requestedCount) => {
    expect(
      errorCode(
        composeRetake({
          requestedCount,
          failedRootIds,
          variantsByRoot,
          shownQuestionIds,
          otherCandidates: plain(40),
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.INVALID_QUESTION_COUNT);
  });

  it("refuses N below the number of failed roots", () => {
    const many = plain(12).map((c) => c.rootId);

    expect(
      errorCode(
        composeRetake({
          requestedCount: 10,
          failedRootIds: many,
          variantsByRoot: new Map(many.map((id) => [id, `v-${id}`])),
          shownQuestionIds: [],
          otherCandidates: [],
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.INVALID_QUESTION_COUNT);
  });

  it("refuses a page with fewer than 10 roots in total", () => {
    expect(
      errorCode(
        composeRetake({
          requestedCount: 10,
          failedRootIds,
          variantsByRoot,
          shownQuestionIds,
          // r-02 and r-07 are failed roots: 9 distinct roots in total.
          otherCandidates: plain(9),
          now,
        }),
      ),
    ).toBe(EXAM_ERROR.NOT_ENOUGH_QUESTIONS);
  });
});
