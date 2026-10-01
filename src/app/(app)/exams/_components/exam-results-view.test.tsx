import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ExamQuestion } from "../_data/sample";
import { ExamResultsView } from "./exam-results-view";

function makeQuestions(total: number): ExamQuestion[] {
  return Array.from({ length: total }, (_, index) => ({
    id: `q${index + 1}`,
    pageId: "p",
    stem: `Pregunta ${index + 1}`,
    options: ["Uno", "Dos", "Tres", "Cuatro"] as const,
    correctIndex: 1 as const,
    concept: `Concepto ${index + 1}`,
  }));
}

// `correct` first questions answered right (option 1), the next `wrong`
// answered wrong (option 0) and the rest left unanswered.
function answersFor(total: number, correct: number, wrong: number) {
  return Array.from({ length: total }, (_, index) =>
    index < correct ? 1 : index < correct + wrong ? 0 : null,
  );
}

function setup(options: {
  total?: number;
  correct: number;
  wrong?: number;
  seconds?: number;
  onRestart?: () => void;
}) {
  const total = options.total ?? 10;
  render(
    <ExamResultsView
      notebookId="nb"
      pageId="pg"
      notebookTitle="Biología"
      pageTitle="Mitocondria"
      questions={makeQuestions(total)}
      answers={answersFor(total, options.correct, options.wrong ?? 0)}
      seconds={options.seconds ?? 0}
      onRestart={options.onRestart ?? (() => {})}
    />,
  );
}

describe("ExamResultsView scoring", () => {
  it("scores correct answers over the total as a whole percent", () => {
    setup({ correct: 8, wrong: 2 });

    expect(screen.getByTestId("exam-score")).toHaveTextContent("80%");
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
  });

  it("counts an unanswered question as not correct", () => {
    setup({ correct: 5, wrong: 2 });

    expect(screen.getByTestId("exam-score")).toHaveTextContent("50%");
    const stats = screen.getByText("Mitocondria · Biología").parentElement;
    expect(stats).toHaveTextContent(/3\s*sin\s*responder/);
    expect(stats).toHaveTextContent(/2\s*incorrectas/);
  });

  it("scores zero for an empty question list instead of NaN", () => {
    setup({ total: 0, correct: 0 });

    expect(screen.getByTestId("exam-score")).toHaveTextContent("0%");
  });

  it("formats the elapsed time as MM:SS", () => {
    setup({ correct: 7, seconds: 125 });

    expect(screen.getByText("02:05")).toBeInTheDocument();
  });
});

describe("ExamResultsView 70 percent rule", () => {
  it("passes at exactly 70 percent", () => {
    setup({ correct: 7, wrong: 3 });

    expect(screen.getByText("Aprobado")).toBeInTheDocument();
    expect(screen.queryByText("Nota menor a 70 %")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Repetir examen" }),
    ).not.toBeInTheDocument();
  });

  it("requires a retake just below 70 percent", () => {
    setup({ correct: 6, wrong: 4 });

    expect(screen.getByText("Nota menor a 70 %")).toBeInTheDocument();
    expect(screen.queryByText("Aprobado")).not.toBeInTheDocument();
  });

  it("links the retake to the variant question set of the same page", () => {
    setup({ correct: 3, wrong: 7 });

    expect(
      screen.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", "/exams/nb/pg?retake=1");
  });

  it("passes a perfect score and fails a score of zero", () => {
    const { unmount } = (() => {
      setup({ correct: 10 });
      return { unmount: () => document.body.replaceChildren() };
    })();
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
    unmount();

    setup({ correct: 0, wrong: 0 });
    expect(screen.getByText("Nota menor a 70 %")).toBeInTheDocument();
  });
});

describe("ExamResultsView review and feedback", () => {
  it("lists every question with its own status", () => {
    setup({ total: 3, correct: 1, wrong: 1 });

    const rows = screen.getAllByTestId("exam-review-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Correcta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Incorrecta")).toBeInTheDocument();
    expect(
      within(rows[2]).getByText("Sin responder", {
        selector: "span.font-semibold",
      }),
    ).toBeInTheDocument();
  });

  it("shows the student's pick and the right answer for a failed question", () => {
    setup({ total: 2, correct: 1, wrong: 1 });

    const failed = screen.getAllByTestId("exam-review-row")[1];
    expect(
      within(failed).getByText("Tu respuesta: A) Uno"),
    ).toBeInTheDocument();
    expect(within(failed).getByText("Correcta: B) Dos")).toBeInTheDocument();
  });

  it("marks the AI explanation of failed questions as pending, and only those", () => {
    setup({ total: 3, correct: 1, wrong: 1 });

    const [correct, wrong, unanswered] =
      screen.getAllByTestId("exam-review-row");
    const pending = "Disponible cuando termine la retroalimentación";
    expect(within(correct).queryByText(pending)).not.toBeInTheDocument();
    expect(within(wrong).getByText(pending)).toBeInTheDocument();
    expect(within(unanswered).getByText(pending)).toBeInTheDocument();
  });

  it("keeps the AI feedback pending: the explanation arrives asynchronously", () => {
    setup({ correct: 4, wrong: 6 });

    expect(screen.getByTestId("feedback-status")).toHaveTextContent(
      "Preparando la retroalimentación…",
    );
  });

  it("restarts through the callback and links back to the notebook's exams", async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    setup({ correct: 7, onRestart });

    await user.click(screen.getByRole("button", { name: /Nuevo examen/ }));

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Volver a los exámenes" }),
    ).toHaveAttribute("href", "/exams/nb");
  });
});
