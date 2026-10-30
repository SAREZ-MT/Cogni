import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The empty-state copy lives with the view model, which imports the
// scheduling index (its Server Actions import server-only).
vi.mock("server-only", () => ({}));

import type { TodayRow } from "../_lib/today-list-rows";
import { TodayList } from "./today-list";

const ROW: TodayRow = {
  key: "p1:flashcard",
  kind: "flashcard",
  tone: "yellow",
  techniqueLabel: "Flashcards",
  count: 8,
  pageTitle: "Mitocondria",
  notebookTitle: "Biología",
  notebookTone: "green",
  href: "/flashcards/n1/p1?repasar=1",
  ariaLabel: "Flashcards de Mitocondria: 8 pendientes",
  amountLabel: "8 tarjetas",
  waiting: { title: "Desde ayer", detail: "1 día esperando" },
};

const EXAM: TodayRow = {
  ...ROW,
  key: "p1:exam_question",
  kind: "exam_question",
  tone: "rose",
  techniqueLabel: "Examen",
  count: 1,
  href: "/exams/n1/p1",
  ariaLabel: "Examen de Mitocondria: 1 pendiente",
  amountLabel: "1 pregunta",
};

describe("TodayList", () => {
  it("lists one linked row per page and technique, oldest wait first", () => {
    render(
      <TodayList
        rows={[ROW, EXAM]}
        progress={null}
        empty={{ kind: "clear", next: null }}
      />,
    );

    const rows = screen.getAllByTestId("today-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(
      "Flashcards de Mitocondria: 8 pendientes",
    );
    expect(rows[0]).toHaveAttribute("href", "/flashcards/n1/p1?repasar=1");
    expect(rows[0]).toHaveTextContent("Desde ayer");
    expect(rows[0]).toHaveTextContent("8 tarjetas");
    expect(rows[1]).toHaveAttribute("href", "/exams/n1/p1");
    expect(
      screen.getByText("Ordenados por el que lleva más tiempo esperando"),
    ).toBeInTheDocument();
  });

  it("shows today's done units in a violet pill", () => {
    render(
      <TodayList
        rows={[ROW]}
        progress={{ label: "1 de 3 hechos hoy" }}
        empty={{ kind: "clear", next: null }}
      />,
    );

    const pill = screen.getByText("1 de 3 hechos hoy");
    expect(pill).toHaveAttribute("data-slot", "pill");
    expect(pill).toHaveClass("bg-primary-100");
  });

  it("hides the progress pill without progress", () => {
    render(
      <TodayList
        rows={[ROW]}
        progress={null}
        empty={{ kind: "clear", next: null }}
      />,
    );
    expect(screen.queryByText(/hechos hoy/)).toBeNull();
  });

  it("shows the illustrated empty state for a clear day, linking to the next review", () => {
    render(
      <TodayList
        rows={[]}
        progress={null}
        empty={{
          kind: "clear",
          next: {
            href: "/calendario?date=2026-10-19",
            label: "Próximo repaso: mañana · 2 repasos",
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Hoy estás al día" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="illustrated-empty-state"] img'),
    ).toHaveAttribute("alt", "");
    expect(
      screen.getByRole("link", { name: "Próximo repaso: mañana · 2 repasos" }),
    ).toHaveAttribute("href", "/calendario?date=2026-10-19");
    expect(screen.queryByTestId("today-row")).toBeNull();
  });

  it("celebrates a finished day and falls back to the week without a next review", () => {
    render(
      <TodayList
        rows={[]}
        progress={null}
        empty={{ kind: "done", next: null }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "¡Terminaste tus repasos de hoy!" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la semana" })).toHaveAttribute(
      "href",
      "/calendario?view=semana",
    );
  });

  it("says the list could not load instead of claiming nothing is due", () => {
    render(
      <TodayList
        rows={null}
        progress={null}
        empty={{ kind: "clear", next: null }}
      />,
    );
    expect(
      screen.getByText(
        "No pudimos cargar tus repasos de hoy. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Hoy estás al día")).toBeNull();
    expect(within(document.body).queryByRole("link")).toBeNull();
  });
});
