import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueRing } from "./technique-ring";

describe("TechniqueRing", () => {
  it("shows the share done in the centre of an accent arc, with its status pill below", () => {
    const { container } = render(
      <TechniqueRing tone="yellow" label="Flashcards" done={3} total={10} />,
    );

    const ring = container.querySelector('[data-slot="technique-ring"]');
    expect(ring).toHaveAttribute("data-tone", "yellow");
    expect(ring?.querySelector('[data-part="value"]')).toHaveTextContent("30%");
    expect(ring?.querySelector('[data-part="indicator"]')).toHaveClass(
      "text-technique-flashcards-accent",
    );
    expect(
      ring?.querySelector('[data-slot="technique-status-pill"]'),
    ).toHaveTextContent("Flashcards");
    // One spoken sentence; the drawing and the visible digits are hidden.
    expect(screen.getByText("Flashcards: 3 de 10 repasos (30%)")).toHaveClass(
      "sr-only",
    );
    expect(ring?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows an empty track and a dash when the technique has nothing this week", () => {
    const { container } = render(
      <TechniqueRing tone="rose" label="Examen" done={0} total={0} />,
    );

    const ring = container.querySelector('[data-slot="technique-ring"]');
    expect(ring?.querySelector('[data-part="indicator"]')).toBeNull();
    expect(ring?.querySelector('[data-part="value"]')).toHaveTextContent("—");
    expect(screen.getByText("Examen: sin repasos esta semana")).toHaveClass(
      "sr-only",
    );
  });

  it("draws no arc at 0% but still shows 0% when there is work", () => {
    const { container } = render(
      <TechniqueRing
        tone="green"
        label="Recordación activa"
        done={0}
        total={4}
      />,
    );
    expect(container.querySelector('[data-part="indicator"]')).toBeNull();
    expect(container.querySelector('[data-part="value"]')).toHaveTextContent(
      "0%",
    );
  });
});
