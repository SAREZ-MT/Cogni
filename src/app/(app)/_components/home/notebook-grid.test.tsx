import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomeNotebookSummary } from "@/modules/notebooks";
import { NotebookGrid } from "./notebook-grid";

vi.mock("@/modules/notebooks", () => ({
  CreateNotebookTrigger: () => <button type="button">Nuevo cuaderno</button>,
}));

function notebook(
  overrides: Partial<HomeNotebookSummary> = {},
): HomeNotebookSummary {
  return {
    id: "n1",
    title: "Biología Celular",
    icon: null,
    color: "purple",
    pageCount: 8,
    updatedAt: new Date("2026-09-23T10:00:00.000Z"),
    ...overrides,
  };
}

// ui_kits/app/Home Page.html .workspaces-grid: 3-column grid of notebook
// cards (44px pastel icon square, name, page count, time ago) plus the
// dashed "new" tile (CreateNotebookTrigger, tile variant).
describe("NotebookGrid", () => {
  it("links each notebook card to its route with the title and page count", () => {
    render(
      <NotebookGrid
        notebooks={[notebook()]}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    const link = screen.getByRole("link", { name: /Biología Celular/ });
    expect(link).toHaveAttribute("href", "/notebooks/n1");
    expect(screen.getByText("8 páginas")).toBeInTheDocument();
  });

  // Copy nit from the S4 visual pass: "1 páginas" reads wrong.
  it("pluralizes the page count singular", () => {
    render(
      <NotebookGrid
        notebooks={[notebook({ pageCount: 1 })]}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.getByText("1 página")).toBeInTheDocument();
  });

  it("always renders the create-notebook tile as the last item", () => {
    render(<NotebookGrid notebooks={[notebook()]} now={new Date()} />);

    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeInTheDocument();
  });

  it("renders only the create-notebook tile when there are no notebooks", () => {
    render(<NotebookGrid notebooks={[]} now={new Date()} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeInTheDocument();
  });
});
