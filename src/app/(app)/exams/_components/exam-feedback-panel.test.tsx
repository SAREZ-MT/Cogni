import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamFeedbackView } from "@/modules/exams";

const { requestExamFeedbackAction } = vi.hoisted(() => ({
  requestExamFeedbackAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({ requestExamFeedbackAction }));

import { ExamFeedbackPanel } from "./exam-feedback-panel";

const SESSION = "11111111-1111-4111-8111-111111111111";
const CONTENT = {
  summary: "Buen intento.",
  strengths: ["Las preguntas de ADN"],
  toReinforce: ["La mitocondria produce ATP, no ADN"],
  nextStepSuggestion: "Repasa la mitocondria y repite el examen.",
};

function done(reused = false): ExamFeedbackView {
  return { status: "done", reused, content: CONTENT };
}

describe("ExamFeedbackPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows stored feedback without asking for it again", () => {
    render(<ExamFeedbackPanel sessionId={SESSION} initial={done()} />);

    const panel = screen.getByRole("region", {
      name: "Retroalimentación con IA",
    });
    expect(panel).toHaveTextContent("Buen intento.");
    expect(
      screen.getByRole("list", { name: "Lo que dominas" }),
    ).toHaveTextContent("Las preguntas de ADN");
    expect(
      screen.getByRole("list", { name: "Tus errores, explicados" }),
    ).toHaveTextContent("La mitocondria produce ATP, no ADN");
    expect(panel).toHaveTextContent("Siguiente paso:");
    expect(panel).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("exam-feedback-reused")).toBeNull();
    expect(requestExamFeedbackAction).not.toHaveBeenCalled();
  });

  it("labels the feedback of the last passing exam shown again", () => {
    render(<ExamFeedbackPanel sessionId={SESSION} initial={done(true)} />);

    expect(screen.getByTestId("exam-feedback-reused")).toHaveTextContent(
      "Retroalimentación de tu último examen aprobado",
    );
    expect(screen.getByText("Buen intento.")).toBeInTheDocument();
  });

  it("asks for the feedback when there is none yet, showing a loading state first", async () => {
    requestExamFeedbackAction.mockResolvedValue({ ok: true, value: done() });

    render(<ExamFeedbackPanel sessionId={SESSION} initial={null} />);

    expect(screen.getByText("Preparando tu retroalimentación…")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Retroalimentación con IA" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("Buen intento.")).toBeVisible();
    expect(requestExamFeedbackAction).toHaveBeenCalledWith({
      sessionId: SESSION,
    });
  });

  // React StrictMode runs every effect twice in development (mount, cleanup,
  // mount): the result must still reach the panel, from one request only.
  it("shows the requested feedback under StrictMode, asking only once", async () => {
    requestExamFeedbackAction.mockResolvedValue({ ok: true, value: done() });

    render(
      <StrictMode>
        <ExamFeedbackPanel sessionId={SESSION} initial={null} />
      </StrictMode>,
    );

    expect(await screen.findByText("Buen intento.")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Retroalimentación con IA" }),
    ).toHaveAttribute("aria-busy", "false");
    expect(requestExamFeedbackAction).toHaveBeenCalledOnce();
  });

  it("shows the calm note under StrictMode when the request fails", async () => {
    requestExamFeedbackAction.mockRejectedValue(new Error("network"));

    render(
      <StrictMode>
        <ExamFeedbackPanel sessionId={SESSION} initial={null} />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("exam-feedback")).toHaveTextContent(
        "Tu examen quedó guardado.",
      ),
    );
    expect(requestExamFeedbackAction).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "the AI failed",
      { ok: true, value: { status: "failed", reused: false, content: null } },
    ],
    [
      "another request still holds it",
      { ok: true, value: { status: "pending", reused: false, content: null } },
    ],
    [
      "the action refused",
      { ok: false, error: { code: "EXAMS_UNEXPECTED", message: "x" } },
    ],
  ])("shows a calm note when %s", async (_, result) => {
    requestExamFeedbackAction.mockResolvedValue(result);

    render(<ExamFeedbackPanel sessionId={SESSION} initial={null} />);

    expect(
      await screen.findByText(
        "Esta vez no pudimos preparar la retroalimentación. Tu examen quedó guardado.",
      ),
    ).toBeVisible();
  });

  it("shows the calm note when the request throws", async () => {
    requestExamFeedbackAction.mockRejectedValue(new Error("network"));

    render(<ExamFeedbackPanel sessionId={SESSION} initial={null} />);

    await waitFor(() =>
      expect(screen.getByTestId("exam-feedback")).toHaveTextContent(
        "Tu examen quedó guardado.",
      ),
    );
  });

  it("shows a stored failure without asking again", () => {
    render(
      <ExamFeedbackPanel
        sessionId={SESSION}
        initial={{ status: "failed", reused: false, content: null }}
      />,
    );

    expect(screen.getByTestId("exam-feedback")).toHaveTextContent(
      "Tu examen quedó guardado.",
    );
    expect(requestExamFeedbackAction).not.toHaveBeenCalled();
  });
});
