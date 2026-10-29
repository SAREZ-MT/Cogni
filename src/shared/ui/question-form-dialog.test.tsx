import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  QuestionFormDialog,
  type QuestionFormDialogProps,
  type QuestionFormValues,
} from "./question-form-dialog";

type User = ReturnType<typeof userEvent.setup>;

const EDIT_VALUES: QuestionFormValues = {
  stem: "  ¿Qué produce la mitocondria?  ",
  options: ["ATP", "ADN", "Lípidos", "Almidón"],
  correctIndex: 2,
  concept: "Función de la mitocondria",
  explanation: "",
};

function setup(
  props: {
    initialValues?: QuestionFormValues;
    open?: boolean;
    onSubmit?: QuestionFormDialogProps["onSubmit"];
  } = {},
) {
  const user = userEvent.setup();
  const onSubmit = vi.fn(props.onSubmit);
  const onOpenChange = vi.fn();
  const view = render(
    <QuestionFormDialog
      open={props.open ?? true}
      onOpenChange={onOpenChange}
      initialValues={
        "initialValues" in props ? props.initialValues : EDIT_VALUES
      }
      onSubmit={onSubmit}
    />,
  );
  return { user, onSubmit, onOpenChange, ...view };
}

async function replaceAll(user: User) {
  const fields: [HTMLElement, string][] = [
    [screen.getByLabelText("Enunciado"), "  Pregunta corregida "],
    [screen.getByPlaceholderText("Opción A"), "Uno"],
    [screen.getByPlaceholderText("Opción B"), "Dos"],
    [screen.getByPlaceholderText("Opción C"), "Tres"],
    [screen.getByPlaceholderText("Opción D"), "Cuatro"],
    [screen.getByLabelText("Concepto que evalúa"), " Concepto "],
  ];
  for (const [field, text] of fields) {
    await user.clear(field);
    await user.type(field, text);
  }
}

