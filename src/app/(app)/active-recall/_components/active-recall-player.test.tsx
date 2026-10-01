import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RecallQuestion } from "../_data/sample";
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

  it("buckets self-ratings in the live tally: 0-1 reforzar, 2-3 regular, 4-5 dominadas", async () => {
    const user = setup();
    expect(tally()).toEqual(["0", "0", "0"]);

    await answerWith(user, "a", 1);
    expect(tally()).toEqual(["1", "0", "0"]);

    await answerWith(user, "b", 3);
    expect(tally()).toEqual(["1", "1", "0"]);

    await answerWith(user, "c", 2);
    expect(tally()).toEqual(["1", "2", "0"]);
  });

  it("counts a 4 and a 5 as dominadas", async () => {
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

  it("shows the end-of-session summary after the last question", async () => {
    const user = setup();

    await answerWith(user, "a", 5);
    await answerWith(user, "b", 4);
    await answerWith(user, "c", 0);

    const dialog = screen.getByRole("dialog", { name: "Sesión completada" });
    expect(dialog).toHaveTextContent("Mitocondria — 3 preguntas respondidas");
    for (const [label, count] of [
      ["Por reforzar", "1"],
      ["Regular", "0"],
      ["Dominadas", "2"],
    ]) {
      expect(
        within(dialog).getByText(label as string).parentElement,
      ).toHaveTextContent(count as string);
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

  it("reserves the AI feedback slot at the end of the session only", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);

    await answerWith(user, "a", 2);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Retroalimentación de la sesión"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("pronto")).toBeInTheDocument();
  });

  it("shows the self-evaluation average before the AI feedback slot", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);

    await answerWith(user, "a", 2);

    const average = screen.getByText("Autoevaluación promedio");
    const feedback = screen.getByText("Retroalimentación de la sesión");
    expect(
      average.compareDocumentPosition(feedback) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("'Terminar' ends the session early with what was answered", async () => {
    const user = setup();
    await answerWith(user, "a", 5);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("1 preguntas respondidas");
    expect(within(dialog).getByText("5,0 / 5")).toBeInTheDocument();
  });

  it("links back to the page's sessions", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);
    await answerWith(user, "a", 2);

    expect(
      screen.getByRole("link", { name: "Volver a las sesiones" }),
    ).toHaveAttribute("href", "/active-recall/nb");
  });

  it("'Nueva sesión' restarts from the first question with a clean tally", async () => {
    const user = setup([QUESTIONS[0] as RecallQuestion]);
    await answerWith(user, "a", 5);

    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 1")).toBeInTheDocument();
    expect(tally()).toEqual(["0", "0", "0"]);
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
