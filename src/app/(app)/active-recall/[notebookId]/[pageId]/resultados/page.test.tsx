import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";

vi.mock("server-only", () => ({}));

const { notFound, push } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push }),
}));

const { SetBreadcrumb } = vi.hoisted(() => ({
  SetBreadcrumb: vi.fn(() => null),
}));
vi.mock("../../../../_components/breadcrumb", () => ({ SetBreadcrumb }));

const {
  getPageForRoute,
  getNotebookTitleForRoute,
  getRecallSessionReviewAction,
  getRecallSessionResultsAction,
  disagreeRecallAnswerAction,
} = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
  getRecallSessionReviewAction: vi.fn(),
  getRecallSessionResultsAction: vi.fn(),
  disagreeRecallAnswerAction: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));
vi.mock("@/modules/active-recall", () => ({
  getRecallSessionReviewAction,
  getRecallSessionResultsAction,
  retryRecallEvaluationAction: vi.fn(),
  disagreeRecallAnswerAction,
}));

import ActiveRecallResultsPage, { maxDuration } from "./page";

const NOTEBOOK = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "11111111-1111-4111-8111-111111111111";

function props(sesion?: string | string[]) {
  return {
    params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
    searchParams: Promise.resolve(sesion === undefined ? {} : { sesion }),
  };
}

const RESULTS = {
  sessionId: SESSION,
  startedAt: "2026-09-24T10:00:00.000Z",
  finishedAt: "2026-09-24T10:05:00.000Z",
  evaluationStatus: "done",
  averageCombinedQuality: 4,
  calibration: { overconfident: 0, underconfident: 0 },
  answers: [
    {
      id: "a-1",
      questionId: "q-1",
      answerText: "Produce ATP",
      selfRating: 4,
      evaluationStatus: "done",
      aiScore: 4,
      combinedQuality: 4,
      disagreed: true,
      feedback: {
        justification: "Mencionaste el ATP.",
        presentConcepts: [],
        missingConcepts: [],
        misconceptions: [],
      },
    },
  ],
};

describe("ActiveRecallResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({ id: PAGE, title: "Mitocondria" });
    getNotebookTitleForRoute.mockResolvedValue("Biología celular");
    getRecallSessionReviewAction.mockResolvedValue(
      ok({
        sessionId: SESSION,
        pageId: PAGE,
        records: [
          {
            questionId: "q-1",
            prompt: "¿Qué produce la mitocondria?",
            answerText: "Produce ATP",
            selfRating: 4,
          },
        ],
      }),
    );
    getRecallSessionResultsAction.mockResolvedValue(ok(RESULTS));
  });

  it("allows the evaluation a poll may schedule the session route's time budget", () => {
    expect(maxDuration).toBe(300);
  });

  it("renders the past session's results with the existing results view", async () => {
    render(await ActiveRecallResultsPage(props(SESSION)));

    expect(getPageForRoute).toHaveBeenCalledWith(NOTEBOOK, PAGE);
    expect(getRecallSessionReviewAction).toHaveBeenCalledWith({
      pageId: PAGE,
      sessionId: SESSION,
    });
    expect(screen.getByTestId("active-recall-results")).toBeInTheDocument();
    const item = screen.getByTestId("question-feedback-item");
    expect(item).toHaveTextContent("¿Qué produce la mitocondria?");
    expect(item).toHaveTextContent("Produce ATP");
    await waitFor(() =>
      expect(getRecallSessionResultsAction).toHaveBeenCalledWith({
        sessionId: SESSION,
      }),
    );
    // A disagreement recorded earlier stays marked on a later visit.
    expect(
      await screen.findByRole("button", { name: "Marcado como desacuerdo" }),
    ).toBeDisabled();
  });

  it("links back to the notebook's sessions", async () => {
    render(await ActiveRecallResultsPage(props(SESSION)));

    expect(
      screen.getByRole("link", { name: /Todas las sesiones/ }),
    ).toHaveAttribute("href", `/active-recall/${NOTEBOOK}`);
    expect(
      screen.getByRole("link", { name: "Volver a las sesiones" }),
    ).toHaveAttribute("href", `/active-recall/${NOTEBOOK}`);
  });

  it("sets a breadcrumb whose links all resolve", async () => {
    render(await ActiveRecallResultsPage(props(SESSION)));

    expect(SetBreadcrumb).toHaveBeenCalledWith(
      {
        items: [
          { label: "Recordación activa", href: "/active-recall" },
          { label: "Biología celular", href: `/active-recall/${NOTEBOOK}` },
          { label: "Mitocondria", href: `/active-recall/${NOTEBOOK}/${PAGE}` },
          { label: "Resultados" },
        ],
      },
      undefined,
    );
  });

  it("starts a new session on the page from «Nueva sesión →»", async () => {
    render(await ActiveRecallResultsPage(props(SESSION)));

    await userEvent.click(screen.getByRole("button", { name: /Nueva sesión/ }));

    expect(push).toHaveBeenCalledWith(`/active-recall/${NOTEBOOK}/${PAGE}`);
  });

  it("answers 404 without a session id", async () => {
    await expect(ActiveRecallResultsPage(props())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      ActiveRecallResultsPage(props([SESSION, SESSION])),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getRecallSessionReviewAction).not.toHaveBeenCalled();
  });

  it("answers 404 for a malformed session id without reading the page or the session", async () => {
    for (const sesion of ["not-a-uuid", "", `${SESSION}x`]) {
      await expect(ActiveRecallResultsPage(props(sesion))).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    }
    expect(getPageForRoute).not.toHaveBeenCalled();
    expect(getRecallSessionReviewAction).not.toHaveBeenCalled();
  });

  it("answers 404 for a page that is unknown, archived or another user's", async () => {
    getPageForRoute.mockResolvedValue(null);

    await expect(ActiveRecallResultsPage(props(SESSION))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(getRecallSessionReviewAction).not.toHaveBeenCalled();
  });

  it("answers 404 for a session that is unknown, open, foreign or of another page", async () => {
    getRecallSessionReviewAction.mockResolvedValue(
      err({ code: "RECALL_SESSION_NOT_FOUND", message: "x" }),
    );

    await expect(ActiveRecallResultsPage(props(SESSION))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
