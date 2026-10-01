import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  QuestionFeedbackItem,
  type QuestionFeedbackItemProps,
} from "./question-feedback-item";

function setup(overrides: Partial<QuestionFeedbackItemProps> = {}) {
  render(
    <QuestionFeedbackItem
      index={2}
      question="¿Qué es la mitocondria?"
      answer="Produce ATP"
      selfRating={4}
      selfRatingLabel="Fácil"
      selfRatingTone="success"
      {...overrides}
    />,
  );
}

describe("QuestionFeedbackItem", () => {
  it("numbers the question and shows the student's answer", () => {
    setup();

    expect(screen.getByText("2. ¿Qué es la mitocondria?")).toBeInTheDocument();
    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Produce ATP")).toBeInTheDocument();
  });

  it("shows the self-rating with its bucket label and an unscored AI pill", () => {
    setup();

    expect(screen.getByText("Autoevaluación 4 · Fácil")).toBeInTheDocument();
    expect(screen.getByText("IA — / 5")).toBeInTheDocument();
  });

  it("is pending by default: skeleton, explanation and disabled disagree button", () => {
    setup();

    expect(
      screen.getByText("Disponible cuando termine la evaluación"),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "No estoy de acuerdo" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Disponible cuando termine la evaluación",
    );
  });

  it("does not report a disagreement while pending", async () => {
    const onDisagree = vi.fn();
    setup({ onDisagree });

    await userEvent.click(
      screen.getByRole("button", { name: "No estoy de acuerdo" }),
    );

    expect(onDisagree).not.toHaveBeenCalled();
  });

  it("once evaluated, hides the skeleton and lets the student disagree", async () => {
    const onDisagree = vi.fn();
    setup({ pending: false, onDisagree });

    expect(
      screen.queryByText("Disponible cuando termine la evaluación"),
    ).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "No estoy de acuerdo" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("title");

    await userEvent.click(button);
    expect(onDisagree).toHaveBeenCalledTimes(1);
  });

  it("shows a skipped question's placeholder answer as given", () => {
    setup({
      answer: "(sin respuesta)",
      selfRating: 0,
      selfRatingLabel: "Difícil",
      selfRatingTone: "error",
    });

    expect(screen.getByText("(sin respuesta)")).toBeInTheDocument();
    expect(screen.getByText("Autoevaluación 0 · Difícil")).toBeInTheDocument();
  });
});
