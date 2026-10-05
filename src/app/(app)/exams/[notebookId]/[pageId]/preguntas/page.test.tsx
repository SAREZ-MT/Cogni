import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({}) }));

const {
  getPageForRoute,
  getNotebookTitleForRoute,
  listExamQuestionsAction,
  getExamStartAction,
} = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
  listExamQuestionsAction: vi.fn(),
  getExamStartAction: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));
vi.mock("@/modules/exams", () => ({
  EXAM_MIN_QUESTIONS: 10,
  listExamQuestionsAction,
  getExamStartAction,
  createExamQuestionAction: vi.fn(),
  editExamQuestionAction: vi.fn(),
  retireExamQuestionAction: vi.fn(),
}));

import ExamQuestionsPage from "./page";

const NOTEBOOK = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function params(notebookId = NOTEBOOK, pageId = PAGE) {
  return { params: Promise.resolve({ notebookId, pageId }) };
}

describe("ExamQuestionsPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
    getPageForRoute.mockResolvedValue({
      id: PAGE,
      notebookId: NOTEBOOK,
      title: "Mitocondria",
    });
    getNotebookTitleForRoute.mockResolvedValue("Biología celular");
    getExamStartAction.mockResolvedValue(
      ok({
        activeQuestionCount: 1,
        retakePending: true,
        openSessionId: null,
        lastFinishedSessionId: null,
      }),
    );
    listExamQuestionsAction.mockResolvedValue(
      ok([
        {
          id: "q1",
          pageId: PAGE,
          stem: "¿Qué produce la mitocondria?",
          options: ["ATP", "ADN", "Lípidos", "Almidón"],
          correctIndex: 0,
          explanation: "",
          concept: "Función de la mitocondria",
          origin: "manual",
        },
      ]),
    );
  });

  it("lists the page's real questions, also in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ExamQuestionsPage(params()));

    expect(getPageForRoute).toHaveBeenCalledWith(NOTEBOOK, PAGE);
    expect(listExamQuestionsAction).toHaveBeenCalledWith({ pageId: PAGE });
    expect(
      screen.getByRole("heading", { name: "Mitocondria — preguntas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("exam-question-row")).toHaveLength(1);
    expect(screen.getByText("Exámenes · Biología celular")).toBeInTheDocument();
    expect(screen.getByTestId("take-exam-button")).toHaveTextContent(
      "Repetir examen (próximamente)",
    );
  });

  it("answers 404 for a page that is unknown, archived or not the caller's", async () => {
    getPageForRoute.mockResolvedValue(null);

    await expect(
      ExamQuestionsPage(params("biologia-celular", "mitocondria")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listExamQuestionsAction).not.toHaveBeenCalled();
  });

  it("answers 404 when the questions cannot be read", async () => {
    listExamQuestionsAction.mockResolvedValue(
      err({ code: "EXAMS_UNEXPECTED", message: "x" }),
    );

    await expect(ExamQuestionsPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
