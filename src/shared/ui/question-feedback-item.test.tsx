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

  it("shows the AI score and the justification once evaluated", () => {
    setup({
      pending: false,
      aiScore: 3,
      justification: "Te faltó explicar la respiración celular.",
    });

    expect(screen.getByText("IA 3 / 5")).toBeInTheDocument();
    expect(
      screen.getByText("Te faltó explicar la respiración celular."),
    ).toBeInTheDocument();
  });

  it("keeps the unscored pill and the skeleton while pending, even with data", () => {
    setup({ pending: true, aiScore: 3, justification: "Oculta." });

    expect(screen.getByText("IA — / 5")).toBeInTheDocument();
    expect(screen.queryByText("Oculta.")).not.toBeInTheDocument();
  });

  it("shows a score of 0 instead of the unscored dash", () => {
    setup({ pending: false, aiScore: 0 });

    expect(screen.getByText("IA 0 / 5")).toBeInTheDocument();
  });

  it("turns the disagree button into a disabled 'Marcado como desacuerdo' once disagreed", async () => {
    const onDisagree = vi.fn();
    setup({ pending: false, aiScore: 3, disagreed: true, onDisagree });

    expect(
      screen.queryByRole("button", { name: "No estoy de acuerdo" }),
    ).not.toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Marcado como desacuerdo",
    });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onDisagree).not.toHaveBeenCalled();
  });
});
