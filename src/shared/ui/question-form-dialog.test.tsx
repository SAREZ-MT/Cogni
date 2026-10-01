import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  QuestionFormDialog,
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
    mode?: "create" | "edit";
    initialValues?: QuestionFormValues;
    open?: boolean;
  } = {},
) {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <QuestionFormDialog
      open={props.open ?? true}
      onOpenChange={onOpenChange}
      mode={props.mode ?? "create"}
      initialValues={props.initialValues}
      onSubmit={onSubmit}
    />,
  );
  return { user, onSubmit, onOpenChange, ...view };
}

async function fillValid(user: User) {
  await user.type(screen.getByLabelText("Enunciado"), "  Pregunta nueva ");
  await user.type(screen.getByPlaceholderText("Opción A"), "Uno");
  await user.type(screen.getByPlaceholderText("Opción B"), "Dos");
  await user.type(screen.getByPlaceholderText("Opción C"), "Tres");
  await user.type(screen.getByPlaceholderText("Opción D"), "Cuatro");
  await user.type(screen.getByLabelText("Concepto que evalúa"), " Concepto ");
}

describe("QuestionFormDialog", () => {
  it("renders nothing while closed", () => {
    setup({ open: false });

    expect(
      screen.queryByTestId("question-form-dialog"),
    ).not.toBeInTheDocument();
  });

  it("titles the dialog by mode", () => {
    const { unmount } = setup({ mode: "create" });
    expect(screen.getByText("Nueva pregunta")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar pregunta" }),
    ).toBeInTheDocument();
    unmount();

    setup({ mode: "edit", initialValues: EDIT_VALUES });
    expect(screen.getByText("Editar pregunta")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
  });

  it("starts empty with option A marked correct in create mode", () => {
    setup();

    expect(screen.getByLabelText("Enunciado")).toHaveValue("");
    expect(
      screen.getByRole("radio", { name: "Opción A es la correcta" }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar pregunta" }),
    ).toBeDisabled();
  });

  it("prefills every field in edit mode", () => {
    setup({ mode: "edit", initialValues: EDIT_VALUES });

    expect(screen.getByLabelText("Enunciado")).toHaveValue(EDIT_VALUES.stem);
    expect(screen.getByPlaceholderText("Opción C")).toHaveValue("Lípidos");
    expect(
      screen.getByRole("radio", { name: "Opción C es la correcta" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Concepto que evalúa")).toHaveValue(
      "Función de la mitocondria",
    );
  });

  it("ignores initial values in create mode", () => {
    setup({ mode: "create", initialValues: undefined });

    expect(screen.getByPlaceholderText("Opción A")).toHaveValue("");
  });

  it.each([
    ["the stem", "Enunciado"],
    ["an option", "Opción B"],
    ["the concept", "Concepto que evalúa"],
  ])("keeps saving disabled while %s is missing", async (_name, field) => {
    const { user } = setup({ mode: "edit", initialValues: EDIT_VALUES });
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
    const { user } = setup({ mode: "edit", initialValues: EDIT_VALUES });

    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), "   ");

    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
  });

  it("does not require the explanation", async () => {
    const { user } = setup();

    await fillValid(user);

    expect(
      screen.getByRole("button", { name: "Guardar pregunta" }),
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

    await fillValid(user);
    await user.click(
      screen.getByRole("radio", { name: "Opción C es la correcta" }),
    );
    await user.type(
      screen.getByLabelText("Explicación (opcional)"),
      "  Porque sí ",
    );
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));

    expect(onSubmit).toHaveBeenCalledWith({
      stem: "Pregunta nueva",
      options: ["Uno", "Dos", "Tres", "Cuatro"],
      correctIndex: 2,
      concept: "Concepto",
      explanation: "Porque sí",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits edited values", async () => {
    const { user, onSubmit } = setup({
      mode: "edit",
      initialValues: EDIT_VALUES,
    });

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
      mode: "edit",
      initialValues: EDIT_VALUES,
    });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("re-syncs the form each time the dialog reopens", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <QuestionFormDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initialValues={EDIT_VALUES}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByPlaceholderText("Opción A")).toHaveValue("ATP");

    rerender(
      <QuestionFormDialog
        open={false}
        onOpenChange={() => {}}
        mode="create"
        onSubmit={onSubmit}
      />,
    );
    rerender(
      <QuestionFormDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByPlaceholderText("Opción A")).toHaveValue("");
  });
});
