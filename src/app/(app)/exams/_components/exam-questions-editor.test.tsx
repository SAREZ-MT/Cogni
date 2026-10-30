import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { saveExamEditsAction } = vi.hoisted(() => ({
  saveExamEditsAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({
  MAX_CONCEPT_LENGTH: 120,
  MAX_EXPLANATION_LENGTH: 1000,
  MAX_OPTION_LENGTH: 300,
  MAX_STEM_LENGTH: 600,
  normalizeWording: (text: string) => text.toLowerCase(),
  saveExamEditsAction,
}));

import { ExamQuestionsEditor } from "./exam-questions-editor";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const QUESTION = {
  id: "q1",
  pageId: PAGE,
  stem: "¿Qué produce la mitocondria?",
  options: ["ATP", "ADN", "ARN", "Lípidos"],
  correctIndex: 0,
  explanation: "La respiración celular produce ATP.",
  concept: "Mitocondria",
  origin: "ai" as const,
  updatedAt: "2026-10-01T10:00:00.000Z",
};

async function editStem(text: string) {
  const user = userEvent.setup();
  render(<ExamQuestionsEditor pageId={PAGE} questions={[QUESTION]} />);
  const stem = screen.getByLabelText("Enunciado");
  await user.clear(stem);
  await user.type(stem, text);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

// Phase 8 H18 exam edit page, V10: the save path and its refusals.
describe("ExamQuestionsEditor", () => {
  beforeEach(() => saveExamEditsAction.mockReset());

  it("saves an edit with its loaded version", async () => {
    saveExamEditsAction.mockResolvedValue({
      ok: true,
      value: [{ ...QUESTION, stem: "¿Nueva?" }],
    });

    await editStem("¿Nueva?");

    expect(saveExamEditsAction).toHaveBeenCalledWith({
      pageId: PAGE,
      updates: [
        {
          id: "q1",
          expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
          stem: "¿Nueva?",
          options: QUESTION.options,
          correctIndex: 0,
          concept: "Mitocondria",
          explanation: QUESTION.explanation,
        },
      ],
      creates: [],
      deletes: [],
    });
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
  });

  it.each([
    ["EXAMS_QUESTION_CHANGED", /cambió en otra pestaña/],
    ["EXAMS_QUESTION_NOT_FOUND", /cambiaron mientras las editabas/],
    ["EXAMS_LAST_QUESTION", /al menos una pregunta/],
    ["SOMETHING_ELSE", /No pudimos guardar los cambios/],
  ])("explains a %s refusal and keeps the draft", async (code, copy) => {
    saveExamEditsAction.mockResolvedValue({
      ok: false,
      error: { code, message: "x" },
    });

    await editStem("¿Nueva?");

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument();
  });
});
