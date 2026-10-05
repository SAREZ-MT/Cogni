import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamReviewRow, type ExamReviewRowProps } from "./exam-review-row";

const BASE: ExamReviewRowProps = {
  index: 3,
  stem: "¿Dónde ocurre la fosforilación oxidativa?",
  status: "incorrect",
  concept: "Fosforilación oxidativa",
  yourAnswerLabel: "A) Núcleo",
  correctAnswerLabel: "C) Membrana interna",
};

describe("ExamReviewRow", () => {
  it("numbers the stem and shows the concept pill", () => {
    render(<ExamReviewRow {...BASE} />);

    expect(
      screen.getByText("3. ¿Dónde ocurre la fosforilación oxidativa?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Concepto: Fosforilación oxidativa"),
    ).toBeInTheDocument();
  });

  it.each([
    ["correct", "Correcta"],
    ["incorrect", "Incorrecta"],
    ["unanswered", "Sin responder"],
  ] as const)("labels a %s question %s", (status, label) => {
    render(<ExamReviewRow {...BASE} status={status} />);

    expect(screen.getByText(label, { selector: "span" })).toBeInTheDocument();
  });

  it("reveals the correct answer and the pending AI explanation for failed questions", () => {
    render(<ExamReviewRow {...BASE} status="incorrect" />);

    expect(screen.getByText("Tu respuesta: A) Núcleo")).toBeInTheDocument();
    expect(
      screen.getByText("Correcta: C) Membrana interna"),
    ).toBeInTheDocument();
    expect(screen.getByText("Explicación de la IA")).toBeInTheDocument();
    expect(
      screen.getByText("Disponible cuando termine la retroalimentación"),
    ).toBeInTheDocument();
  });

  it("treats an unanswered question as failed too", () => {
    render(
      <ExamReviewRow
        {...BASE}
        status="unanswered"
        yourAnswerLabel="Sin responder"
      />,
    );

    expect(screen.getByText("Tu respuesta: Sin responder")).toBeInTheDocument();
    expect(
      screen.getByText("Correcta: C) Membrana interna"),
    ).toBeInTheDocument();
    expect(screen.getByText("Explicación de la IA")).toBeInTheDocument();
  });

  it("shows no correction and no explanation for a correct answer", () => {
    render(<ExamReviewRow {...BASE} status="correct" />);

    expect(screen.queryByText(/^Correcta: /)).not.toBeInTheDocument();
    expect(screen.queryByText("Explicación de la IA")).not.toBeInTheDocument();
  });

  it("drops the loading skeleton once the explanation is no longer pending", () => {
    render(<ExamReviewRow {...BASE} explanationPending={false} />);

    expect(
      screen.queryByText("Disponible cuando termine la retroalimentación"),
    ).not.toBeInTheDocument();
  });

  it("shows the question's own explanation when no AI explanation is pending", () => {
    render(
      <ExamReviewRow
        {...BASE}
        explanationPending={false}
        explanation="La fosforilación ocurre en la membrana interna."
      />,
    );

    expect(screen.getByText("Explicación")).toBeInTheDocument();
    expect(
      screen.getByText("La fosforilación ocurre en la membrana interna."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Explicación de la IA")).not.toBeInTheDocument();
  });

  it("renders no explanation block when there is nothing to explain", () => {
    render(<ExamReviewRow {...BASE} explanationPending={false} />);

    expect(screen.queryByText("Explicación de la IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Explicación")).not.toBeInTheDocument();
  });
});
