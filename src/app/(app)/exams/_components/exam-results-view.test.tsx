import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExamResultsView as Results } from "@/modules/exams";

const { requestExamFeedbackAction } = vi.hoisted(() => ({
  requestExamFeedbackAction: vi.fn(async () => ({
    ok: true,
    value: { status: "failed", reused: false, content: null },
  })),
}));
vi.mock("@/modules/exams", () => ({ requestExamFeedbackAction }));

import { ExamResultsView } from "./exam-results-view";

const FEEDBACK = {
  status: "done" as const,
  reused: false,
  content: {
    summary: "Confundiste la función de la mitocondria.",
    strengths: ["El ADN mitocondrial"],
    toReinforce: ["La mitocondria produce ATP según la página"],
    nextStepSuggestion: "Repasa la sección de respiración celular.",
  },
};

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
    feedback: FEEDBACK,
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
      questionsHref="/exams/nb/pg/editar"
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
    expect(screen.queryByText(/pronto/)).not.toBeInTheDocument();
  });

  it("sends a failed student to review the page before retaking", () => {
    renderView(results());
    const review = screen.getByRole("link", { name: "Repasar contenido" });
    expect(review).toHaveAttribute(
      "href",
      "/notebooks/nb/pages/pg?repaso=examen",
    );
  });

  it("shows the exam's AI feedback in place of the placeholder", () => {
    renderView(results());
    expect(screen.getByTestId("exam-feedback")).toHaveTextContent(
      "Confundiste la función de la mitocondria.",
    );
    expect(requestExamFeedbackAction).not.toHaveBeenCalled();
  });

  it("labels the last passing exam's feedback shown again after a pass", () => {
    renderView(
      results({
        correct: 2,
        scorePercent: 100,
        passed: true,
        failedConcepts: [],
        feedback: { ...FEEDBACK, reused: true },
      }),
    );
    expect(screen.getByTestId("exam-feedback-reused")).toHaveTextContent(
      "Retroalimentación de tu último examen aprobado",
    );
    expect(
      screen.queryByRole("link", { name: "Repasar contenido" }),
    ).not.toBeInTheDocument();
  });

  it("asks for the feedback when the results have none yet", async () => {
    renderView(results({ feedback: null }));
    expect(
      await screen.findByText(/Tu examen quedó guardado/),
    ).toBeInTheDocument();
    expect(requestExamFeedbackAction).toHaveBeenCalledWith({ sessionId: "s1" });
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