describe("QuestionFormDialog", () => {
  it("renders nothing while closed", () => {
    setup({ open: false });

    expect(
      screen.queryByTestId("question-form-dialog"),
    ).not.toBeInTheDocument();
  });

  // Phase 8 H13 (user 2026-10-29): questions are created by AI only, so the
  // dialog only edits.
  it("only edits: no create title or save label", () => {
    setup();

    expect(screen.getByText("Editar pregunta")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nueva pregunta")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar pregunta" }),
    ).not.toBeInTheDocument();
  });

  it("prefills every field from the question", () => {
    setup({ initialValues: EDIT_VALUES });

    expect(screen.getByLabelText("Enunciado")).toHaveValue(EDIT_VALUES.stem);
    expect(screen.getByPlaceholderText("Opción C")).toHaveValue("Lípidos");
    expect(
      screen.getByRole("radio", { name: "Opción C es la correcta" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Concepto que evalúa")).toHaveValue(
      "Función de la mitocondria",
    );
  });

  it.each([
    ["the stem", "Enunciado"],
    ["an option", "Opción B"],
    ["the concept", "Concepto que evalúa"],
  ])("keeps saving disabled while %s is missing", async (_name, field) => {
    const { user } = setup({ initialValues: EDIT_VALUES });
    const input =
      field === "Opción B"
        ? screen.getByPlaceholderText("Opción B")
        : screen.getByLabelText(field);

    await user.clear(input);

    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
  });

  it.each([
    ["Concepto que evalúa"],
    ["Enunciado"],
  ])("treats whitespace-only %s as missing", async (field) => {
    const { user } = setup({ initialValues: EDIT_VALUES });

    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), "   ");

    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
  });

  it("does not require the explanation", async () => {
    const { user } = setup({
      initialValues: { ...EDIT_VALUES, explanation: "Algo" },
    });

    await user.clear(screen.getByLabelText("Explicación (opcional)"));

    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("marks exactly one option as the correct one", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("radio", { name: "Opción D es la correcta" }),
    );

    const radios = screen.getAllByRole("radio");
    expect(
      radios.filter((radio) => (radio as HTMLInputElement).checked),
    ).toHaveLength(1);
    expect(radios[3]).toBeChecked();
  });

  it("submits trimmed values with the chosen correct index and closes", async () => {
    const { user, onSubmit, onOpenChange } = setup();

    await replaceAll(user);
    await user.click(
      screen.getByRole("radio", { name: "Opción D es la correcta" }),
    );
    await user.type(
      screen.getByLabelText("Explicación (opcional)"),
      "  Porque sí ",
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit).toHaveBeenCalledWith({
      stem: "Pregunta corregida",
      options: ["Uno", "Dos", "Tres", "Cuatro"],
      correctIndex: 3,
      concept: "Concepto",
      explanation: "Porque sí",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits the prefilled values trimmed", async () => {
    const { user, onSubmit } = setup({ initialValues: EDIT_VALUES });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit).toHaveBeenCalledWith({
      stem: "¿Qué produce la mitocondria?",
      options: ["ATP", "ADN", "Lípidos", "Almidón"],
      correctIndex: 2,
      concept: "Función de la mitocondria",
      explanation: "",
    });
  });

  it("closes on 'Cancelar' without submitting", async () => {
    const { user, onSubmit, onOpenChange } = setup({
      initialValues: EDIT_VALUES,
    });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("re-syncs the form each time the dialog reopens", () => {
    const onSubmit = vi.fn();
    const other: QuestionFormValues = {
      ...EDIT_VALUES,
      options: ["Glucosa", "ADN", "Lípidos", "Almidón"],
    };
    const { rerender } = render(
      <QuestionFormDialog
        open
        onOpenChange={() => {}}
        initialValues={EDIT_VALUES}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByPlaceholderText("Opción A")).toHaveValue("ATP");

    rerender(
      <QuestionFormDialog
        open={false}
        onOpenChange={() => {}}
        initialValues={other}
        onSubmit={onSubmit}
      />,
    );
    rerender(
      <QuestionFormDialog
        open
        onOpenChange={() => {}}
        initialValues={other}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByPlaceholderText("Opción A")).toHaveValue("Glucosa");
  });

  it("waits for an async submit, then closes when it reports no error", async () => {
    let resolve: (error: string | null) => void = () => {};
    const { user, onOpenChange } = setup({
      initialValues: EDIT_VALUES,
      onSubmit: () =>
        new Promise<string | null>((done) => {
          resolve = done;
        }),
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalled();
    resolve(null);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open and shows the error an async submit reports", async () => {
    const { user, onOpenChange } = setup({
      initialValues: EDIT_VALUES,
      onSubmit: async () => "Las opciones deben ser distintas.",
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las opciones deben ser distintas.",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("clears a previous error when the dialog opens again", async () => {
    const onSubmit = async () => "Algo falló.";
    const props = {
      initialValues: EDIT_VALUES,
      onOpenChange: vi.fn(),
      onSubmit,
    };
    const user = userEvent.setup();
    const { rerender } = render(<QuestionFormDialog {...props} open />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    rerender(<QuestionFormDialog {...props} open={false} />);
    rerender(<QuestionFormDialog {...props} open />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cannot be cancelled or dismissed while an async submit runs", async () => {
    let resolve: (error: string | null) => void = () => {};
    const { user, onOpenChange } = setup({
      initialValues: EDIT_VALUES,
      onSubmit: () =>
        new Promise<string | null>((done) => {
          resolve = done;
        }),
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();

    resolve(null);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("ignores a save that resolves after the dialog was closed and reopened", async () => {
    const pendingSaves: ((error: string | null) => void)[] = [];
    const props = {
      initialValues: EDIT_VALUES,
      onOpenChange: vi.fn(),
      onSubmit: () =>
        new Promise<string | null>((done) => {
          pendingSaves.push(done);
        }),
    };
    const user = userEvent.setup();
    const { rerender } = render(<QuestionFormDialog {...props} open />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();

    // The caller closes and reopens the dialog while the first save runs.
    rerender(<QuestionFormDialog {...props} open={false} />);
    rerender(<QuestionFormDialog {...props} open />);

    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    pendingSaves[0]?.("Algo falló.");
    await new Promise((done) => setTimeout(done, 0));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("ignores a stale save that succeeds after the dialog was reopened", async () => {
    const pendingSaves: ((error: string | null) => void)[] = [];
    const props = {
      initialValues: EDIT_VALUES,
      onOpenChange: vi.fn(),
      onSubmit: () =>
        new Promise<string | null>((done) => {
          pendingSaves.push(done);
        }),
    };
    const user = userEvent.setup();
    const { rerender } = render(<QuestionFormDialog {...props} open />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    rerender(<QuestionFormDialog {...props} open={false} />);
    rerender(<QuestionFormDialog {...props} open />);
    pendingSaves[0]?.(null);
    await new Promise((done) => setTimeout(done, 0));

    // The old save must not close the new session.
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("question-form-dialog")).toBeInTheDocument();
  });

  // Phase 8 H12: the exams theme, and the correct option's row is tinted.
  it("wears the exams theme and tints the correct option's row", async () => {
    const { user } = setup();

    const dialog = screen.getByRole("dialog", { name: "Editar pregunta" });
    expect(dialog).toHaveAttribute("data-technique-theme", "exams");
    expect(dialog.querySelector('[data-slot="pixel-tile"]')).toHaveAttribute(
      "data-tone",
      "rose",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toHaveAttribute("data-variant", "technique");

    const rowOf = (letter: string) =>
      screen
        .getByRole("radio", { name: `Opción ${letter} es la correcta` })
        .closest('[data-slot="answer-option"]');
    expect(rowOf("C")).toHaveAttribute("data-correct", "true");
    expect(rowOf("B")).not.toHaveAttribute("data-correct");

    await user.click(
      screen.getByRole("radio", { name: "Opción B es la correcta" }),
    );
    expect(rowOf("B")).toHaveAttribute("data-correct", "true");
    expect(rowOf("C")).not.toHaveAttribute("data-correct");
  });
});
