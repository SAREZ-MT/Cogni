import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExamQuestion } from "../_data/sample";
import { ExamQuestionsView } from "./exam-questions-view";

const QUESTIONS: ExamQuestion[] = [
  {
    id: "q1",
    pageId: "pg",
    stem: "Pregunta de la IA",
    options: ["A1", "B1", "C1", "D1"],
    correctIndex: 0,
    concept: "Uno",
    origin: "ai",
  },
  {
    id: "q2",
    pageId: "pg",
    stem: "Pregunta manual",
    options: ["A2", "B2", "C2", "D2"],
    correctIndex: 1,
    concept: "Dos",
    origin: "manual",
  },
  {
    id: "q3",
    pageId: "pg",
    stem: "Pregunta retirada",
    options: ["A3", "B3", "C3", "D3"],
    correctIndex: 2,
    concept: "Tres",
    origin: "ai",
    retiredAt: "22 sept",
  },
  {
    id: "q4",
    pageId: "pg",
    stem: "Variante",
    options: ["A4", "B4", "C4", "D4"],
    correctIndex: 3,
    concept: "Cuatro",
    origin: "ai_variant",
  },
];

function setup(initialQuestions: ExamQuestion[] = QUESTIONS) {
  const user = userEvent.setup();
  render(
    <ExamQuestionsView
      notebookId="nb"
      notebookTitle="Biología"
      pageId="pg"
      pageTitle="Mitocondria"
      initialQuestions={initialQuestions}
    />,
  );
  return user;
}

function rows() {
  return screen.getAllByTestId("exam-question-row");
}

