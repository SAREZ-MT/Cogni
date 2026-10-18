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
        },
        exam_question: {
          total: 10,
          nextDueAt: null,
          duePageIds: ["p-1"],
          reviewedPageIds: [],
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
        },
      }),
    );

    expect(overview.flashcard).toMatchObject({ pendingUnits: 1, doneUnits: 1 });
  });
});
