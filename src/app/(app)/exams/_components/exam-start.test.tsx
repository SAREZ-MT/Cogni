import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/kernel/result";
import { ExamStart, type ExamStartProps } from "./exam-start";

const { startExamSessionAction, refresh } = vi.hoisted(() => ({
  startExamSessionAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({
  EXAM_DEFAULT_QUESTIONS: 10,
  EXAM_MAX_QUESTIONS: 30,
  EXAM_MIN_QUESTIONS: 10,
  startExamSessionAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const PAGE_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function renderStart(overrides: Partial<ExamStartProps> = {}) {
  const user = userEvent.setup();
  render(
    <ExamStart
      pageId={PAGE_ID}
      pageTitle="Mitocondria"
      pageHref="/notebooks/nb/pages/pg"
      questionsHref="/exams/nb/pg/preguntas"
      activeQuestionCount={25}
      retakePending={false}
      lastResultsHref={null}
      {...overrides}
    />,
  );
  return user;
}

describe("ExamStart", () => {
  beforeEach(() => {
    startExamSessionAction.mockReset();
    refresh.mockReset();
  });

  it("starts an exam of the chosen size, 10 by default, and refreshes into the player", async () => {
    startExamSessionAction.mockResolvedValue(
      ok({ sessionId: "s1", resumed: false }),
    );
    const user = renderStart();
    expect(screen.getByTestId("exam-session-count-value")).toHaveTextContent(
      "10",
    );

    await user.click(screen.getByRole("button", { name: /Más/ }));
    await user.click(screen.getByTestId("start-exam-button"));

    expect(startExamSessionAction).toHaveBeenCalledWith({
      pageId: PAGE_ID,
      count: 11,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("never offers more questions than the page has", async () => {
    const user = renderStart({ activeQuestionCount: 10 });
    expect(screen.getByRole("button", { name: /Más/ })).toBeDisabled();
    await user.click(screen.getByTestId("start-exam-button"));
    expect(startExamSessionAction).toHaveBeenCalledWith({
      pageId: PAGE_ID,
      count: 10,
    });
  });

  it("asks for 10 questions on a page with fewer", () => {
    renderStart({ activeQuestionCount: 6 });
    expect(screen.getByTestId("exam-not-enough")).toHaveTextContent(
      "Necesitas al menos 10 preguntas",
    );
    expect(screen.queryByTestId("start-exam-button")).not.toBeInTheDocument();
  });

  it("says the retake is coming soon while one is pending", () => {
    renderStart({
      retakePending: true,
      lastResultsHref: "/exams/nb/pg/resultados?sesion=s0",
    });
    expect(screen.getByTestId("exam-retake-soon")).toHaveTextContent(
      "Repetir examen (próximamente)",
    );
    expect(
      screen.getByRole("link", { name: "Ver resultados" }),
    ).toHaveAttribute("href", "/exams/nb/pg/resultados?sesion=s0");
    expect(screen.queryByTestId("start-exam-button")).not.toBeInTheDocument();
  });

  it("explains a refused start", async () => {
    startExamSessionAction.mockResolvedValue(
      err({ code: "EXAMS_NOT_ENOUGH_QUESTIONS", message: "x" }),
    );
    const user = renderStart();
    await user.click(screen.getByTestId("start-exam-button"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "al menos 10 preguntas",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
