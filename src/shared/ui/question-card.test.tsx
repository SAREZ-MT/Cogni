import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionCard } from "./question-card";

describe("QuestionCard", () => {
  it("shows the question under the default 'Pregunta' eyebrow", () => {
    render(<QuestionCard question="¿Qué es la mitocondria?" />);

    expect(screen.getByText("Pregunta")).toBeInTheDocument();
    expect(screen.getByText("¿Qué es la mitocondria?")).toBeInTheDocument();
  });

  it("accepts a custom eyebrow label", () => {
    render(<QuestionCard eyebrowLabel="Caso" question="q" />);

    expect(screen.getByText("Caso")).toBeInTheDocument();
    expect(screen.queryByText("Pregunta")).not.toBeInTheDocument();
  });

  it("renders the extra slot only when given", () => {
    const { rerender } = render(<QuestionCard question="q" />);
    expect(screen.queryByText("Pista")).not.toBeInTheDocument();

    rerender(
      <QuestionCard question="q">
        <span>Pista</span>
      </QuestionCard>,
    );
    expect(screen.getByText("Pista")).toBeInTheDocument();
  });
});
