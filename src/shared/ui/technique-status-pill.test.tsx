import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueStatusPill } from "./technique-status-pill";

describe("TechniqueStatusPill", () => {
  // Status-pill look (reference "● Pendiente / ● Conectado / ● Error"):
  // the technique's pastel background, a dot in its accent and dark text
  // in the same hue.
  it.each([
    [
      "yellow",
      "bg-pastel-yellow",
      "text-pastel-yellow-fg",
      "bg-technique-flashcards-accent",
    ],
    [
      "green",
      "bg-pastel-mint",
      "text-pastel-mint-fg",
      "bg-technique-recall-accent",
    ],
    [
      "rose",
      "bg-pastel-pink",
      "text-pastel-pink-fg",
      "bg-technique-exam-accent",
    ],
  ] as const)("renders a %s pill with its pastel pair and an accent dot", (tone, bg, fg, dot) => {
    render(<TechniqueStatusPill tone={tone}>Flashcards</TechniqueStatusPill>);

    const pill = screen
      .getByText("Flashcards")
      .closest('[data-slot="technique-status-pill"]');
    expect(pill).toHaveClass(bg, fg, "rounded-full", "text-xs");
    expect(pill).toHaveAttribute("data-tone", tone);
    const marker = pill?.querySelector('[data-part="dot"]');
    expect(marker).toHaveClass(dot);
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("has a smaller size for tight spaces", () => {
    render(
      <TechniqueStatusPill tone="green" size="sm">
        Recordación activa
      </TechniqueStatusPill>,
    );
    const pill = screen
      .getByText("Recordación activa")
      .closest('[data-slot="technique-status-pill"]');
    expect(pill).toHaveAttribute("data-size", "sm");
    expect(pill).toHaveClass("text-[11px]", "py-0");
  });
});
