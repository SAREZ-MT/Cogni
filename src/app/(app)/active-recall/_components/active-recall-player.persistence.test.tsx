import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The player on real data (Phase 6 T5): every answer is saved as it is
// given, the session starts with the first save and "Terminar" or the last
// question finishes it. The markup is the same as the local player (see
// active-recall-player.test.tsx); only the Server Action calls are new.
const actions = vi.hoisted(() => ({
  startRecallSessionAction: vi.fn(),
  saveRecallAnswerAction: vi.fn(),
  finishRecallSessionAction: vi.fn(),
  getRecallSessionResultsAction: vi.fn(),
  retryRecallEvaluationAction: vi.fn(),
  disagreeRecallAnswerAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => actions);

import { ActiveRecallPlayer } from "./active-recall-player";

const PAGE = "page-1";
const QUESTIONS = [
  { id: "q1", prompt: "Primera pregunta" },
  { id: "q2", prompt: "Segunda pregunta" },
  { id: "q3", prompt: "Tercera pregunta" },
];

function setup(pageId: string | null = PAGE) {
  const user = userEvent.setup();
  render(
    <ActiveRecallPlayer
      notebookId="nb"
      notebookTitle="Biología"
      pageTitle="Mitocondria"
      pageId={pageId ?? undefined}
      questions={QUESTIONS}
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

let calls: string[];

describe("ActiveRecallPlayer persistence", () => {
  beforeEach(() => {
    calls = [];
    actions.getRecallSessionResultsAction.mockReset();
    actions.getRecallSessionResultsAction.mockResolvedValue({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });
    let sessions = 0;
    actions.startRecallSessionAction.mockReset();
    actions.startRecallSessionAction.mockImplementation(async () => {
      sessions += 1;
      calls.push(`start:${sessions}`);
      return {
        ok: true,
        value: {
          sessionId: `s${sessions}`,
          questions:
            sessions === 1
              ? QUESTIONS
              : [{ id: "q9", prompt: "Pregunta de la nueva sesión" }],
        },
      };
    });
    actions.saveRecallAnswerAction.mockReset();
    actions.saveRecallAnswerAction.mockImplementation(async (input) => {
      calls.push(`save:${input.sessionId}:${input.questionId}`);
      return {
        ok: true,
        value: {
          questionId: input.questionId,
          answerText: input.answerText,
          selfRating: input.selfRating,
        },
      };
    });
    actions.finishRecallSessionAction.mockReset();
    actions.finishRecallSessionAction.mockImplementation(async (input) => {
      calls.push(`finish:${input.sessionId}`);
      return {
        ok: true,
        value: {
          sessionId: input.sessionId,
          answeredCount: 1,
          evaluationStatus: "pending",
        },
      };
    });
  });

  it("starts the session with the first answer and saves every answer once", async () => {
    const user = setup();

    await answerWith(user, "Produce ATP", 4);
    await answerWith(user, "", 2);

    await waitFor(() => expect(calls).toHaveLength(3));
    expect(actions.startRecallSessionAction).toHaveBeenCalledTimes(1);
    expect(actions.startRecallSessionAction).toHaveBeenCalledWith({
      pageId: PAGE,
    });
    expect(actions.saveRecallAnswerAction.mock.calls.map(([i]) => i)).toEqual([
      {
        sessionId: "s1",
        questionId: "q1",
        answerText: "Produce ATP",
        selfRating: 4,
      },
      {
        sessionId: "s1",
        questionId: "q2",
        answerText: "(sin respuesta)",
        selfRating: 2,
      },
    ]);
  });

  it("saves 'Saltar' as the skip marker with a 0", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Saltar" }));

    await waitFor(() =>
      expect(actions.saveRecallAnswerAction).toHaveBeenCalledWith({
        sessionId: "s1",
        questionId: "q1",
        answerText: "(sin respuesta)",
        selfRating: 0,
      }),
    );
  });

  it("'Terminar' finishes the session after its pending saves and shows the results", async () => {
    const user = setup();
    await answerWith(user, "Produce ATP", 5);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    expect(screen.getByTestId("active-recall-results")).toBeInTheDocument();
    await waitFor(() =>
      expect(calls).toEqual(["start:1", "save:s1:q1", "finish:s1"]),
    );
  });

  it("polls the finished session's evaluation in the results (Phase 6 T6)", async () => {
    const user = setup();
    await answerWith(user, "Produce ATP", 5);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    await waitFor(() =>
      expect(actions.getRecallSessionResultsAction).toHaveBeenCalledWith({
        sessionId: "s1",
      }),
    );
  });

  it("polls nothing when the finish fails", async () => {
    actions.finishRecallSessionAction.mockResolvedValue({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });
    const user = setup();
    await answerWith(user, "Produce ATP", 5);

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    await waitFor(() =>
      expect(actions.finishRecallSessionAction).toHaveBeenCalled(),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(actions.getRecallSessionResultsAction).not.toHaveBeenCalled();
  });

  it("finishes the session after the last question", async () => {
    const user = setup();
    await answerWith(user, "a", 3);
    await user.click(screen.getByRole("button", { name: "Saltar" }));
    await answerWith(user, "c", 1);

    expect(screen.getByTestId("active-recall-results")).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)).toBe("finish:s1"));
    expect(actions.finishRecallSessionAction).toHaveBeenCalledTimes(1);
  });

  it("'Terminar' before any answer creates and finishes nothing", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    expect(screen.getByTestId("active-recall-results")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toEqual([]);
  });

  it("'Nueva sesión' starts a new session and shows its questions", async () => {
    const user = setup();
    await answerWith(user, "a", 4);
    await user.click(screen.getByRole("button", { name: /Terminar/ }));
    await waitFor(() => expect(calls.at(-1)).toBe("finish:s1"));

    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(
      await screen.findByText("Pregunta de la nueva sesión"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 1")).toBeInTheDocument();
    await answerWith(user, "b", 2);
    await waitFor(() => expect(calls.at(-1)).toBe("finish:s2"));
    expect(calls.slice(-2)).toEqual(["save:s2:q9", "finish:s2"]);
    expect(actions.startRecallSessionAction).toHaveBeenCalledTimes(2);
  });

  it("'Nueva sesión' during pending saves still saves into and finishes the old session", async () => {
    // The first save hangs until released, so "Terminar" and "Nueva sesión"
    // are both queued behind it.
    let releaseSave: () => void = () => {};
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const save = actions.saveRecallAnswerAction.getMockImplementation();
    actions.saveRecallAnswerAction.mockImplementationOnce(async (input) => {
      await saveGate;
      return save?.(input);
    });
    const user = setup();
    await answerWith(user, "a", 4);
    await user.click(screen.getByRole("button", { name: "Saltar" }));
    await user.click(screen.getByRole("button", { name: /Terminar/ }));
    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    releaseSave();

    expect(
      await screen.findByText("Pregunta de la nueva sesión"),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(5));
    expect(calls).toEqual([
      "start:1",
      "save:s1:q1",
      "save:s1:q2",
      "finish:s1",
      "start:2",
    ]);
  });

  it("keeps the questions and starts lazily again when 'Nueva sesión' cannot start", async () => {
    const user = setup();
    await answerWith(user, "a", 4);
    await user.click(screen.getByRole("button", { name: /Terminar/ }));
    await waitFor(() => expect(calls.at(-1)).toBe("finish:s1"));
    actions.startRecallSessionAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });

    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
    await answerWith(user, "b", 2);
    await waitFor(() => expect(calls.at(-1)).toBe("save:s2:q1"));
  });

  it("keeps going when a save fails or throws", async () => {
    actions.saveRecallAnswerAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });
    actions.saveRecallAnswerAction.mockRejectedValueOnce(new Error("offline"));
    const user = setup();

    await answerWith(user, "a", 4);
    await answerWith(user, "b", 3);
    await answerWith(user, "c", 2);

    expect(screen.getByTestId("active-recall-results")).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)).toBe("finish:s1"));
    expect(actions.saveRecallAnswerAction).toHaveBeenCalledTimes(3);
  });

  it("retries the start with the next answer when it fails", async () => {
    actions.startRecallSessionAction.mockRejectedValueOnce(
      new Error("offline"),
    );
    const user = setup();

    await answerWith(user, "a", 4);
    await answerWith(user, "b", 3);

    await waitFor(() => expect(calls).toEqual(["start:1", "save:s1:q2"]));
  });

  it("calls no action without a page (design preview)", async () => {
    const user = setup(null);

    await answerWith(user, "a", 4);
    await user.click(screen.getByRole("button", { name: /Terminar/ }));
    await user.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(screen.getByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(actions.startRecallSessionAction).not.toHaveBeenCalled();
    expect(actions.saveRecallAnswerAction).not.toHaveBeenCalled();
    expect(actions.finishRecallSessionAction).not.toHaveBeenCalled();
  });
});
