import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const {
  getPageForRoute,
  getNotebookTitleForRoute,
  getRecallSessionPlanAction,
} = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
  getRecallSessionPlanAction: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));
vi.mock("@/modules/active-recall", () => ({
  getRecallSessionPlanAction,
  startRecallSessionAction: vi.fn(),
  saveRecallAnswerAction: vi.fn(),
  finishRecallSessionAction: vi.fn(),
  getRecallSessionResultsAction: vi.fn(),
  retryRecallEvaluationAction: vi.fn(),
  disagreeRecallAnswerAction: vi.fn(),
}));

import ActiveRecallSessionPage, { maxDuration } from "./page";

const NOTEBOOK = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function props(notebookId = NOTEBOOK, pageId = PAGE) {
  return { params: Promise.resolve({ notebookId, pageId }) };
}

describe("ActiveRecallSessionPage", () => {
  beforeEach(() => {
    getPageForRoute.mockReset();
    getPageForRoute.mockResolvedValue({ id: PAGE, title: "Mitocondria" });
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología celular");
    getRecallSessionPlanAction.mockReset();
    getRecallSessionPlanAction.mockResolvedValue(
      ok({
        questions: [
          { id: "q1", prompt: "¿Qué produce la mitocondria?" },
          { id: "q2", prompt: "¿Dónde ocurre la glucólisis?" },
        ],
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("plays the page's real questions, in production too", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ActiveRecallSessionPage(props()));

    expect(getPageForRoute).toHaveBeenCalledWith(NOTEBOOK, PAGE);
    expect(getRecallSessionPlanAction).toHaveBeenCalledWith({ pageId: PAGE });
    expect(screen.getByTestId("active-recall-session")).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 2")).toBeInTheDocument();
    expect(
      screen.getByText("¿Qué produce la mitocondria?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recordación activa — Biología celular"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
  });

  it("shows the existing empty state for a page without questions", async () => {
    getRecallSessionPlanAction.mockResolvedValue(ok({ questions: [] }));

    render(await ActiveRecallSessionPage(props()));

    expect(
      screen.getByText("Esta página no tiene preguntas todavía."),
    ).toBeInTheDocument();
  });

  it("answers 404 for an unknown, archived or another owner's page", async () => {
    getPageForRoute.mockResolvedValue(null);

    await expect(ActiveRecallSessionPage(props())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(getRecallSessionPlanAction).not.toHaveBeenCalled();
  });

  it("answers 404 when the questions cannot be read", async () => {
    getRecallSessionPlanAction.mockResolvedValue(
      err({ code: "RECALL_UNEXPECTED", message: "x" }),
    );

    await expect(ActiveRecallSessionPage(props())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("falls back to a generic notebook title", async () => {
    getNotebookTitleForRoute.mockResolvedValue(null);

    render(await ActiveRecallSessionPage(props()));

    expect(
      screen.getByText("Recordación activa — Cuaderno"),
    ).toBeInTheDocument();
  });

  // ADR 0003: the evaluation scheduled with after() by the finish action
  // runs within this page's function budget, at most 300 s.
  it("declares a maxDuration of 300 s for the evaluation run", () => {
    expect(maxDuration).toBe(300);
  });
});
