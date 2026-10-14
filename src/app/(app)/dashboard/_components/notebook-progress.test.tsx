import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { NotebookProgress } from "./notebook-progress";

function row(title: string): HTMLElement {
  return screen.getByRole("link", { name: new RegExp(title) });
}

function renderRows() {
  return render(<NotebookProgress rows={sampleView().notebooks} />);
}

describe("NotebookProgress", () => {
  it("lists every notebook linking to it", () => {
    renderRows();

    expect(row("Biología")).toHaveAttribute("href", "/notebooks/nb-cel");
    expect(row("Historia")).toHaveAttribute("href", "/notebooks/nb-hist");
  });

  it("shows items, due items and the mastery level of each notebook", () => {
    renderRows();

    const bio = within(row("Biología"));
    expect(bio.getByText("30 ítems · 2 vencidos")).toBeInTheDocument();
    expect(bio.getByText("Consolidando")).toBeInTheDocument();
    const hist = within(row("Historia"));
    expect(hist.getByText("10 ítems · 3 vencidos")).toBeInTheDocument();
    expect(hist.getByText("Aprendiendo")).toBeInTheDocument();
  });

  it("tones each level pill by mastery level", () => {
    renderRows();

    expect(within(row("Biología")).getByText("Consolidando")).toHaveClass(
      "bg-info-100",
    );
    expect(within(row("Historia")).getByText("Aprendiendo")).toHaveClass(
      "bg-warning-100",
    );
  });

  it("shows no week-over-week trend arrow (no mastery history)", () => {
    renderRows();

    for (const title of ["Biología", "Historia"]) {
      expect(row(title).querySelector(".lucide-arrow-up")).toBeNull();
      expect(row(title).querySelector(".lucide-arrow-down")).toBeNull();
    }
  });

  it("offers a link to the full notebook list", () => {
    renderRows();

    expect(screen.getByRole("link", { name: /Ver cuadernos/ })).toHaveAttribute(
      "href",
      "/notebooks",
    );
  });
});
