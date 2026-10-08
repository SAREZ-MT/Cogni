import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecallQuestion } from "../_data/sample";

// Without a pageId the player calls none of these (design preview); the
// module index is server code, so it is replaced here. Persistence is
// covered by active-recall-player.persistence.test.tsx.
vi.mock("@/modules/active-recall", () => ({
  startRecallSessionAction: vi.fn(),
  saveRecallAnswerAction: vi.fn(),
  finishRecallSessionAction: vi.fn(),
  getRecallSessionResultsAction: vi.fn(),
  retryRecallEvaluationAction: vi.fn(),
  disagreeRecallAnswerAction: vi.fn(),
}));

import { ActiveRecallPlayer } from "./active-recall-player";

const QUESTIONS: RecallQuestion[] = [
  { id: "q1", pageId: "p", prompt: "Primera pregunta" },
  { id: "q2", pageId: "p", prompt: "Segunda pregunta" },
  { id: "q3", pageId: "p", prompt: "Tercera pregunta" },
];

function setup(questions: RecallQuestion[] = QUESTIONS) {
  const user = userEvent.setup();
  render(
    <ActiveRecallPlayer
      notebookId="nb"
      notebookTitle="Biología"
      pageTitle="Mitocondria"
      questions={questions}
    />,
  );
  return user;
}

async function answerWith(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
  rating: number,
) {
  if (text) await user.type(screen.getByTestId("answer-textarea"), text);
  await user.click(screen.getByRole("button", { name: /Calificar respuesta/ }));
  await user.click(screen.getByTestId(`self-rate-${rating}`));
}

function tally() {
  return within(screen.getByTestId("stat-dots"))
    .getAllByText(/^\d+$/)
    .map((node) => node.textContent);
}

