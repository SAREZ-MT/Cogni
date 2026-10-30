import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewRow } from "../../calendario/_lib/today-rows";
import { ReviewToday } from "./review-today";

const ROW: ReviewRow = {
  key: "p-1:flashcard",
  kind: "flashcard",
  tone: "yellow",
  techniqueLabel: "Flashcards",
  count: 2,
  pageTitle: "Mitosis",
  notebookTitle: "Biología",
  notebookTone: "green",
  href: "/flashcards/p-1",
  ariaLabel: "Repasar Flashcards de Mitosis",
};

describe("ReviewToday layout", () => {
  // The tiles' 3px focus ring and 1px hover lift sit outside their box; the
  // scrolling list must leave room for them instead of clipping them.
  it("gives the scrolling list room for the tiles' focus rings", () => {
    render(<ReviewToday rows={[ROW]} />);
    const list = screen.getByRole("list");
    expect(list.className).toMatch(/(^|\s)-m-1(\s|$)/);
    expect(list.className).toMatch(/(^|\s)p-1(\s|$)/);
    expect(list.className).toContain("overflow-y-auto");
  });

  // On wide screens the card has the column's fixed height: only the list
  // scrolls, nothing else may spill out of the card.
  it("keeps everything but the list inside the card on wide screens", () => {
    render(<ReviewToday rows={[ROW]} />);
    const section = screen.getByRole("region", { name: "Repasar hoy" });
    expect(section.className).toContain("lg:overflow-hidden");
    const heading = screen.getByRole("heading", { name: "Repasar hoy" });
    expect(heading.className).toContain("shrink-0");
  });
});
