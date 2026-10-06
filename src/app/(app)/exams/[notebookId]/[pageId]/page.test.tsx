import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const {
  getPageForRoute,
  getNotebookTitleForRoute,
  getExamStartAction,
  getExamSessionAction,
} = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
  getExamStartAction: vi.fn(),
  getExamSessionAction: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));
vi.mock("@/modules/exams", () => ({
  EXAM_DEFAULT_QUESTIONS: 10,
  EXAM_MAX_QUESTIONS: 30,
  EXAM_MIN_QUESTIONS: 10,
  getExamStartAction,
  getExamSessionAction,
  startExamSessionAction: vi.fn(),
  startExamRetakeAction: vi.fn(),
  answerExamQuestionAction: vi.fn(),
  finishExamSessionAction: vi.fn(),
}));

import ExamSessionPage, { maxDuration } from "./page";

const NOTEBOOK = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "11111111-1111-4111-8111-111111111111";

function params() {
  return { params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }) };
}

function startView(
  openSessionId: string | null,
  retake: { openRetakeSessionId?: string; failedRootCount?: number } = {},
) {
  return ok({
    activeQuestionCount: 12,
    retakePending: retake.failedRootCount !== undefined,
    failedRootCount: retake.failedRootCount ?? 0,
    openSessionId,
    openRetakeSessionId: retake.openRetakeSessionId ?? null,
    lastFinishedSessionId: null,
  });
}

describe("ExamSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({
      id: PAGE,
      notebookId: NOTEBOOK,
      title: "Mitocondria",
    });
    getNotebookTitleForRoute.mockResolvedValue("Biología celular");
  });

  it("shows the start screen on real data when no exam is open, also in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");
    getExamStartAction.mockResolvedValue(startView(null));

    render(await ExamSessionPage(params()));

    expect(getExamStartAction).toHaveBeenCalledWith({ pageId: PAGE });
    expect(screen.getByTestId("exam-start")).toBeInTheDocument();
    expect(screen.getByTestId("start-exam-button")).toBeInTheDocument();
    expect(getExamSessionAction).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("resumes the page's open exam in the player", async () => {
    getExamStartAction.mockResolvedValue(startView(SESSION));
    getExamSessionAction.mockResolvedValue(
      ok({
        sessionId: SESSION,
        pageId: PAGE,
        startedAt: new Date().toISOString(),
        finished: false,
        questions: [
          {
            id: "q1",
            stem: "¿Qué produce la mitocondria?",
            options: ["ATP", "ADN", "Lípidos", "Almidón"],
            answer: null,
          },
        ],
      }),
    );

    render(await ExamSessionPage(params()));

    expect(getExamSessionAction).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(screen.getByTestId("exam-session")).toBeInTheDocument();
    expect(
      screen.getByText("¿Qué produce la mitocondria?"),
    ).toBeInTheDocument();
  });

  it("resumes the page's open retake in the player", async () => {
    getExamStartAction.mockResolvedValue(
      startView(null, { openRetakeSessionId: SESSION, failedRootCount: 4 }),
    );
    getExamSessionAction.mockResolvedValue(
      ok({
        sessionId: SESSION,
        pageId: PAGE,
        startedAt: new Date().toISOString(),
        finished: false,
        isRetake: true,
        questions: [
          {
            id: "q1",
            stem: "¿Qué molécula entrega la mitocondria a la célula?",
            options: ["ATP", "ADN", "Lípidos", "Almidón"],
            answer: null,
          },
        ],
      }),
    );

    render(await ExamSessionPage(params()));

    expect(getExamSessionAction).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(screen.getByTestId("exam-retake-label")).toBeInTheDocument();
  });

  it("offers the retake on the start screen while one is pending", async () => {
    getExamStartAction.mockResolvedValue(
      startView(null, { failedRootCount: 4 }),
    );
    render(await ExamSessionPage(params()));
    expect(screen.getByTestId("retake-exam-button")).toBeInTheDocument();
    expect(screen.queryByTestId("start-exam-button")).not.toBeInTheDocument();
  });

  it("gives the retake's AI reformulation the generation budget of 120 s", () => {
    expect(maxDuration).toBe(120);
  });

  it("answers 404 for a page that is unknown, archived or not the caller's", async () => {
    getPageForRoute.mockResolvedValue(null);
    await expect(ExamSessionPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getExamStartAction).not.toHaveBeenCalled();
  });

  it("answers 404 when the exam state cannot be read", async () => {
    getExamStartAction.mockResolvedValue(
      err({ code: "EXAMS_UNEXPECTED", message: "x" }),
    );
    await expect(ExamSessionPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
