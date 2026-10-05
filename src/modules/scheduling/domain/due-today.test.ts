import { describe, expect, it } from "vitest";
import {
  compareDueTodayPages,
  DUE_KINDS,
  type DueTodayPage,
  emptyDueCounts,
} from "./due-today";

const page = (pageId: string, earliestDueAt: string): DueTodayPage => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: "n1",
  notebookTitle: "Biología",
  notebookColor: "green",
  due: { ...emptyDueCounts(), flashcard: 1 },
  earliestDueAt: new Date(earliestDueAt),
});

describe("due today", () => {
  it("starts every technique at zero due items", () => {
    expect(emptyDueCounts()).toEqual({
      flashcard: 0,
      exam_question: 0,
      recall_question: 0,
    });
    expect(Object.keys(emptyDueCounts())).toEqual([...DUE_KINDS]);
  });

  it("orders the page that has waited longest first, then by page id", () => {
    const pages = [
      page("b", "2026-10-04T09:00:00.000Z"),
      page("c", "2026-10-03T09:00:00.000Z"),
      page("a", "2026-10-04T09:00:00.000Z"),
    ];
    expect(pages.sort(compareDueTodayPages).map((p) => p.pageId)).toEqual([
      "c",
      "a",
      "b",
    ]);
    const [first] = pages as [DueTodayPage];
    expect(compareDueTodayPages(first, first)).toBe(0);
  });
});
