import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

// Phase 8 H12 (user 2026-10-29): dialog primary actions are never the dark
// default: violet "brand" in general, the technique colour inside a
// `data-technique-theme` element.
describe("Button", () => {
  it("brand paints the Cogni violet with white text", () => {
    render(<Button variant="brand">Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });

    expect(button).toHaveAttribute("data-variant", "brand");
    expect(button.className).toContain("bg-primary-600");
    expect(button.className).toContain("text-white");
    expect(button.className).not.toContain("bg-primary ");
  });

  it("technique paints the theme's CTA fill and ink", () => {
    render(<Button variant="technique">Generar</Button>);
    const button = screen.getByRole("button", { name: "Generar" });

    expect(button).toHaveAttribute("data-variant", "technique");
    expect(button.className).toContain("bg-(--theme-cta)");
    expect(button.className).toContain("text-(--theme-cta-fg)");
  });
});
