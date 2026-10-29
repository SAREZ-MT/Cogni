import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueHubHeader } from "./technique-hub-header";

// Phase 8 H11 (user-approved v2 mock, 2026-10-29): every technique hub
// opens with a 48px pixel tile beside a 32px title in the technique's
// gradient, whether or not the hub is empty.
describe("TechniqueHubHeader", () => {
  it.each([
    ["flashcards", "yellow"],
    ["recall", "green"],
    ["exams", "rose"],
  ] as const)("themes the %s header with its %s pixel tile", (technique, tone) => {
    const { container } = render(
      <TechniqueHubHeader
        technique={technique}
        title="Título"
        description="0 elementos · 0 cuadernos"
      />,
    );

    const root = container.querySelector('[data-slot="technique-hub-header"]');
    expect(root).toHaveAttribute("data-technique-theme", technique);
    const tile = container.querySelector('[data-slot="pixel-tile"]');
    expect(tile).toHaveAttribute("data-tone", tone);
    expect(tile).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("keeps the eyebrow, the gradient title and the counts, and renders the actions", () => {
    render(
      <TechniqueHubHeader
        technique="exams"
        title="Exámenes"
        description="2 exámenes · 1 cuaderno"
        actions={<button type="button">Crear examen</button>}
      />,
    );

    expect(screen.getByText("Técnicas de estudio")).toBeInTheDocument();
    const title = screen.getByRole("heading", { level: 1, name: "Exámenes" });
    expect(title).toHaveClass("text-gradient-brand", "sm:text-[32px]");
    expect(screen.getByText("2 exámenes · 1 cuaderno")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear examen" }),
    ).toBeInTheDocument();
  });
});
