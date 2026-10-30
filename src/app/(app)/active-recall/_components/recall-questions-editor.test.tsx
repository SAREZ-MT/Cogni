import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { saveRecallEditsAction } = vi.hoisted(() => ({
  saveRecallEditsAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({ saveRecallEditsAction }));

import {
  RecallQuestionsEditor,
  validateRecallQuestion,
} from "./recall-questions-editor";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const QUESTION = {
  id: "q1",
  pageId: PAGE,
  prompt: "¿Qué hace la mitocondria?",
  keyConcepts: ["Energía", "ATP"],
  acceptableAnswerSummary: "Produce energía en forma de ATP.",
  origin: "ai" as const,
  updatedAt: "2026-10-01T10:00:00.000Z",
};

async function editPrompt(text: string) {
  const user = userEvent.setup();
  render(<RecallQuestionsEditor pageId={PAGE} questions={[QUESTION]} />);
  const prompt = screen.getByLabelText("Pregunta");
  await user.clear(prompt);
  await user.type(prompt, text);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

// Phase 8 H18 recall edit page, V10.
describe("RecallQuestionsEditor", () => {
  beforeEach(() => saveRecallEditsAction.mockReset());

  it("checks the question, one key concept per line and the expected answer", () => {
    expect(
      validateRecallQuestion({
        prompt: " ",
        keyConcepts: "\n  \n",
        acceptableAnswerSummary: "",
      }),
    ).toEqual({
      prompt: "Escribe la pregunta.",
      keyConcepts: "Escribe al menos un concepto clave.",
      acceptableAnswerSummary: "Escribe la respuesta esperada.",
    });
    expect(
      validateRecallQuestion({
        prompt: "P",
        keyConcepts: "A",
        acceptableAnswerSummary: "R",
      }),
    ).toEqual({});
  });

  it("saves an edit with its loaded version and the key concepts as a list", async () => {
    saveRecallEditsAction.mockResolvedValue({
      ok: true,
      value: [{ ...QUESTION, prompt: "¿Nueva?" }],
    });

    await editPrompt("¿Nueva?");

    expect(saveRecallEditsAction).toHaveBeenCalledWith({
      pageId: PAGE,
      updates: [
        {
          id: "q1",
          expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
          prompt: "¿Nueva?",
          keyConcepts: ["Energía", "ATP"],
          acceptableAnswerSummary: "Produce energía en forma de ATP.",
        },
      ],
      creates: [],
      deletes: [],
    });
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
  });

  it.each([
    ["RECALL_QUESTION_CHANGED", /cambió en otra pestaña/],
    ["RECALL_LAST_QUESTION", /al menos una pregunta/],
    ["SOMETHING_ELSE", /No pudimos guardar los cambios/],
  ])("explains a %s refusal", async (code, copy) => {
    saveRecallEditsAction.mockResolvedValue({
      ok: false,
      error: { code, message: "x" },
    });

    await editPrompt("¿Nueva?");

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
  });
});
