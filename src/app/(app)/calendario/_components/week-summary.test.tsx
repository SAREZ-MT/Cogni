import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TechniqueProgressView } from "../_lib/calendar-view";
import { WeekSummary } from "./week-summary";

const PROGRESS: TechniqueProgressView[] = [
  { tone: "yellow", label: "Flashcards", done: 2, total: 5, percent: 40 },
  { tone: "green", label: "Recordación activa", done: 0, total: 0, percent: 0 },
  { tone: "rose", label: "Examen", done: 1, total: 4, percent: 25 },
];

describe("WeekSummary", () => {
  it("is one card titled Progreso de la semana with a ring per technique", () => {
    render(<WeekSummary progress={PROGRESS} />);

    const card = screen.getByRole("region", { name: "Progreso de la semana" });
    expect(card).toHaveAttribute("data-testid", "week-metrics");
    expect(card).toHaveAttribute("data-slot", "card");
    const rings = within(card).getByRole("list", {
      name: "Progreso de la semana",
    });
    const items = within(rings).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Flashcards: 2 de 5 repasos (40%)");
    expect(items[1]).toHaveTextContent(
      "Recordación activa: sin repasos esta semana",
    );
  });

  it("no longer counts the week's scheduled reviews", () => {
    render(<WeekSummary progress={PROGRESS} />);
    expect(screen.queryByText("Repasos esta semana")).toBeNull();
    expect(screen.queryByTestId("week-units")).toBeNull();
  });

  it("says the progress could not load instead of showing rings", () => {
    render(<WeekSummary progress={null} />);

    expect(
      screen.getByText("No pudimos cargar tu progreso"),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-slot="technique-ring"]')).toBeNull();
  });
});
