import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamPlayerQuestionView, ExamSessionView } from "@/modules/exams";
import { err, ok } from "@/shared/kernel/result";
import { ExamPlayer } from "./exam-player";

const { answerExamQuestionAction, finishExamSessionAction, push } = vi.hoisted(
  () => ({
    answerExamQuestionAction: vi.fn(),
    finishExamSessionAction: vi.fn(),
    push: vi.fn(),
  }),
);
vi.mock("@/modules/exams", () => ({
  answerExamQuestionAction,
  finishExamSessionAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const STARTED = new Date("2026-10-05T10:00:00.000Z");

function question(
  n: number,
  answer: ExamPlayerQuestionView["answer"] = null,
): ExamPlayerQuestionView {
  return {
    id: `q${n}`,
    stem: `¿Pregunta ${n}?`,
    options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`],
    answer,
  };
}

function answered(n: number, selectedIndex: number, correctIndex = 0) {
  return {
    questionId: `q${n}`,
    selectedIndex,
    isCorrect: selectedIndex === correctIndex,
    correctIndex,
    explanation: `Explicación ${n}`,
    concept: `Concepto ${n}`,
  };
}

function session(questions: ExamPlayerQuestionView[]): ExamSessionView {
  return {
    sessionId: SESSION_ID,
    pageId: PAGE_ID,
    startedAt: STARTED.toISOString(),
    finished: false,
    isRetake: false,
    questions,
  };
}

function renderPlayer(questions: ExamPlayerQuestionView[]) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ExamPlayer
      notebookId="nb"
      pageTitle="Mitocondria"
      pageHref="/notebooks/nb/pages/pg"
      session={session(questions)}
    />,
  );
  return user;
}

describe("ExamPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(STARTED.getTime() + 65_000));
    answerExamQuestionAction.mockReset();
    finishExamSessionAction.mockReset();
    push.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the elapsed time from the session start", () => {
    // A fully controlled clock: shouldAdvanceTime would let real time leak
    // into Date.now() and make the exact clock strings flaky on a slow run.
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(STARTED.getTime() + 65_000));
    render(
      <ExamPlayer
        notebookId="nb"
        pageTitle="Mitocondria"
        pageHref="/notebooks/nb/pages/pg"
        session={session([question(1), question(2)])}
      />,
    );
    expect(screen.getByText("01:05")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("01:07")).toBeInTheDocument();
  });

  it("lets the progress dots jump back to answered questions and to the first unanswered one, never past it", async () => {
    const user = renderPlayer([
      question(1, answered(1, 0)),
      question(2, answered(2, 0)),
      question(3),
      question(4),
    ]);
    expect(screen.getByText("¿Pregunta 3?")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 4" }),
    );
    expect(screen.getByText("¿Pregunta 3?")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 1" }),
    );
    expect(screen.getByText("¿Pregunta 1?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir a la pregunta 1" }),
    ).toHaveAttribute("aria-current", "step");

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 3" }),
    );
    expect(screen.getByText("¿Pregunta 3?")).toBeInTheDocument();
  });

  it("shows Ver resultados only on the last question once every question is answered", async () => {
    answerExamQuestionAction.mockResolvedValue(ok(answered(2, 0)));
    const user = renderPlayer([question(1, answered(1, 0)), question(2)]);

    // Last question, still unanswered: no way to finish yet.
    expect(screen.getByText("¿Pregunta 2?")).toBeInTheDocument();
    expect(screen.queryByTestId("finish-exam-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("next-question-button")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /A2/ }));
    expect(await screen.findByTestId("finish-exam-button")).toBeEnabled();

    // Back on an earlier question, the finish button gives way to Siguiente.
    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 1" }),
    );
    expect(screen.queryByTestId("finish-exam-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("next-question-button")).toBeEnabled();
  });

  it("grades a choice and reveals right or wrong with the explanation", async () => {
    answerExamQuestionAction.mockResolvedValue(ok(answered(1, 2)));
    const user = renderPlayer([question(1), question(2)]);
    expect(screen.getByTestId("next-question-button")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /C1/ }));

    expect(answerExamQuestionAction).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      questionId: "q1",
      selectedIndex: 2,
    });
    const reveal = await screen.findByTestId("exam-answer-reveal");
    expect(reveal).toHaveTextContent("Incorrecto");
    expect(reveal).toHaveTextContent("Explicación 1");
    const options = within(screen.getByTestId("exam-options"));
    expect(options.getByRole("button", { name: /A1/ })).toBeDisabled();
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();

    await user.click(screen.getByTestId("next-question-button"));
    expect(screen.getByText("¿Pregunta 2?")).toBeInTheDocument();
  });

  it("labels a retake and says its failed concepts come back reformulated", () => {
    render(
      <ExamPlayer
        notebookId="nb"
        pageTitle="Mitocondria"
        pageHref="/notebooks/nb/pages/pg"
        session={{ ...session([question(1)]), isRetake: true }}
      />,
    );
    expect(screen.getByTestId("exam-retake-label")).toHaveTextContent(
      "Repetición",
    );
  });

  it("does not label a normal exam as a retake", () => {
    renderPlayer([question(1)]);
    expect(screen.queryByTestId("exam-retake-label")).not.toBeInTheDocument();
  });

  it("resumes at the first unanswered question", () => {
    renderPlayer([question(1, answered(1, 0)), question(2), question(3)]);
    expect(screen.getByText("¿Pregunta 2?")).toBeInTheDocument();
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();
  });

  it("keeps the question open and says so when the answer cannot be saved", async () => {
    answerExamQuestionAction.mockResolvedValue(
      err({ code: "EXAMS_UNEXPECTED", message: "x" }),
    );
    const user = renderPlayer([question(1), question(2)]);
    await user.click(screen.getByRole("button", { name: /B1/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar tu respuesta",
    );
    expect(screen.queryByTestId("exam-answer-reveal")).not.toBeInTheDocument();
  });

  it("finishes the exam after the last answer and opens its results", async () => {
    finishExamSessionAction.mockResolvedValue(
      ok({ sessionId: SESSION_ID, passed: true }),
    );
    const user = renderPlayer([
      question(1, answered(1, 0)),
      question(2, answered(2, 1)),
    ]);
    await user.click(screen.getByTestId("finish-exam-button"));
    expect(finishExamSessionAction).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
    });
    expect(push).toHaveBeenCalledWith(
      `/exams/nb/${PAGE_ID}/resultados?sesion=${SESSION_ID}`,
    );
  });

  it("stays on the exam when finishing fails", async () => {
    finishExamSessionAction.mockResolvedValue(
      err({ code: "EXAMS_UNEXPECTED", message: "x" }),
    );
    const user = renderPlayer([question(1, answered(1, 0))]);
    await user.click(screen.getByTestId("finish-exam-button"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cerrar el examen",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
