import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { KpiRow } from "./kpi-row";

function tile(label: string): HTMLElement {
  const tileEl = screen.getByText(label).closest("[data-slot=card]");
  if (!(tileEl instanceof HTMLElement)) throw new Error(`no tile for ${label}`);
  return tileEl;
}

describe("KpiRow", () => {
  it("shows the three §3.6 KPIs: streak, due items and mastered pages", () => {
    render(<KpiRow kpis={sampleView().kpis} />);

    expect(
      within(tile("Racha de repasos")).getByText("4 días"),
    ).toBeInTheDocument();
    expect(within(tile("Ítems vencidos")).getByText("5")).toBeInTheDocument();
    expect(
      within(tile("Páginas dominadas")).getByText("1"),
    ).toBeInTheDocument();
  });

  it("signs the streak delta vs. seven days ago as good news", () => {
    render(<KpiRow kpis={sampleView().kpis} />);

    expect(within(tile("Racha de repasos")).getByText("+2")).toHaveClass(
      "bg-success-100",
    );
  });

  it("shows a falling streak as an error", () => {
    const { kpis } = sampleView();
    render(
      <KpiRow kpis={{ ...kpis, streak: { value: "1 día", delta: -3 } }} />,
    );

    expect(within(tile("Racha de repasos")).getByText("−3")).toHaveClass(
      "bg-error-100",
    );
  });

  it("gives due items and mastered pages a context hint instead of a delta", () => {
    render(<KpiRow kpis={sampleView().kpis} />);

    const due = tile("Ítems vencidos");
    expect(within(due).getByText("en 2 páginas")).toBeInTheDocument();
    expect(due.querySelector(".rounded-pill")).toBeNull();
    const mastered = tile("Páginas dominadas");
    expect(within(mastered).getByText("de 4 páginas")).toBeInTheDocument();
    expect(mastered.querySelector(".rounded-pill")).toBeNull();
  });

  it("points each detail button at its destination", () => {
    render(<KpiRow kpis={sampleView().kpis} />);

    const links = screen.getAllByRole("link", { name: /Ver detalle/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/",
      "/notebooks",
      "/notebooks",
    ]);
  });
});
