import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotebookProgress } from "./notebook-progress";

function row(title: string): HTMLElement {
  const link = screen.getByRole("link", { name: new RegExp(title) });
  return link;
}

describe("NotebookProgress", () => {
  it("lists every notebook linking to it", () => {
    render(<NotebookProgress />);

    expect(row("Biología Celular")).toHaveAttribute(
      "href",
      "/notebooks/biologia-celular",
    );
    expect(row("Cálculo III")).toHaveAttribute(
      "href",
      "/notebooks/calculo-iii",
    );
    expect(row("Historia del Arte")).toHaveAttribute(
      "href",
      "/notebooks/historia-del-arte",
    );
  });

  it("shows items, due items and the mastery level of each notebook", () => {
    render(<NotebookProgress />);

    const bio = within(row("Biología Celular"));
    expect(bio.getByText("114 ítems · 20 vencidos")).toBeInTheDocument();
    expect(bio.getByText("Consolidando")).toBeInTheDocument();

    const calc = within(row("Cálculo III"));
    expect(calc.getByText("102 ítems · 14 vencidos")).toBeInTheDocument();
    expect(calc.getByText("Dominado")).toBeInTheDocument();

    const hist = within(row("Historia del Arte"));
    expect(hist.getByText("60 ítems · 28 vencidos")).toBeInTheDocument();
    expect(hist.getByText("Aprendiendo")).toBeInTheDocument();
  });

  it("shows each notebook's one-week trend", () => {
    render(<NotebookProgress />);

    expect(within(row("Biología Celular")).getByText("2")).toBeInTheDocument();
    expect(within(row("Historia del Arte")).getByText("4")).toBeInTheDocument();
    expect(within(row("Cálculo III")).getByText("0")).toBeInTheDocument();
  });

  it("tones each level pill by mastery level", () => {
    render(<NotebookProgress />);

    expect(
      within(row("Biología Celular")).getByText("Consolidando"),
    ).toHaveClass("bg-info-100");
    expect(within(row("Cálculo III")).getByText("Dominado")).toHaveClass(
      "bg-success-100",
    );
    expect(
      within(row("Historia del Arte")).getByText("Aprendiendo"),
    ).toHaveClass("bg-warning-100");
  });

  it("treats a flat week (0 pts) as non-negative: success tone, up arrow", () => {
    render(<NotebookProgress />);

    const flat = within(row("Cálculo III")).getByText("0");
    expect(flat).toHaveClass("text-success-600");
    expect(flat.querySelector("svg")).toHaveClass("lucide-arrow-up");
  });

  it("offers a link to the full notebook list", () => {
    render(<NotebookProgress />);

    expect(screen.getByRole("link", { name: /Ver cuadernos/ })).toHaveAttribute(
      "href",
      "/notebooks",
    );
  });
});
