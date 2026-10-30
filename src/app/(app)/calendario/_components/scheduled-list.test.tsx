import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The empty-state copy lives with the view model, which imports the
// scheduling index (its Server Actions import server-only).
vi.mock("server-only", () => ({}));

import type { ScheduledRow } from "../_lib/today-list-rows";
import { ScheduledList } from "./scheduled-list";

const ROW: ScheduledRow = {
  key: "p1:flashcard",
  tone: "yellow",
  techniqueLabel: "Flashcards",
  pageTitle: "Mitocondria",
  notebookTitle: "Biología",
  href: "/notebooks/n1/pages/p1",
  ariaLabel: "Flashcards de Mitocondria: 8 programados",
  amountLabel: "8 tarjetas",
};

describe("ScheduledList", () => {
  it("lists a later day's reviews as scheduled rows opening the page", () => {
    render(<ScheduledList rows={[ROW]} weekHref="/w" />);

    const row = screen.getByTestId("scheduled-row");
    expect(row).toHaveAccessibleName(
      "Flashcards de Mitocondria: 8 programados",
    );
    expect(row).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(row).toHaveAttribute("data-mode", "scheduled");
    expect(row).toHaveTextContent("Programado");
    expect(screen.queryByText("Repasar")).toBeNull();
    expect(screen.queryByText(/hechos hoy/)).toBeNull();
  });

  it("shows the illustrated free-day state, linking to its week", () => {
    render(
      <ScheduledList
        rows={[]}
        weekHref="/calendario?view=semana&date=2026-10-20"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Día libre de repasos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la semana" })).toHaveAttribute(
      "href",
      "/calendario?view=semana&date=2026-10-20",
    );
    expect(screen.queryByTestId("scheduled-row")).toBeNull();
  });

  it("says the day could not load", () => {
    render(<ScheduledList rows={null} weekHref="/w" />);
    expect(
      screen.getByText(
        "No pudimos cargar los repasos de este día. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
  });
});
