import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueEmptyArt } from "./technique-empty-art";

// Phase 8 H10 (user request 2026-10-29): the technique hubs' empty-state
// hero, one family with the notebooks hub's `NotebookFan` and the empty
// notebook's `PageSheetFan`.
describe("TechniqueEmptyArt", () => {
  it.each([
    "flashcards",
    "recall",
    "exams",
  ] as const)("is decorative and fans three %s cards, the front one last", (technique) => {
    const { container } = render(<TechniqueEmptyArt technique={technique} />);

    const art = container.querySelector('[data-slot="technique-empty-art"]');
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).toHaveAttribute("data-technique", technique);
    const cards = [...container.querySelectorAll('[data-part="fan-card"]')];
    expect(cards.map((card) => card.getAttribute("data-card"))).toEqual([
      "left",
      "right",
      "front",
    ]);
  });

  it("shows a generic question with a flip hint and a pixel tile on the flashcard", () => {
    const { container, getByText } = render(
      <TechniqueEmptyArt technique="flashcards" />,
    );

    expect(getByText("¿Qué es…?")).toBeInTheDocument();
    expect(getByText("Toca para voltear")).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="pixel-tile"][data-tone="yellow"]'),
    ).toBeInTheDocument();
  });

  it("waits for an answer in your own words with a caret that rests under reduced motion", () => {
    const { container, getByText } = render(
      <TechniqueEmptyArt technique="recall" />,
    );

    expect(getByText("Explícalo con tus palabras…")).toBeInTheDocument();
    expect(container.querySelector('[data-part="caret"]')).toHaveClass(
      "motion-safe:animate-pulse",
    );
  });

  it("lists options A, B and C on the exam sheet with exactly one selected", () => {
    const { container } = render(<TechniqueEmptyArt technique="exams" />);

    const options = [...container.querySelectorAll('[data-part="option"]')];
    expect(options.map((option) => option.textContent)).toEqual([
      "Opción A",
      "Opción B",
      "Opción C",
    ]);
    expect(
      options.filter(
        (option) => option.getAttribute("data-selected") === "true",
      ),
    ).toHaveLength(1);
  });
});
