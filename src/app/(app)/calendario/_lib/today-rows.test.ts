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

import { toReviewRows } from "./today-rows";

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

describe("toReviewRows", () => {
  it("splits each page into one row per technique due, keeping the page order", () => {
    const rows = toReviewRows([
      due("b", { flashcard: 2, exam: 1 }, "pink"),
      due("a", { recall: 1 }, null),
    ]);

    expect(rows).toEqual([
      {
        key: "b:flashcard",
        kind: "flashcard",
        tone: "yellow",
        techniqueLabel: "Flashcards",
        count: 2,
        pageTitle: "Página b",
        notebookTitle: "Biología",
        notebookTone: "pink",
        href: "/flashcards/n1/b?repasar=1",
        ariaLabel: "Repasar Flashcards de Página b: 2 pendientes",
      },
      {
        key: "b:exam_question",
        kind: "exam_question",
        tone: "rose",
        techniqueLabel: "Examen",
        count: 1,
        pageTitle: "Página b",
        notebookTitle: "Biología",
        notebookTone: "pink",
        href: "/exams/n1/b",
        ariaLabel: "Repasar Examen de Página b: 1 pendiente",
      },
      {
        key: "a:recall_question",
        kind: "recall_question",
        tone: "green",
        techniqueLabel: "Recordación activa",
        count: 1,
        pageTitle: "Página a",
        notebookTitle: "Biología",
        notebookTone: "purple",
        href: "/active-recall/n1/a",
        ariaLabel: "Repasar Recordación activa de Página a: 1 pendiente",
      },
    ]);
  });

  it("returns no rows when nothing is due", () => {
    expect(toReviewRows([])).toEqual([]);
  });
});
