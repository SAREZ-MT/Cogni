import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiRow } from "./kpi-row";

function tile(label: string): HTMLElement {
  const tileEl = screen.getByText(label).closest("[data-slot=card]");
  if (!(tileEl instanceof HTMLElement)) throw new Error(`no tile for ${label}`);
  return tileEl;
}

describe("KpiRow", () => {
  it("shows the three §3.6 KPIs: streak, due items and mastered pages", () => {
    render(<KpiRow />);

    expect(
      within(tile("Racha de repasos")).getByText("9 días"),
    ).toBeInTheDocument();
    expect(within(tile("Ítems vencidos")).getByText("62")).toBeInTheDocument();
    expect(
      within(tile("Páginas dominadas")).getByText("7 de 19"),
    ).toBeInTheDocument();
  });

  it("signs the deltas", () => {
    render(<KpiRow />);

    expect(
      within(tile("Racha de repasos")).getByText("+2"),
    ).toBeInTheDocument();
    expect(within(tile("Ítems vencidos")).getByText("−11")).toBeInTheDocument();
    expect(
      within(tile("Páginas dominadas")).getByText("+1"),
    ).toBeInTheDocument();
  });

  it("treats fewer due items as good news (inverted metric)", () => {
    render(<KpiRow />);

    const due = within(tile("Ítems vencidos")).getByText("−11");
    expect(due).toHaveClass("bg-success-100");
    expect(within(tile("Racha de repasos")).getByText("+2")).toHaveClass(
      "bg-success-100",
    );
  });

  it("points each detail button at its destination", () => {
    render(<KpiRow />);

    const links = screen.getAllByRole("link", { name: /Ver detalle/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/",
      "/notebooks",
      "/notebooks",
    ]);
  });
});
