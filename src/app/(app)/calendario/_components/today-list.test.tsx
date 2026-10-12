import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TodayRow } from "../_lib/today-rows";
import { TodayList } from "./today-list";

const ROW: TodayRow = {
  pageId: "p1",
  pageTitle: "Mitocondria",
  notebookTitle: "Biología",
  notebookTone: "green",
  totalDue: 3,
  chips: [
    {
      kind: "flashcard",
      tone: "yellow",
      label: "Flashcards",
      count: 2,
      href: "/flashcards/n1/p1?repasar=1",
      ariaLabel: "Flashcards de Mitocondria: 2 pendientes",
    },
    {
      kind: "exam_question",
      tone: "rose",
      label: "Examen",
      count: 1,
      href: "/exams/n1/p1",
      ariaLabel: "Examen de Mitocondria: 1 pendiente",
    },
  ],
};

describe("TodayList", () => {
  it("lists one row per page with its title, notebook and technique chips", () => {
    render(<TodayList rows={[ROW]} />);

    const row = screen.getByTestId("today-row");
    expect(row).toHaveTextContent("Mitocondria");
    expect(row).toHaveTextContent("Biología");
    const flashcards = within(row).getByRole("link", {
      name: "Flashcards de Mitocondria: 2 pendientes",
    });
    expect(flashcards).toHaveAttribute("href", "/flashcards/n1/p1?repasar=1");
    expect(flashcards).toHaveAttribute("data-tone", "yellow");
    expect(flashcards).toHaveTextContent("Flashcards2");
    expect(
      within(row).getByRole("link", {
        name: "Examen de Mitocondria: 1 pendiente",
      }),
    ).toHaveAttribute("href", "/exams/n1/p1");
  });

  it("colours the page's icon tile with its notebook colour", () => {
    render(<TodayList rows={[ROW]} />);

    expect(
      screen.getByTestId("today-row").querySelector('[data-slot="icon-tile"]'),
    ).toHaveClass("bg-pastel-green");
  });

  it("says the user is up to date when nothing is due", () => {
    render(<TodayList rows={[]} />);

    expect(screen.getByText("Estás al día")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No tienes repasos pendientes hoy. Vuelve cuando toque repasar.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("today-row")).toBeNull();
  });

  it("says the list could not load instead of claiming nothing is due", () => {
    render(<TodayList rows={null} />);

    expect(
      screen.getByText(
        "No pudimos cargar tus repasos de hoy. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estás al día")).toBeNull();
  });
});
