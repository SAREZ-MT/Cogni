import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechniqueEmptyArt } from "./technique-empty-art";

// Phase 8 H11 (user-approved v2 mock, 2026-10-29): each technique hub's
// empty-state hero shows the technique itself — a tidy flashcard deck, an
// open question with a handwritten answer sheet, and a test sheet.
describe("TechniqueEmptyArt", () => {
  it.each([
    "flashcards",
    "recall",
    "exams",
  ] as const)("is decorative and tagged with the %s technique", (technique) => {
    const { container } = render(<TechniqueEmptyArt technique={technique} />);

    const art = container.querySelector('[data-slot="technique-empty-art"]');
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).toHaveAttribute("data-technique", technique);
  });

  it("draws a straight deck: four cards behind a front card with a generic question", () => {
    const { container } = render(<TechniqueEmptyArt technique="flashcards" />);
    const art = container.querySelector(
      '[data-slot="technique-empty-art"]',
    ) as HTMLElement;

    const behind = [...art.querySelectorAll('[data-part="deck-back"]')];
    expect(behind.map((card) => card.getAttribute("data-depth"))).toEqual([
      "4",
      "3",
      "2",
      "1",
    ]);
    const front = art.querySelector('[data-part="deck-front"]') as HTMLElement;
    expect(within(front).getByText("Pregunta")).toBeInTheDocument();
    expect(within(front).getByText("1 / 12")).toBeInTheDocument();
    expect(
      within(front).getByText(
        "¿Qué describe el concepto clave de esta página?",
      ),
    ).toBeInTheDocument();
    expect(within(front).getByText("Toca para voltear")).toBeInTheDocument();
    const dots = [...front.querySelectorAll('[data-part="deck-dot"]')];
    expect(dots).toHaveLength(5);
    expect(dots.filter((dot) => dot.hasAttribute("data-on"))).toHaveLength(1);
  });

  it("asks an open question and answers it by hand, from memory, with a resting-safe caret", () => {
    const { container, getByText } = render(
      <TechniqueEmptyArt technique="recall" />,
    );

    expect(getByText("Pregunta abierta")).toBeInTheDocument();
    expect(
      getByText("¿Cómo le explicarías esta idea a alguien que no la conoce?"),
    ).toBeInTheDocument();
    expect(getByText("De memoria, sin mirar tu apunte")).toBeInTheDocument();
    const hand = container.querySelector('[data-part="handwriting"]');
    expect(hand).toHaveClass("tea-hand");
    expect(hand).toHaveTextContent(
      "Es la idea que conecta las otras partes del tema, porque explica",
    );
    expect(hand?.querySelector('[data-part="caret"]')).toHaveClass("tea-caret");
    expect(getByText("24 palabras")).toBeInTheDocument();
    const chips = [...container.querySelectorAll('[data-part="rating-chip"]')];
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Me faltó",
      "A medias",
      "Lo recordé",
    ]);
    expect(
      chips
        .filter((chip) => chip.hasAttribute("data-on"))
        .map((c) => c.textContent),
    ).toEqual(["A medias"]);
  });

  it("shows a clean test sheet: header, tilted score, ten-step progress and options A–D with B chosen", () => {
    const { container, getByText } = render(
      <TechniqueEmptyArt technique="exams" />,
    );

    expect(getByText("Examen · 10 preguntas")).toBeInTheDocument();
    expect(getByText("Pregunta 3")).toBeInTheDocument();
    expect(container.querySelector('[data-part="score"]')).toHaveTextContent(
      "8/10",
    );
    const steps = [...container.querySelectorAll('[data-part="exam-step"]')];
    expect(steps.map((step) => step.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "now",
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
    const options = [...container.querySelectorAll('[data-part="option"]')];
    expect(options.map((option) => option.textContent)).toEqual([
      "AOpción A",
      "Opción B",
      "COpción C",
      "DOpción D",
    ]);
    expect(
      options
        .filter((option) => option.hasAttribute("data-selected"))
        .map((option) => option.textContent),
    ).toEqual(["Opción B"]);
  });
});
