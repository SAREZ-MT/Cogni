import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecallSessionResultsView } from "@/modules/active-recall";
import { err, ok } from "@/shared/kernel/result";

const {
  getRecallSessionResultsAction,
  retryRecallEvaluationAction,
  disagreeRecallAnswerAction,
} = vi.hoisted(() => ({
  getRecallSessionResultsAction: vi.fn(),
  retryRecallEvaluationAction: vi.fn(),
  disagreeRecallAnswerAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({
  getRecallSessionResultsAction,
  retryRecallEvaluationAction,
  disagreeRecallAnswerAction,
}));

import {
  ActiveRecallResultsView,
  MAX_POLL_DELAY_MS,
  pollDelayMs,
} from "./active-recall-results-view";
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
  beforeEach(() => {
    getRecallSessionResultsAction.mockReset();
    retryRecallEvaluationAction.mockReset();
    disagreeRecallAnswerAction.mockReset();
  });

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

const SESSION = "session-1";

function answerOf(
  questionId: string,
  overrides: Partial<RecallSessionResultsView["answers"][number]> = {},
): RecallSessionResultsView["answers"][number] {
  return {
    id: `answer-${questionId}`,
    questionId,
    answerText: "x",
    selfRating: 3,
    evaluationStatus: "pending",
    aiScore: null,
    combinedQuality: null,
    disagreed: false,
    feedback: null,
    ...overrides,
  };
}

function done(questionId: string, aiScore: number, justification: string) {
  return answerOf(questionId, {
    evaluationStatus: "done",
    aiScore,
    combinedQuality: aiScore,
    feedback: {
      justification,
      presentConcepts: [],
      missingConcepts: [],
      misconceptions: [],
    },
  });
}

function results(
  overrides: Partial<RecallSessionResultsView> = {},
): RecallSessionResultsView {
  return {
    sessionId: SESSION,
    // Midday UTC: the same calendar day in every timezone within ±11 h, so
    // the date label is deterministic (review part 2 R3-002).
    startedAt: "2026-10-07T11:50:00.000Z",
    finishedAt: "2026-10-07T12:00:00.000Z",
    evaluationStatus: "pending",
    averageCombinedQuality: null,
    calibration: { overconfident: 0, underconfident: 0 },
    answers: RECORDS.map((r) => answerOf(r.id)),
    ...overrides,
  };
}

const DONE = results({
  evaluationStatus: "done",
  averageCombinedQuality: 7 / 3,
  calibration: { overconfident: 1, underconfident: 0 },
  answers: [
    done("q1", 2, "Te faltó el ATP."),
    done("q2", 0, "Pregunta sin responder."),
    done("q3", 5, "Completa."),
  ],
});

const PARTIAL = results({
  evaluationStatus: "partial",
  averageCombinedQuality: 2,
  calibration: { overconfident: 0, underconfident: 1 },
  answers: [
    done("q1", 4, "Bien."),
    done("q2", 0, "Pregunta sin responder."),
    answerOf("q3", { evaluationStatus: "failed" }),
  ],
});

function live(maxPollAttempts?: number) {
  render(
    <ActiveRecallResultsView
      pageTitle="Mitocondria"
      records={RECORDS}
      sessionsHref="/active-recall/nb"
      onRestart={vi.fn()}
      sessionId={SESSION}
      pollIntervalMs={10}
      maxPollAttempts={maxPollAttempts}
    />,
  );
}

describe("ActiveRecallResultsView on a real session", () => {
  beforeEach(() => {
    getRecallSessionResultsAction.mockReset();
    retryRecallEvaluationAction.mockReset();
    disagreeRecallAnswerAction.mockReset();
  });

  it("shows the session's real date", async () => {
    getRecallSessionResultsAction.mockResolvedValue(ok(results()));
    live();

    expect(
      await screen.findByText(/Mitocondria — 3 preguntas respondidas · 7 oct/),
    ).toBeInTheDocument();
  });

  it("keeps every item pending while any evaluation is pending, polling until it resolves", async () => {
    getRecallSessionResultsAction
      .mockResolvedValueOnce(
        ok(
          results({
            answers: [
              done("q1", 2, "Te faltó el ATP."),
              answerOf("q2"),
              answerOf("q3"),
            ],
          }),
        ),
      )
      .mockResolvedValue(ok(DONE));
    live();

    await waitFor(() =>
      expect(getRecallSessionResultsAction).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByTestId("evaluation-status")).toHaveAttribute(
      "data-tone",
      "pending",
    );
    expect(screen.queryByText("Te faltó el ATP.")).not.toBeInTheDocument();
    expect(screen.getAllByText("IA — / 5")).toHaveLength(3);

    await waitFor(() =>
      expect(screen.getByTestId("evaluation-status")).toHaveAttribute(
        "data-tone",
        "success",
      ),
    );
    expect(getRecallSessionResultsAction).toHaveBeenCalledWith({
      sessionId: SESSION,
    });
  });

  it("fills the results once every evaluation is done and stops polling", async () => {
    getRecallSessionResultsAction.mockResolvedValue(ok(DONE));
    live();

    const banner = screen.getByTestId("evaluation-status");
    await waitFor(() => expect(banner).toHaveAttribute("data-tone", "success"));
    expect(banner).toHaveTextContent("Evaluación completa");
    const items = screen.getAllByTestId("question-feedback-item");
    expect(items[0]).toHaveTextContent("IA 2 / 5");
    expect(items[0]).toHaveTextContent("Te faltó el ATP.");
    expect(items[2]).toHaveTextContent("IA 5 / 5");
    // 7 / 3 = 2,33 → 2,3
    expect(screen.getByTestId("combined-quality")).toHaveTextContent("2,3 / 5");
    expect(screen.getByTestId("calibration-over")).toHaveTextContent(
      "1 respuesta",
    );
    expect(screen.getByTestId("calibration-under")).toHaveTextContent(
      "0 respuestas",
    );
    expect(screen.queryByText("pronto")).not.toBeInTheDocument();

    const calls = getRecallSessionResultsAction.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(getRecallSessionResultsAction).toHaveBeenCalledTimes(calls);
  });

  it("offers Reintentar on a partial session and evaluates again", async () => {
    getRecallSessionResultsAction
      .mockResolvedValueOnce(ok(PARTIAL))
      .mockResolvedValue(ok(DONE));
    retryRecallEvaluationAction.mockResolvedValue(
      ok({ sessionId: SESSION, requeued: 1, evaluationStatus: "pending" }),
    );
    live();

    const banner = screen.getByTestId("evaluation-status");
    await waitFor(() => expect(banner).toHaveAttribute("data-tone", "error"));
    expect(banner).toHaveTextContent("No pudimos evaluar algunas respuestas");
    const items = screen.getAllByTestId("question-feedback-item");
    expect(items[0]).toHaveTextContent("IA 4 / 5");
    // The failed answer has no score yet.
    expect(items[2]).toHaveTextContent("IA — / 5");
    expect(
      within(items[2] as HTMLElement).getByRole("button", {
        name: "No estoy de acuerdo",
      }),
    ).toBeDisabled();
    expect(screen.getByTestId("combined-quality")).toHaveTextContent("2,0 / 5");

    await userEvent.click(
      within(banner).getByRole("button", { name: "Reintentar" }),
    );

    expect(retryRecallEvaluationAction).toHaveBeenCalledWith({
      sessionId: SESSION,
    });
    await waitFor(() => expect(banner).toHaveAttribute("data-tone", "success"));
  });

  it("keeps polling after a failed read", async () => {
    getRecallSessionResultsAction
      .mockResolvedValueOnce(err({ code: "RECALL_UNEXPECTED", message: "x" }))
      .mockResolvedValue(ok(DONE));
    live();

    await waitFor(() =>
      expect(screen.getByTestId("evaluation-status")).toHaveAttribute(
        "data-tone",
        "success",
      ),
    );
  });

  it("records a disagreement with the answer's id", async () => {
    getRecallSessionResultsAction.mockResolvedValue(ok(DONE));
    disagreeRecallAnswerAction.mockResolvedValue(
      ok({ answerId: "answer-q1", disagreed: true }),
    );
    live();

    await waitFor(() =>
      expect(screen.getByTestId("evaluation-status")).toHaveAttribute(
        "data-tone",
        "success",
      ),
    );
    const [first] = screen.getAllByTestId("question-feedback-item");
    await userEvent.click(
      within(first as HTMLElement).getByRole("button", {
        name: "No estoy de acuerdo",
      }),
    );

    expect(disagreeRecallAnswerAction).toHaveBeenCalledWith({
      answerId: "answer-q1",
    });
    const marked = within(first as HTMLElement).getByRole("button", {
      name: "Marcado como desacuerdo",
    });
    expect(marked).toBeDisabled();
  });

  it("shows a disagreement recorded earlier as marked", async () => {
    getRecallSessionResultsAction.mockResolvedValue(
      ok({
        ...DONE,
        answers: DONE.answers.map((a, i) =>
          i === 0 ? { ...a, disagreed: true } : a,
        ),
      }),
    );
    live();

    const [first, second] = await waitFor(() => {
      const items = screen.getAllByTestId("question-feedback-item");
      expect(items[0]).toHaveTextContent("IA 2 / 5");
      return items;
    });
    expect(
      within(first as HTMLElement).getByRole("button", {
        name: "Marcado como desacuerdo",
      }),
    ).toBeDisabled();
    expect(
      within(second as HTMLElement).getByRole("button", {
        name: "No estoy de acuerdo",
      }),
    ).toBeEnabled();
  });

  it("offers the button again when the disagreement cannot be saved", async () => {
    getRecallSessionResultsAction.mockResolvedValue(ok(DONE));
    disagreeRecallAnswerAction.mockResolvedValue(
      err({ code: "RECALL_UNEXPECTED", message: "x" }),
    );
    live();

    const [first] = await waitFor(() => {
      const items = screen.getAllByTestId("question-feedback-item");
      expect(items[0]).toHaveTextContent("IA 2 / 5");
      return items;
    });
    await userEvent.click(
      within(first as HTMLElement).getByRole("button", {
        name: "No estoy de acuerdo",
      }),
    );

    await waitFor(() =>
      expect(
        within(first as HTMLElement).getByRole("button", {
          name: "No estoy de acuerdo",
        }),
      ).toBeEnabled(),
    );
  });

  // Review part 2 R3-001: polling always ends.
  it("stops polling on a failure that cannot heal and shows the error banner", async () => {
    getRecallSessionResultsAction.mockResolvedValue(
      err({ code: "RECALL_SESSION_NOT_FOUND", message: "x" }),
    );
    live();

    const banner = screen.getByTestId("evaluation-status");
    await waitFor(() => expect(banner).toHaveAttribute("data-tone", "error"));
    expect(banner).toHaveTextContent("No pudimos evaluar algunas respuestas");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(getRecallSessionResultsAction).toHaveBeenCalledTimes(1);
  });

  it("stops after the last allowed poll and lets Reintentar poll again", async () => {
    getRecallSessionResultsAction.mockResolvedValue(ok(results()));
    retryRecallEvaluationAction.mockResolvedValue(
      ok({ sessionId: SESSION, requeued: 0, evaluationStatus: "pending" }),
    );
    live(3);

    const banner = screen.getByTestId("evaluation-status");
    await waitFor(() => expect(banner).toHaveAttribute("data-tone", "error"), {
      timeout: 2000,
    });
    expect(getRecallSessionResultsAction).toHaveBeenCalledTimes(3);

    await userEvent.click(
      within(banner).getByRole("button", { name: "Reintentar" }),
    );

    expect(retryRecallEvaluationAction).toHaveBeenCalledWith({
      sessionId: SESSION,
    });
    await waitFor(() =>
      expect(getRecallSessionResultsAction).toHaveBeenCalledTimes(4),
    );
  });
});

describe("pollDelayMs", () => {
  it("backs off by half each attempt up to the cap", () => {
    expect(pollDelayMs(0, 2000)).toBe(2000);
    expect(pollDelayMs(1, 2000)).toBe(3000);
    expect(pollDelayMs(2, 2000)).toBe(4500);
    expect(pollDelayMs(50, 2000)).toBe(MAX_POLL_DELAY_MS);
  });
});
