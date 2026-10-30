import { describe, expect, it } from "vitest";
import {
  emptyTechniqueSnapshot,
  type TechniqueSnapshot,
  toTechniqueOverview,
} from "./technique-overview";

function snapshot(partial: Partial<TechniqueSnapshot>): TechniqueSnapshot {
  return { ...emptyTechniqueSnapshot(), ...partial };
}

describe("toTechniqueOverview (study units today, H2-T5i)", () => {
  it("counts a page with items due today as one pending unit, however many items it holds", () => {
    const overview = toTechniqueOverview(
      snapshot({
        flashcard: {
          total: 20,
          nextDueAt: null,
          duePageIds: ["p-1"],
          reviewedPageIds: [],
          completedPageIds: [],
        },
      }),
    );

    expect(overview.flashcard).toEqual({
      total: 20,
      nextDueAt: null,
      pendingUnits: 1,
      doneUnits: 0,
    });
  });

  it("counts a page reviewed today with nothing left due as done", () => {
    const overview = toTechniqueOverview(
      snapshot({
        exam_question: {
          total: 60,
          nextDueAt: null,
          duePageIds: ["p-2", "p-3"],
          reviewedPageIds: ["p-1"],
          completedPageIds: [],
        },
      }),
    );

    expect(overview.exam_question.pendingUnits).toBe(2);
    expect(overview.exam_question.doneUnits).toBe(1);
  });

  it("keeps a partially reviewed page pending only, never done", () => {
    const overview = toTechniqueOverview(
      snapshot({
        recall_question: {
          total: 8,
          nextDueAt: null,
          duePageIds: ["p-1"],
          reviewedPageIds: ["p-1"],
          completedPageIds: [],
        },
      }),
    );

    expect(overview.recall_question.pendingUnits).toBe(1);
    expect(overview.recall_question.doneUnits).toBe(0);
  });

  it("counts two techniques of one page independently", () => {
    const overview = toTechniqueOverview(
      snapshot({
        flashcard: {
          total: 5,
          nextDueAt: null,
          duePageIds: [],
          reviewedPageIds: ["p-1"],
          completedPageIds: [],
        },
        exam_question: {
          total: 10,
          nextDueAt: null,
          duePageIds: ["p-1"],
          reviewedPageIds: [],
          completedPageIds: [],
        },
      }),
    );

    expect(overview.flashcard).toMatchObject({ pendingUnits: 0, doneUnits: 1 });
    expect(overview.exam_question).toMatchObject({
      pendingUnits: 1,
      doneUnits: 0,
    });
    expect(overview.recall_question).toEqual({
      total: 0,
      nextDueAt: null,
      pendingUnits: 0,
      doneUnits: 0,
    });
  });

  it("counts a page listed twice only once", () => {
    const overview = toTechniqueOverview(
      snapshot({
        flashcard: {
          total: 3,
          nextDueAt: null,
          duePageIds: ["p-1", "p-1"],
          reviewedPageIds: ["p-2", "p-2"],
          completedPageIds: [],
        },
      }),
    );

    expect(overview.flashcard).toMatchObject({ pendingUnits: 1, doneUnits: 1 });
  });

  // User decision 2026-10-18 (H2-T6): an exam serves 10–30 questions, so a
  // page with more questions due could never finish its exam day. Once an
  // exam session of the page is completed today, the page is done.
  it("counts a page whose exam was completed today as done, even with questions still due", () => {
    const overview = toTechniqueOverview(
      snapshot({
        exam_question: {
          total: 40,
          nextDueAt: null,
          duePageIds: ["p-1", "p-2"],
          reviewedPageIds: ["p-1"],
          completedPageIds: ["p-1"],
        },
      }),
    );

    expect(overview.exam_question.pendingUnits).toBe(1);
    expect(overview.exam_question.doneUnits).toBe(1);
  });

  it("counts a completed exam once even without a review log of the page", () => {
    const overview = toTechniqueOverview(
      snapshot({
        exam_question: {
          total: 12,
          nextDueAt: null,
          duePageIds: ["p-1"],
          reviewedPageIds: [],
          completedPageIds: ["p-1", "p-1"],
        },
      }),
    );

    expect(overview.exam_question.pendingUnits).toBe(0);
    expect(overview.exam_question.doneUnits).toBe(1);
  });
});
