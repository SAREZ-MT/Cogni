import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreCard, type ScoreCardProps } from "./score-card";

const BASE: ScoreCardProps = {
  score: 80,
  correct: 8,
  incorrect: 1,
  unanswered: 1,
  total: 10,
  timeLabel: "04:07",
  pageTitle: "Mitocondria",
  notebookTitle: "Biología Celular",
};

describe("ScoreCard", () => {
  it("shows the score, correct/total, the stats row and the page context", () => {
    render(<ScoreCard {...BASE} />);

    expect(screen.getByTestId("exam-score")).toHaveTextContent("80%");
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(
      screen.getByText("Mitocondria · Biología Celular").parentElement,
    ).toHaveTextContent(
      /8 correctas\s*1 incorrectas\s*1 sin responder\s*Tiempo 04:07/,
    );
    expect(screen.getByText("04:07")).toBeInTheDocument();
    expect(
      screen.getByText("Mitocondria · Biología Celular"),
    ).toBeInTheDocument();
  });

  it.each([
    [100, "¡Excelente!"],
    [90, "¡Excelente!"],
    [89, "¡Buen trabajo!"],
    [70, "¡Buen trabajo!"],
    [69, "Puedes mejorar"],
    [50, "Puedes mejorar"],
    [49, "Sigue practicando"],
    [0, "Sigue practicando"],
  ])("titles a %s score as %s", (score, title) => {
    render(<ScoreCard {...BASE} score={score} />);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it.each([
    [80, "bg-success-100"],
    [79, "bg-warning-100"],
    [60, "bg-warning-100"],
    [59, "bg-error-100"],
  ])("tints the disc of a %s score with %s", (score, className) => {
    render(<ScoreCard {...BASE} score={score} />);

    expect(screen.getByTestId("exam-score").parentElement).toHaveClass(
      className,
    );
  });
});
