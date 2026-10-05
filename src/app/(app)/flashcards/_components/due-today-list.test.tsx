import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DueTodayList, type DueTodayRow } from "./due-today-list";

const row = (overrides: Partial<DueTodayRow> = {}): DueTodayRow => ({
  pageId: "p1",
  pageTitle: "Mitosis",
  notebookId: "n1",
  notebookTitle: "Biología",
  tone: "green",
  dueCount: 3,
  ...overrides,
});

describe("DueTodayList", () => {
  it("lists each due page with its notebook, due count and a Repasar link into its session", () => {
    render(
      <DueTodayList
        rows={[
          row(),
          row({
            pageId: "p2",
            pageTitle: "Derivadas",
            notebookId: "n2",
            notebookTitle: "Cálculo",
            tone: "purple",
            dueCount: 1,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Repasos de hoy" }),
    ).toBeInTheDocument();
    const rows = screen.getAllByTestId("due-today-row");
    expect(rows).toHaveLength(2);
    const [firstRow, secondRow] = rows as [HTMLElement, HTMLElement];

    const first = within(firstRow);
    expect(first.getByText("Mitosis")).toBeInTheDocument();
    expect(first.getByText("Biología")).toBeInTheDocument();
    expect(first.getByText("3 pendientes")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /Repasar/ })).toHaveAttribute(
      "href",
      "/flashcards/n1/p1?repasar=1",
    );

    const second = within(secondRow);
    expect(second.getByText("1 pendiente")).toBeInTheDocument();
    expect(second.getByRole("link", { name: /Repasar/ })).toHaveAttribute(
      "href",
      "/flashcards/n2/p2?repasar=1",
    );
  });

  it("names the page in each Repasar link for screen readers", () => {
    render(<DueTodayList rows={[row()]} />);
    expect(
      screen.getByRole("link", { name: "Repasar Mitosis" }),
    ).toBeInTheDocument();
  });

  it("shows the all-caught-up state when nothing is due", () => {
    render(<DueTodayList rows={[]} />);
    expect(screen.getByText("Estás al día")).toBeInTheDocument();
    expect(
      screen.getByText(/No tienes tarjetas pendientes hoy/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("due-today-row")).not.toBeInTheDocument();
  });

  it("says the list could not load instead of claiming you are up to date", () => {
    render(<DueTodayList rows={null} />);
    expect(
      screen.getByText(
        "No pudimos cargar tus repasos de hoy. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estás al día")).not.toBeInTheDocument();
  });
});
