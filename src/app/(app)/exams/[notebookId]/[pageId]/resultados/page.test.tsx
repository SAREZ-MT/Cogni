import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { getPageForRoute, getNotebookTitleForRoute, getExamResultsAction } =
  vi.hoisted(() => ({
    getPageForRoute: vi.fn(),
    getNotebookTitleForRoute: vi.fn(),
    getExamResultsAction: vi.fn(),
  }));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));
vi.mock("@/modules/exams", () => ({ getExamResultsAction }));

import ExamResultsPage from "./page";

const NOTEBOOK = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "11111111-1111-4111-8111-111111111111";

function props(sesion?: string) {
  return {
    params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
    searchParams: Promise.resolve(sesion ? { sesion } : {}),
  };
}

describe("ExamResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({
      id: PAGE,
      notebookId: NOTEBOOK,
      title: "Mitocondria",
    });
    getNotebookTitleForRoute.mockResolvedValue("Biología celular");
    getExamResultsAction.mockResolvedValue(
      ok({
        sessionId: SESSION,
        pageId: PAGE,
        finishedAt: "2026-10-05T10:07:30.000Z",
        total: 10,
        correct: 8,
        scorePercent: 80,
        passed: true,
        durationSeconds: 95,
        questions: [],
        failedConcepts: [],
      }),
    );
  });

  it("renders the chosen session's results on real data", async () => {
    render(await ExamResultsPage(props(SESSION)));
    expect(getExamResultsAction).toHaveBeenCalledWith({
      pageId: PAGE,
      sessionId: SESSION,
    });
    expect(screen.getByTestId("exam-results")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("01:35")).toBeInTheDocument();
  });

  it("falls back to the page's last finished exam without ?sesion", async () => {
    render(await ExamResultsPage(props()));
    expect(getExamResultsAction).toHaveBeenCalledWith({ pageId: PAGE });
  });

  it("answers 404 when there are no results to show", async () => {
    getExamResultsAction.mockResolvedValue(
      err({ code: "EXAMS_SESSION_NOT_FOUND", message: "x" }),
    );
    await expect(ExamResultsPage(props(SESSION))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("answers 404 for a page that is not the caller's", async () => {
    getPageForRoute.mockResolvedValue(null);
    await expect(ExamResultsPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getExamResultsAction).not.toHaveBeenCalled();
  });
});
