import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MonthDayPanelView } from "../_lib/calendar-view";
import { MonthDayPanel } from "./month-day-panel";

const ROW = {
  key: "2026-10-20:a:exam_question",
  tone: "rose" as const,
  techniqueLabel: "Examen",
  title: "Independencias del siglo XIX",
  detail: "Historia de América Latina",
  href: "/notebooks/n1/pages/a",
  ariaLabel: "Examen de Independencias del siglo XIX: 2 ítems",
};

const PANEL: MonthDayPanelView = {
  title: "Martes 20 de octubre",
  summary: "1 repaso programado",
  rows: [ROW],
  upcoming: [
    {
      ...ROW,
      key: "2026-10-22:b:flashcard",
      tone: "yellow",
      techniqueLabel: "Flashcards",
      ariaLabel: "Flashcards de Enlaces: 1 ítem",
    },
  ],
};

describe("MonthDayPanel", () => {
  it("heads with the selected day and lists its reviews as fixed cards", () => {
    render(<MonthDayPanel panel={PANEL} />);

    const panel = screen.getByRole("region", { name: "Martes 20 de octubre" });
    expect(panel).toHaveTextContent("1 repaso programado");
    const day = within(panel).getByRole("list", { name: "Repasos del día" });
    expect(within(day).getAllByRole("link")).toHaveLength(1);
    expect(
      within(day).getByRole("link", {
        name: "Examen de Independencias del siglo XIX: 2 ítems",
      }),
    ).toHaveAttribute("data-slot", "calendar-review-card");
  });

  it("lists the next seven days after a divider with their count", () => {
    render(<MonthDayPanel panel={PANEL} />);

    const next = screen.getByRole("region", { name: "Próximos repasos · 1" });
    expect(
      within(next).getByRole("link", { name: "Flashcards de Enlaces: 1 ítem" }),
    ).toBeInTheDocument();
  });

  it("says when nothing is coming in the next seven days", () => {
    render(
      <MonthDayPanel
        panel={{ ...PANEL, rows: [], summary: "Sin repasos", upcoming: [] }}
      />,
    );
    expect(screen.getByText("Nada en los próximos 7 días")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Repasos del día" })).toBeNull();
  });
});
