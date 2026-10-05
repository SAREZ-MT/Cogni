import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExamResultsView as Results } from "@/modules/exams";
import { ExamResultsView } from "./exam-results-view";

function results(overrides: Partial<Results> = {}): Results {
  return {
    sessionId: "s1",
    pageId: "pg",
    finishedAt: "2026-10-05T10:07:30.000Z",
    total: 2,
    correct: 1,
    scorePercent: 50,
    passed: false,
    durationSeconds: 450,
    questions: [
      {
        id: "q1",
        stem: "¿Qué produce la mitocondria?",
        options: ["ATP", "ADN", "Lípidos", "Almidón"],
        concept: "Función de la mitocondria",
        explanation: "La respiración celular produce ATP.",
        correctIndex: 0,
        selectedIndex: 1,
        isCorrect: false,
      },
      {
        id: "q2",
        stem: "¿Dónde está el ADN mitocondrial?",
        options: ["Matriz", "Núcleo", "Citosol", "Membrana"],
        concept: "ADN mitocondrial",
        explanation: "",
        correctIndex: 0,
        selectedIndex: 0,
        isCorrect: true,
      },
    ],
    failedConcepts: ["Función de la mitocondria"],
    ...overrides,
  };
}

function renderView(value: Results) {
  render(
    <ExamResultsView
      notebookTitle="Biología"
      pageTitle="Mitocondria"
      pageHref="/notebooks/nb/pages/pg"
      questionsHref="/exams/nb/pg/preguntas"
      examHref="/exams/nb/pg"
      results={value}
    />,
  );
}

describe("ExamResultsView", () => {
  it("shows the score, the total time and every question with its explanation", () => {
    renderView(results());
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("07:30")).toBeInTheDocument();
    const rows = screen.getAllByTestId("exam-review-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Tu respuesta: B) ADN");
    expect(rows[0]).toHaveTextContent("Correcta: A) ATP");
    expect(rows[0]).toHaveTextContent("La respiración celular produce ATP.");
  });

  it("marks a failed exam, lists its failed concepts and offers the retake", () => {
    renderView(results());
    expect(screen.getByTestId("exam-failed")).toHaveTextContent(
      "Nota menor a 70 %",
    );
    expect(screen.getByTestId("exam-failed-concepts")).toHaveTextContent(
      "Función de la mitocondria",
    );
    expect(screen.getByTestId("retake-exam-link")).toHaveAttribute(
      "href",
      "/exams/nb/pg",
    );
    expect(screen.queryByTestId("new-exam-link")).not.toBeInTheDocument();
    expect(screen.getByTestId("feedback-status")).toHaveTextContent("pronto");
  });

  it("offers a new exam after a pass", () => {
    renderView(
      results({
        correct: 2,
        scorePercent: 100,
        passed: true,
        failedConcepts: [],
      }),
    );
    expect(screen.getByTestId("exam-passed")).toHaveTextContent("Aprobado");
    expect(
      screen.queryByTestId("exam-failed-concepts"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("new-exam-link")).toHaveAttribute(
      "href",
      "/exams/nb/pg",
    );
  });
});
