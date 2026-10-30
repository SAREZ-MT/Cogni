import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueChip } from "./technique-chip";

describe("TechniqueChip", () => {
  it("renders a span with its title over its subline when it has no href", () => {
    render(
      <TechniqueChip
        data-testid="chip"
        tone="yellow"
        label="Mitocondria"
        meta="Biología celular"
        className="extra"
      />,
    );

    const chip = screen.getByTestId("chip");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("data-slot", "technique-chip");
    expect(chip).toHaveAttribute("data-tone", "yellow");
    expect(chip.querySelector('[data-part="label"]')).toHaveTextContent(
      "Mitocondria",
    );
    expect(chip.querySelector('[data-part="meta"]')).toHaveTextContent(
      "Biología celular",
    );
    expect(chip).toHaveClass("extra");
  });

  it("renders a link to its href, keeping a caller-supplied accessible name", () => {
    render(
      <TechniqueChip
        tone="rose"
        label="Mitocondria"
        href="/notebooks/n1/pages/p1"
        aria-label="Examen de Mitocondria: 2 ítems"
      />,
    );

    const link = screen.getByRole("link", {
      name: "Examen de Mitocondria: 2 ítems",
    });
    expect(link).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(link).toHaveAttribute("data-slot", "technique-chip");
  });

  // Calendar review chip (user review 2026-10-19): no fill, black title,
  // muted notebook subline, a thin grey border, small radius and the
  // technique accent bar on the left.
  it.each([
    ["yellow", "bg-technique-flashcards-accent"],
    ["green", "bg-technique-recall-accent"],
    ["rose", "bg-technique-exam-accent"],
  ] as const)("draws a %s chip as an outlined card with the accent bar", (tone, accent) => {
    render(
      <TechniqueChip
        data-testid="chip"
        tone={tone}
        label="x"
        meta="Cuaderno"
      />,
    );

    const chip = screen.getByTestId("chip");
    expect(chip).toHaveClass("border", "border-border-default", "rounded-sm");
    expect(chip.className).not.toMatch(/(^|\s)bg-pastel-/);
    expect(chip.querySelector('[data-part="label"]')).toHaveClass("text-fg");
    expect(chip.querySelector('[data-part="meta"]')).toHaveClass(
      "text-fg-muted",
    );
    const bar = chip.querySelector('[data-part="accent"]');
    expect(bar).toHaveClass(accent, "w-[3px]");
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("clamps the title to two lines by default and to one truncated line when compact", () => {
    const { rerender } = render(
      <TechniqueChip data-testid="chip" tone="green" label="Recall" />,
    );
    const label = () =>
      screen.getByTestId("chip").querySelector('[data-part="label"]');
    expect(label()).toHaveClass("line-clamp-2");
    rerender(
      <TechniqueChip data-testid="chip" tone="green" label="Recall" compact />,
    );
    expect(label()).toHaveClass("truncate");
    expect(label()).not.toHaveClass("line-clamp-2");
  });

  it("omits the meta slot when no meta is given", () => {
    render(<TechniqueChip data-testid="chip" tone="green" label="Recall" />);

    expect(
      screen.getByTestId("chip").querySelector('[data-part="meta"]'),
    ).toBeNull();
  });

  // Narrow month grid (Phase 7 T2): inside a narrow container the chip
  // collapses to a coloured dot in the technique's strong hue; its text
  // stays readable for assistive tech and the accent bar disappears.
  it("collapses to a dot in a narrow container when asked, keeping its text for screen readers", () => {
    render(
      <TechniqueChip
        data-testid="chip"
        tone="green"
        label="Mitosis"
        collapse="dot-when-narrow"
        compact
      />,
    );

    const chip = screen.getByTestId("chip");
    expect(chip).toHaveAttribute("data-collapse", "dot-when-narrow");
    // The dot takes the technique accent (the chip has no fill of its own).
    expect(chip).toHaveClass(
      "@max-2xl:size-2.5",
      "@max-2xl:bg-technique-recall-accent",
    );
    expect(chip.querySelector("[data-part='label']")).toHaveClass(
      "@max-2xl:sr-only",
    );
    expect(chip.querySelector("[data-part='accent']")).toHaveClass(
      "@max-2xl:hidden",
    );
    expect(chip).toHaveTextContent("Mitosis");
  });

  it("never collapses by default", () => {
    render(<TechniqueChip data-testid="chip" tone="green" label="x" />);
    expect(screen.getByTestId("chip")).not.toHaveAttribute("data-collapse");
    expect(screen.getByTestId("chip")).not.toHaveClass("@max-2xl:size-2.5");
  });
});
