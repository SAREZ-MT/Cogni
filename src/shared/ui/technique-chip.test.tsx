import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueChip } from "./technique-chip";

describe("TechniqueChip", () => {
  it("renders a span with its label and trailing meta when it has no href", () => {
    render(
      <TechniqueChip
        data-testid="chip"
        tone="yellow"
        label="Flashcards"
        meta="3"
        className="extra"
      />,
    );

    const chip = screen.getByTestId("chip");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("data-slot", "technique-chip");
    expect(chip).toHaveAttribute("data-tone", "yellow");
    expect(chip).toHaveTextContent("Flashcards3");
    expect(chip).toHaveClass("extra");
  });

  it("renders a link to its href, keeping a caller-supplied accessible name", () => {
    render(
      <TechniqueChip
        tone="rose"
        label="Examen"
        meta="2"
        href="/exams/n1/p1"
        aria-label="Examen de Mitocondria, 2 pendientes"
      />,
    );

    const link = screen.getByRole("link", {
      name: "Examen de Mitocondria, 2 pendientes",
    });
    expect(link).toHaveAttribute("href", "/exams/n1/p1");
    expect(link).toHaveAttribute("data-slot", "technique-chip");
  });

  // Same pastel pairs as the techniques panel (TechniqueCard): Flashcards
  // yellow, Recordación activa green (mint pair), Examen rose (pink pair).
  it.each([
    ["yellow", "bg-pastel-yellow", "text-pastel-yellow-fg"],
    ["green", "bg-pastel-mint", "text-pastel-mint-fg"],
    ["rose", "bg-pastel-pink", "text-pastel-pink-fg"],
  ] as const)("colours a %s chip with the technique's pastel pair", (tone, bg, fg) => {
    render(<TechniqueChip data-testid="chip" tone={tone} label="x" />);

    expect(screen.getByTestId("chip")).toHaveClass(bg, fg);
  });

  it("omits the meta slot when no meta is given", () => {
    render(<TechniqueChip data-testid="chip" tone="green" label="Recall" />);

    expect(
      screen.getByTestId("chip").querySelector('[data-part="meta"]'),
    ).toBeNull();
  });
});