describe("ExamQuestionsView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts active questions by origin, leaving out the retired ones", () => {
    setup();

    expect(
      screen.getByText("3 preguntas · 2 generadas por IA · 1 manuales"),
    ).toBeInTheDocument();
  });

  it("lists every question, retired ones included and muted", () => {
    setup();

    expect(rows()).toHaveLength(4);
    expect(within(rows()[2]).getByText("Retirada")).toBeInTheDocument();
    expect(rows()[2]).toHaveClass("opacity-60");
  });

  it("shows each question's origin", () => {
    setup();

    expect(within(rows()[0]).getByText("IA")).toBeInTheDocument();
    expect(within(rows()[1]).getByText("Manual")).toBeInTheDocument();
    expect(within(rows()[3]).getByText("Variante")).toBeInTheDocument();
  });

  it("treats a question with no origin as AI generated", () => {
    setup([{ ...QUESTIONS[0], origin: undefined }]);

    expect(within(rows()[0]).getByText("IA")).toBeInTheDocument();
    expect(screen.getByText(/1 generadas por IA/)).toBeInTheDocument();
  });

  it("links back to the notebook's exams", () => {
    setup();

    expect(
      screen.getByRole("link", { name: "Todos los exámenes" }),
    ).toHaveAttribute("href", "/exams/nb");
  });

  it("retires a question without deleting it and stops offering 'Retirar'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ExamQuestionsView
        notebookId="nb"
        notebookTitle="Biología"
        pageId="pg"
        pageTitle="Mitocondria"
        initialQuestions={QUESTIONS}
      />,
    );

    await user.click(
      within(rows()[0]).getByRole("button", { name: "Retirar" }),
    );

    expect(rows()).toHaveLength(4);
    expect(within(rows()[0]).getByText("Retirada")).toBeInTheDocument();
    expect(
      within(rows()[0]).queryByRole("button", { name: "Retirar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("2 preguntas · 1 generadas por IA · 1 manuales"),
    ).toBeInTheDocument();
  });

  it("offers no 'Retirar' for an already retired question", () => {
    setup();

    expect(
      within(rows()[2]).queryByRole("button", { name: "Retirar" }),
    ).not.toBeInTheDocument();
    expect(
      within(rows()[2]).getByRole("button", { name: "Editar" }),
    ).toBeInTheDocument();
  });

  it("adds a manual question from 'Nueva pregunta'", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: /Nueva pregunta/ }));
    expect(
      screen.getByRole("heading", { name: "Nueva pregunta" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Enunciado"), "Mi pregunta");
    await user.type(screen.getByPlaceholderText("Opción A"), "Uno");
    await user.type(screen.getByPlaceholderText("Opción B"), "Dos");
    await user.type(screen.getByPlaceholderText("Opción C"), "Tres");
    await user.type(screen.getByPlaceholderText("Opción D"), "Cuatro");
    await user.click(
      screen.getByRole("radio", { name: "Opción B es la correcta" }),
    );
    await user.type(
      screen.getByLabelText("Concepto que evalúa"),
      "Mi concepto",
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));

    expect(rows()).toHaveLength(5);
    const added = rows()[4];
    expect(within(added).getByText("5. Mi pregunta")).toBeInTheDocument();
    expect(within(added).getByText("Manual")).toBeInTheDocument();
    expect(within(added).getByText("B) Dos").tagName).toBe("STRONG");
    expect(screen.getByText(/2 manuales/)).toBeInTheDocument();
    expect(
      screen.queryByTestId("question-form-dialog"),
    ).not.toBeInTheDocument();
  });

  it("gives each new manual question its own id so edits never cross", async () => {
    const user = setup([]);

    for (const stem of ["Primera", "Segunda"]) {
      await user.click(screen.getByRole("button", { name: /Nueva pregunta/ }));
      await user.type(screen.getByLabelText("Enunciado"), stem);
      for (const letter of ["A", "B", "C", "D"]) {
        await user.type(
          screen.getByPlaceholderText(`Opción ${letter}`),
          letter,
        );
      }
      await user.type(screen.getByLabelText("Concepto que evalúa"), stem);
      await user.click(
        screen.getByRole("button", { name: "Guardar pregunta" }),
      );
    }
    await user.click(within(rows()[0]).getByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Enunciado"));
    await user.type(screen.getByLabelText("Enunciado"), "Primera editada");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      within(rows()[0]).getByText("1. Primera editada"),
    ).toBeInTheDocument();
    expect(within(rows()[1]).getByText("2. Segunda")).toBeInTheDocument();
  });

  it("edits a question in place, prefilled, keeping its origin and position", async () => {
    const user = setup();

    await user.click(within(rows()[1]).getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("heading", { name: "Editar pregunta" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Enunciado")).toHaveValue("Pregunta manual");
    expect(
      screen.getByRole("radio", { name: "Opción B es la correcta" }),
    ).toBeChecked();

    await user.clear(screen.getByLabelText("Enunciado"));
    await user.type(screen.getByLabelText("Enunciado"), "Texto nuevo");
    await user.click(
      screen.getByRole("radio", { name: "Opción D es la correcta" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(rows()).toHaveLength(4);
    const edited = rows()[1];
    expect(within(edited).getByText("2. Texto nuevo")).toBeInTheDocument();
    expect(within(edited).getByText("Manual")).toBeInTheDocument();
    expect(within(edited).getByText("D) D2").tagName).toBe("STRONG");
  });

  it("starts 'Nueva pregunta' empty after editing another one", async () => {
    const user = setup();

    await user.click(within(rows()[1]).getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: /Nueva pregunta/ }));

    expect(screen.getByLabelText("Enunciado")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Guardar pregunta" }),
    ).toBeDisabled();
  });

  it("changes nothing when the dialog is cancelled", async () => {
    const user = setup();

    await user.click(within(rows()[0]).getByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Enunciado"));
    await user.type(screen.getByLabelText("Enunciado"), "No guardar");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      within(rows()[0]).getByText("1. Pregunta de la IA"),
    ).toBeInTheDocument();
  });

  it("keeps the explanation of a manual question for its next edit", async () => {
    const user = setup([]);

    await user.click(screen.getByRole("button", { name: /Nueva pregunta/ }));
    await user.type(screen.getByLabelText("Enunciado"), "Con explicación");
    for (const letter of ["A", "B", "C", "D"]) {
      await user.type(screen.getByPlaceholderText(`Opción ${letter}`), letter);
    }
    await user.type(screen.getByLabelText("Concepto que evalúa"), "Concepto");
    await user.type(
      screen.getByLabelText("Explicación (opcional)"),
      "Porque sí",
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    await user.click(within(rows()[0]).getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Explicación (opcional)")).toHaveValue(
      "Porque sí",
    );
  });
});