describe("ActiveRecallPlayer session flow", () => {
  it("starts on the first open question with an empty answer box", () => {
    setup();

    expect(screen.getByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Primera pregunta")).toBeInTheDocument();
    expect(screen.getByTestId("answer-textarea")).toHaveValue("");
    expect(screen.queryByTestId("self-rate-0")).not.toBeInTheDocument();
  });

  it("shows the student's own answer and the 0-5 scale after 'Calificar respuesta'", async () => {
    const user = setup();

    await user.type(screen.getByTestId("answer-textarea"), "Produce ATP");
    await user.click(
      screen.getByRole("button", { name: /Calificar respuesta/ }),
    );

    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Produce ATP")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-textarea")).not.toBeInTheDocument();
    for (const value of [0, 1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`self-rate-${value}`)).toBeInTheDocument();
    }
  });

  it("records an empty answer as '(sin respuesta)'", async () => {
    const user = setup();

    await user.click(
      screen.getByRole("button", { name: /Calificar respuesta/ }),
    );

    expect(screen.getByText("(sin respuesta)")).toBeInTheDocument();
  });

  it("gives no feedback between questions", async () => {
    const user = setup();

    await answerWith(user, "algo", 3);

    expect(screen.getByText("Pregunta 2 de 3")).toBeInTheDocument();
    expect(
      screen.queryByText("Retroalimentación de la sesión"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("advances on a self-evaluation and clears the answer box", async () => {
    const user = setup();

    await answerWith(user, "algo", 4);

    expect(screen.getByText("Segunda pregunta")).toBeInTheDocument();
    expect(screen.getByTestId("answer-textarea")).toHaveValue("");
  });

  it("fills the progress bar with the share of questions already completed", async () => {
    const user = setup();
    expect(screen.getByText("0%")).toBeInTheDocument();

    await answerWith(user, "a", 2);

    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("buckets self-ratings in the live tally: 0-1 difícil, 2-3 regular, 4-5 fácil", async () => {
    const user = setup([
      ...QUESTIONS,
      { id: "q4", pageId: "p", prompt: "Cuarta" },
    ]);
    expect(tally()).toEqual(["0", "0", "0"]);

    await answerWith(user, "a", 1);
    expect(tally()).toEqual(["1", "0", "0"]);

    await answerWith(user, "b", 3);
    expect(tally()).toEqual(["1", "1", "0"]);

    await answerWith(user, "c", 2);
    expect(tally()).toEqual(["1", "2", "0"]);
  });

  it("counts a 4 and a 5 as fácil", async () => {
    const user = setup();

    await answerWith(user, "a", 4);
    await answerWith(user, "b", 5);

    expect(tally()).toEqual(["0", "0", "2"]);
  });

  it("'Saltar' counts as a 0 self-rating and moves on without the scale", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Saltar" }));

    expect(screen.getByText("Pregunta 2 de 3")).toBeInTheDocument();
    expect(screen.queryByTestId("self-rate-0")).not.toBeInTheDocument();
    expect(tally()).toEqual(["1", "0", "0"]);
  });

  it("shows the end-of-session results in the page after the last question", async () => {
    const user = setup();

    await answerWith(user, "a", 5);
    await answerWith(user, "b", 4);
    await answerWith(user, "c", 0);

    const results = screen.getByTestId("active-recall-results");
    expect(
      within(results).getByRole("heading", { name: "Resultados de la sesión" }),
    ).toBeInTheDocument();
    expect(results).toHaveTextContent("Mitocondria — 3 preguntas respondidas");
    expect(
      screen.queryByTestId("active-recall-session"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("buckets the end-of-session counts by self-rating: Difícil, Regular, Fácil", async () => {
    const user = setup();

    await answerWith(user, "a", 5);
    await answerWith(user, "b", 4);
    await answerWith(user, "c", 0);

    const results = screen.getByTestId("active-recall-results");
    for (const [label, count] of [
      ["Difícil", "1"],
      ["Regular", "0"],
      ["Fácil", "2"],
    ] as const) {
      const tile = within(results).getAllByText(label)[0]?.parentElement;
      expect(tile).toHaveTextContent(count);
    }
  });

  it("averages the self-evaluation over the answered questions", async () => {
    const user = setup();

    await answerWith(user, "a", 5);
    await answerWith(user, "b", 4);
    await answerWith(user, "c", 3);

    expect(screen.getByText("Autoevaluación promedio")).toBeInTheDocument();
    expect(screen.getByText("4,0 / 5")).toBeInTheDocument();
  });

  it("'Terminar' ends the session early with what was answered", async () => {
    const user = setup();
    await answerWith(user, "a", 5);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    const results = screen.getByTestId("active-recall-results");
    expect(results).toHaveTextContent("1 preguntas respondidas");
    expect(within(results).getByText("5,0 / 5")).toBeInTheDocument();
    expect(screen.getAllByTestId("question-feedback-item")).toHaveLength(1);
  });

  it("'Terminar' before answering shows an empty result without per-question feedback", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    const results = screen.getByTestId("active-recall-results");
    expect(results).toHaveTextContent("0 preguntas respondidas");
    expect(within(results).getByText("0,0 / 5")).toBeInTheDocument();
    expect(
      screen.queryByText("Retroalimentación por pregunta"),
    ).not.toBeInTheDocument();
  });

  it("keeps a record per question, in order, for the per-question feedback", async () => {
    const user = setup();

    await answerWith(user, "Respuesta uno", 4);
    await user.click(screen.getByRole("button", { name: "Saltar" }));
    await answerWith(user, "Respuesta tres", 2);

    const items = screen.getAllByTestId("question-feedback-item");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1. Primera pregunta");
    expect(items[0]).toHaveTextContent("Respuesta uno");
    expect(items[0]).toHaveTextContent("Autoevaluación 4 · Fácil");
    expect(items[1]).toHaveTextContent("2. Segunda pregunta");
    expect(items[1]).toHaveTextContent("(sin respuesta)");
    expect(items[1]).toHaveTextContent("Autoevaluación 0 · Difícil");
    expect(items[2]).toHaveTextContent("3. Tercera pregunta");
    expect(items[2]).toHaveTextContent("Autoevaluación 2 · Regular");
  });

  it("links back to the page's sessions", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);
    await answerWith(user, "a", 2);

    expect(
      screen.getByRole("link", { name: "Volver a las sesiones" }),
    ).toHaveAttribute("href", "/active-recall/nb");
  });

  it("'Nueva sesión' restarts from the first question with a clean tally and records", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);
    await answerWith(user, "a", 5);

    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(
      screen.queryByTestId("active-recall-results"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 1")).toBeInTheDocument();
    expect(tally()).toEqual(["0", "0", "0"]);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));
    expect(
      screen.queryByTestId("question-feedback-item"),
    ).not.toBeInTheDocument();
  });

  it("explains that a page without questions has nothing to review", () => {
    setup([]);

    expect(
      screen.getByText("Esta página no tiene preguntas todavía."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Todas las sesiones/ }),
    ).toHaveAttribute("href", "/active-recall/nb");
  });
});
