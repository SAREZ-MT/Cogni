import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamQuestionView } from "@/modules/exams";
import { err, ok } from "@/shared/kernel/result";
import { ExamQuestionsView } from "./exam-questions-view";

const { editExamQuestionAction, retireExamQuestionAction, refresh } =
  vi.hoisted(() => ({
    editExamQuestionAction: vi.fn(),
    retireExamQuestionAction: vi.fn(),
    refresh: vi.fn(),
  }));
vi.mock("@/modules/exams", () => ({
  EXAM_MIN_QUESTIONS: 10,
  editExamQuestionAction,
  retireExamQuestionAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const PAGE_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function view(
  id: string,
  overrides: Partial<ExamQuestionView> = {},
): ExamQuestionView {
  return {
    id,
    pageId: PAGE_ID,
    stem: `Pregunta ${id}`,
    options: [`A${id}`, `B${id}`, `C${id}`, `D${id}`],
    correctIndex: 1,
    explanation: "",
    concept: `Concepto ${id}`,
    origin: "manual",
    ...overrides,
  };
}

function renderView(questions: ExamQuestionView[], retakePending = false) {
  const user = userEvent.setup();
  render(
    <ExamQuestionsView
      notebookTitle="Biología"
      pageTitle="Mitocondria"
      pageHref="/notebooks/nb/pages/pg"
      questions={questions}
      examHref="/exams/nb/pg"
      retakePending={retakePending}
    />,
  );
  return user;
}

describe("ExamQuestionsView", () => {
  beforeEach(() => {
    for (const fn of [
      editExamQuestionAction,
      retireExamQuestionAction,
      refresh,
    ]) {
      fn.mockReset();
    }
  });

  it("lists the page's questions with their counts and no preview label", () => {
    renderView([view("q1", { origin: "ai" }), view("q2")]);

    expect(
      screen.getByRole("heading", { name: "Mitocondria — preguntas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("exam-question-row")).toHaveLength(2);
    expect(
      screen.getByText("2 preguntas · 1 generada por IA · 1 manual"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Volver a la página/ }),
    ).toHaveAttribute("href", "/notebooks/nb/pages/pg");
  });

  it("uses the singular for counts of one", () => {
    renderView([view("q1")]);

    expect(
      screen.getByText("1 pregunta · 0 generadas por IA · 1 manual"),
    ).toBeInTheDocument();
  });

  // Phase 8 H13: creation is AI only, so a page without manual questions
  // (every new one) does not count "0 manuales".
  it("leaves the manual count out when the page has none", () => {
    renderView([view("q1", { origin: "ai" }), view("q2", { origin: "ai" })]);

    expect(
      screen.getByText("2 preguntas · 2 generadas por IA"),
    ).toBeInTheDocument();
  });

  it("uses the singular for one AI question among several", () => {
    renderView([view("q1", { origin: "ai" }), view("q2"), view("q3")]);

    expect(
      screen.getByText("3 preguntas · 1 generada por IA · 2 manuales"),
    ).toBeInTheDocument();
  });

  it("explains calmly that an exam needs at least 10 questions", () => {
    renderView([view("q1"), view("q2"), view("q3")]);

    expect(screen.getByTestId("exam-questions-minimum")).toHaveTextContent(
      "Un examen necesita al menos 10 preguntas. Genera 7 más con IA desde la página para poder rendirlo.",
    );
  });

  it("hides the minimum note once the page holds 10 questions", () => {
    renderView(Array.from({ length: 10 }, (_, i) => view(`q${i}`)));

    expect(
      screen.queryByTestId("exam-questions-minimum"),
    ).not.toBeInTheDocument();
  });

  // Phase 8 H13 (user, 2026-10-29): questions are created by AI only.
  it("offers no manual question creation", () => {
    renderView([view("q1", { origin: "ai" })]);

    expect(screen.queryByText("Nueva pregunta")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("new-exam-question-button"),
    ).not.toBeInTheDocument();
  });

  it("sends a page without questions back to generate them", () => {
    renderView([]);

    expect(
      screen.getByText("Esta página aún no tiene preguntas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nueva pregunta")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Generar desde la página" }),
    ).toHaveAttribute("href", "/notebooks/nb/pages/pg");
  });

  it("keeps the edit server error in the dialog with Spanish copy", async () => {
    editExamQuestionAction.mockResolvedValue(
      err({ code: "EXAMS_INVALID_QUESTION", message: "x" }),
    );
    const user = renderView([view("q1")]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByTestId("question-form-dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Revisa la pregunta: las 4 opciones deben ser distintas y ningún campo puede quedar vacío.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers a thrown edit with the generic failure", async () => {
    editExamQuestionAction.mockRejectedValue(new Error("network"));
    const user = renderView([view("q1")]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByTestId("question-form-dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "No pudimos guardar la pregunta. Intenta de nuevo.",
    );
  });

  it("edits a question in place, prefilled", async () => {
    editExamQuestionAction.mockResolvedValue(ok(view("q1")));
    const user = renderView([view("q1", { explanation: "Porque sí" })]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByTestId("question-form-dialog");
    expect(within(dialog).getByLabelText("Enunciado")).toHaveValue(
      "Pregunta q1",
    );
    await user.clear(within(dialog).getByLabelText("Enunciado"));
    await user.type(within(dialog).getByLabelText("Enunciado"), "Nueva");
    await user.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );

    expect(editExamQuestionAction).toHaveBeenCalledWith({
      questionId: "q1",
      stem: "Nueva",
      options: ["Aq1", "Bq1", "Cq1", "Dq1"],
      correctIndex: 1,
      concept: "Concepto q1",
      explanation: "Porque sí",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("retires a question only after confirming", async () => {
    retireExamQuestionAction.mockResolvedValue(ok({ id: "q1" }));
    const user = renderView([view("q1")]);

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog", {
      name: "¿Retirar esta pregunta?",
    });
    expect(retireExamQuestionAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Retirar" }));

    expect(retireExamQuestionAction).toHaveBeenCalledWith({ questionId: "q1" });
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the confirmation open with the error when retiring fails", async () => {
    retireExamQuestionAction.mockResolvedValue(
      err({ code: "EXAMS_QUESTION_NOT_FOUND", message: "x" }),
    );
    const user = renderView([view("q1")]);

    await user.click(screen.getByRole("button", { name: "Retirar" }));
    const dialog = screen.getByRole("dialog", {
      name: "¿Retirar esta pregunta?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Retirar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta pregunta ya no existe.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  describe("Rendir examen", () => {
    const ten = Array.from({ length: 10 }, (_, n) => view(`q${n + 1}`));

    it("links to the page's exam once it has 10 questions", () => {
      renderView(ten);
      expect(screen.getByTestId("take-exam-button")).toHaveAttribute(
        "href",
        "/exams/nb/pg",
      );
    });

    it("is disabled below 10 questions", () => {
      renderView(ten.slice(0, 9));
      const button = screen.getByTestId("take-exam-button");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Rendir examen");
    });

    it("says the retake is coming soon while one is pending", () => {
      renderView(ten, true);
      const button = screen.getByTestId("take-exam-button");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Repetir examen (próximamente)");
    });
  });
});
