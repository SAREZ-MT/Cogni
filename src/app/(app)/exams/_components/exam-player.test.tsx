import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExamQuestion } from "../_data/sample";
import { ExamPlayer } from "./exam-player";

const QUESTIONS: ExamQuestion[] = [
  {
    id: "q1",
    pageId: "p",
    stem: "Primera pregunta",
    options: ["A1", "B1", "C1", "D1"],
    correctIndex: 0,
    concept: "Uno",
  },
  {
    id: "q2",
    pageId: "p",
    stem: "Segunda pregunta",
    options: ["A2", "B2", "C2", "D2"],
    correctIndex: 1,
    concept: "Dos",
  },
  {
    id: "q3",
    pageId: "p",
    stem: "Tercera pregunta",
    options: ["A3", "B3", "C3", "D3"],
    correctIndex: 2,
    concept: "Tres",
  },
];

function setup(props: { questions?: ExamQuestion[]; isRetake?: boolean } = {}) {
  const user = userEvent.setup();
  render(
    <ExamPlayer
      notebookId="nb"
      notebookTitle="Biología"
      pageId="pg"
      pageTitle="Mitocondria"
      questions={props.questions ?? QUESTIONS}
      isRetake={props.isRetake ?? false}
    />,
  );
  return user;
}

describe("ExamPlayer session flow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the first question with nothing answered", () => {
    setup();

    expect(screen.getByTestId("exam-session")).toBeInTheDocument();
    expect(screen.getByText("Primera pregunta")).toBeInTheDocument();
    expect(screen.getByText("0 respondidas")).toBeInTheDocument();
    expect(
      screen.getByText("3 preguntas de opción múltiple"),
    ).toBeInTheDocument();
  });

  it("lettered options select one at a time and never reveal correctness", async () => {
    const user = setup();

    await user.click(screen.getByTestId("exam-option-2"));
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();

    await user.click(screen.getByTestId("exam-option-0"));
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();
    // Option 0 is the correct one, yet no correct/incorrect state shows.
    expect(screen.getByTestId("exam-option-0")).toHaveClass("border-rose-500");
    expect(screen.getByTestId("exam-option-2")).not.toHaveClass(
      "border-rose-500",
    );
    expect(screen.queryByText(/Correcta|Incorrecta/)).not.toBeInTheDocument();
  });

  it("requires an answer before 'Siguiente' and blocks 'Anterior' on the first question", async () => {
    const user = setup();

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    await user.click(screen.getByTestId("exam-option-1"));
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("moves forward and back keeping each question's own answer", async () => {
    const user = setup();

    await user.click(screen.getByTestId("exam-option-1"));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Segunda pregunta")).toBeInTheDocument();
    expect(screen.getByTestId("exam-option-1")).not.toHaveClass(
      "border-rose-500",
    );

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Primera pregunta")).toBeInTheDocument();
    expect(screen.getByTestId("exam-option-1")).toHaveClass("border-rose-500");
  });

  it("jumps straight to a question from the progress dots", async () => {
    const user = setup();

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 3" }),
    );

    expect(screen.getByText("Tercera pregunta")).toBeInTheDocument();
    expect(screen.getAllByText("Pregunta 3 de 3")).toHaveLength(2);
  });

  it("offers 'Enviar examen' instead of 'Siguiente' on the last question", async () => {
    const user = setup();

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 3" }),
    );

    expect(
      screen.getByRole("button", { name: /Enviar examen/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Siguiente" }),
    ).not.toBeInTheDocument();
  });

  it("grades the answers on submit and counts unanswered questions as wrong", async () => {
    const user = setup();

    await user.click(screen.getByTestId("exam-option-0")); // q1 correct
    await user.click(screen.getByRole("button", { name: "Entregar" }));

    expect(screen.getByTestId("exam-results")).toBeInTheDocument();
    expect(screen.getByTestId("exam-score")).toHaveTextContent("33%");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("restarts a fresh session from the results view", async () => {
    const user = setup();

    await user.click(screen.getByTestId("exam-option-0"));
    await user.click(screen.getByRole("button", { name: "Entregar" }));
    await user.click(screen.getByRole("button", { name: /Nuevo examen/ }));

    expect(screen.getByTestId("exam-session")).toBeInTheDocument();
    expect(screen.getByText("Primera pregunta")).toBeInTheDocument();
    expect(screen.getByText("0 respondidas")).toBeInTheDocument();
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("00:00");
  });

  it("announces the retake session with its own banner", () => {
    setup({ isRetake: true });

    expect(screen.getByText("Examen de repetición")).toBeInTheDocument();
    expect(
      screen.getByText(/Preguntas nuevas sobre los conceptos que fallaste/),
    ).toBeInTheDocument();
  });

  it("shows no retake banner in a regular session", () => {
    setup();

    expect(screen.queryByText("Examen de repetición")).not.toBeInTheDocument();
  });

  it("explains an empty exam and offers the way back", () => {
    setup({ questions: [] });

    expect(
      screen.getByText("Esta página no tiene preguntas todavía."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Todos los exámenes" }),
    ).toHaveAttribute("href", "/exams/nb");
  });
});

describe("ExamPlayer timer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts up each second and freezes it into the results", async () => {
    vi.useFakeTimers();
    render(
      <ExamPlayer
        notebookId="nb"
        notebookTitle="Biología"
        pageId="pg"
        pageTitle="Mitocondria"
        questions={QUESTIONS}
        isRetake={false}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("01:05");

    act(() => {
      screen.getByRole("button", { name: "Entregar" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("resets the timer when a new exam starts", () => {
    vi.useFakeTimers();
    render(
      <ExamPlayer
        notebookId="nb"
        notebookTitle="Biología"
        pageId="pg"
        pageTitle="Mitocondria"
        questions={QUESTIONS}
        isRetake={false}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    act(() => {
      screen.getByRole("button", { name: "Entregar" }).click();
    });
    act(() => {
      screen.getByRole("button", { name: /Nuevo examen/ }).click();
    });

    expect(screen.getByTestId("exam-timer")).toHaveTextContent("00:00");
  });
});
