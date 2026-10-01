import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActiveRecallResultsView } from "./active-recall-results-view";
import type { QuestionRecord } from "./self-rating";

const RECORDS: QuestionRecord[] = [
  { id: "q1", prompt: "Primera", answer: "Uno", selfRating: 5 },
  { id: "q2", prompt: "Segunda", answer: "(sin respuesta)", selfRating: 0 },
  { id: "q3", prompt: "Tercera", answer: "Tres", selfRating: 3 },
];

function setup(records: QuestionRecord[] = RECORDS, onRestart = vi.fn()) {
  render(
    <ActiveRecallResultsView
      pageTitle="Mitocondria"
      records={records}
      sessionsHref="/active-recall/nb"
      onRestart={onRestart}
    />,
  );
  return onRestart;
}

describe("ActiveRecallResultsView", () => {
  it("titles the page and counts the answered questions", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Resultados de la sesión" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mitocondria — 3 preguntas respondidas/),
    ).toBeInTheDocument();
  });

  it("states that the AI evaluation is still running (async evaluation)", () => {
    setup();

    const banner = screen.getByTestId("evaluation-status");
    expect(banner).toHaveAttribute("data-tone", "pending");
    expect(banner).toHaveTextContent("Evaluando tus respuestas…");
  });

  it("counts the self-rating buckets in order Difícil, Regular, Fácil", () => {
    setup();

    const grid = screen.getByText("Difícil", { selector: "p" }).parentElement
      ?.parentElement as HTMLElement;
    const cells = [...grid.children].map((cell) => cell.textContent);
    expect(cells).toEqual(["1Difícil", "1Regular", "1Fácil"]);
  });

  it("averages the self-evaluation with the Spanish decimal comma", () => {
    setup();

    // (5 + 0 + 3) / 3 = 2.67 -> 2,7
    expect(screen.getByText("2,7 / 5")).toBeInTheDocument();
  });

  it("shows a zero average when nothing was answered", () => {
    setup([]);

    expect(screen.getByText("0,0 / 5")).toBeInTheDocument();
  });

  it("reserves the combined quality block with the master document's formula", () => {
    setup();

    expect(screen.getByText("Calidad combinada")).toBeInTheDocument();
    expect(screen.getByText("— / 5")).toBeInTheDocument();
    expect(
      screen.getByText("0,6 × evaluación de la IA + 0,4 × tu autoevaluación"),
    ).toBeInTheDocument();
  });

  it("reserves the calibration block for over and under confidence", () => {
    setup();

    expect(screen.getByText("Calibración")).toBeInTheDocument();
    expect(screen.getByText("Exceso de confianza")).toBeInTheDocument();
    expect(screen.getByText("Falta de confianza")).toBeInTheDocument();
    expect(screen.getAllByText("pronto")).toHaveLength(2);
  });

  it("lists one pending feedback item per question, in answer order", () => {
    setup();

    const items = screen.getAllByTestId("question-feedback-item");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1. Primera");
    expect(items[1]).toHaveTextContent("2. Segunda");
    expect(items[2]).toHaveTextContent("3. Tercera");
    for (const item of items) {
      expect(
        within(item).getByRole("button", { name: "No estoy de acuerdo" }),
      ).toBeDisabled();
    }
  });

  it("omits the per-question section when there are no records", () => {
    setup([]);

    expect(
      screen.queryByText("Retroalimentación por pregunta"),
    ).not.toBeInTheDocument();
  });

  it("links back to the sessions and restarts on demand", async () => {
    const onRestart = setup();

    expect(
      screen.getByRole("link", { name: "Volver a las sesiones" }),
    ).toHaveAttribute("href", "/active-recall/nb");
    await userEvent.click(screen.getByRole("button", { name: /Nueva sesión/ }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
