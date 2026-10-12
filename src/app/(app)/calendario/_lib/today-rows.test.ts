import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/notebooks", () => ({
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
}));

import { toTodayRows } from "./today-rows";

function due(
  pageId: string,
  counts: { flashcard?: number; exam?: number; recall?: number },
  notebookColor: string | null = "green",
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "n1",
    notebookTitle: "Biología",
    notebookColor,
    due: {
      flashcard: counts.flashcard ?? 0,
      exam_question: counts.exam ?? 0,
      recall_question: counts.recall ?? 0,
    },
    earliestDueAt: new Date("2026-10-12T08:00:00.000Z"),
  };
}

describe("toTodayRows", () => {
  it("keeps the pages in the order scheduling returned them", () => {
    const rows = toTodayRows([
      due("b", { flashcard: 1 }),
      due("a", { exam: 1 }),
    ]);

    expect(rows.map((row) => row.pageId)).toEqual(["b", "a"]);
  });

  it("builds one chip per technique with items due, in the panel's order and colours", () => {
    const [row] = toTodayRows([
      due("p1", { flashcard: 2, exam: 1, recall: 3 }),
    ]);

    expect(row?.chips).toEqual([
      {
        kind: "flashcard",
        tone: "yellow",
        label: "Flashcards",
        count: 2,
        href: "/flashcards/n1/p1?repasar=1",
        ariaLabel: "Flashcards de Página p1: 2 pendientes",
      },
      {
        kind: "recall_question",
        tone: "green",
        label: "Recordación activa",
        count: 3,
        href: "/active-recall/n1/p1",
        ariaLabel: "Recordación activa de Página p1: 3 pendientes",
      },
      {
        kind: "exam_question",
        tone: "rose",
        label: "Examen",
        count: 1,
        href: "/exams/n1/p1",
        ariaLabel: "Examen de Página p1: 1 pendiente",
      },
    ]);
    expect(row?.totalDue).toBe(6);
  });

  it("leaves out a technique with nothing due", () => {
    const [row] = toTodayRows([due("p1", { recall: 1 })]);

    expect(row?.chips.map((chip) => chip.kind)).toEqual(["recall_question"]);
  });

  it("carries the notebook colour, falling back to purple for a legacy or unknown one", () => {
    const rows = toTodayRows([
      due("a", { flashcard: 1 }, "mint"),
      due("b", { flashcard: 1 }, null),
      due("c", { flashcard: 1 }, "teal"),
    ]);

    expect(rows.map((row) => row.notebookTone)).toEqual([
      "mint",
      "purple",
      "purple",
    ]);
    expect(rows[0]).toMatchObject({
      pageTitle: "Página a",
      notebookTitle: "Biología",
    });
  });
});
