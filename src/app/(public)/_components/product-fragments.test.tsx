import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductFragments } from "./product-fragments";

describe("ProductFragments", () => {
  it("shows a general-knowledge flashcard with its answer and ratings", () => {
    render(<ProductFragments />);

    expect(screen.getByText("Flashcard · Historia")).toBeInTheDocument();
    expect(
      screen.getByText("¿En qué año llegó el ser humano a la Luna?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("En 1969, con la misión Apolo 11."),
    ).toBeInTheDocument();
    expect(screen.getByText("Bien")).toBeInTheDocument();
  });

  it("keeps today's review and drops the mastery card", () => {
    render(<ProductFragments />);

    expect(screen.getByText("Repaso de hoy")).toBeInTheDocument();
    expect(screen.queryByText("Dominio")).toBeNull();
  });

  it("describes what Cogni's AI does, one benefit per technique", () => {
    render(<ProductFragments />);

    expect(screen.getByText("IA de Cogni")).toBeInTheDocument();
    expect(
      screen.getByText("Lee tus apuntes y crea el material de estudio por ti."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Genera flashcards de cada página"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Te hace preguntas para recordar sin mirar"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Arma exámenes de práctica para medirte"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ flashcards$/)).toBeNull();
  });

  it("shows a passed practice exam result", () => {
    render(<ProductFragments />);

    expect(screen.getByText("Examen de práctica")).toBeInTheDocument();
    expect(screen.getByText("9/10")).toBeInTheDocument();
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("colours the flashcard ratings with the app's rating token families", () => {
    render(<ProductFragments />);

    const expected = [
      ["Otra vez", "error"],
      ["Difícil", "warning"],
      ["Bien", "success"],
      ["Fácil", "primary"],
    ] as const;
    for (const [label, family] of expected) {
      const chip = screen.getByText(label);
      expect(chip.className).toMatch(new RegExp(`\\bbg-${family}-`));
      expect(chip.className).toMatch(new RegExp(`\\btext-${family}-`));
      expect(chip.className).toMatch(new RegExp(`\\bborder-${family}-`));
    }
    expect(screen.getByText("Bien")).toHaveAttribute("data-selected", "true");
  });
});
