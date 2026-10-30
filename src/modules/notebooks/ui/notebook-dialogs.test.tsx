import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangeAppearanceDialog } from "./change-appearance-dialog";
import { CreateNotebookDialog } from "./create-notebook-dialog";
import { RenameNotebookDialog } from "./rename-notebook-dialog";

// Phase 8 H12 (user 2026-10-29): the notebook dialogs share the polished
// form-dialog shell: a short description, a labelled 44px field, a violet
// primary (never the dark default) and an outline Cancelar.
describe("notebook dialogs", () => {
  it("Nuevo cuaderno: described, labelled field, violet primary", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<CreateNotebookDialog onCreate={onCreate} />);
    await user.click(screen.getByRole("button", { name: "Crear cuaderno" }));

    const dialog = screen.getByRole("dialog", { name: "Nuevo cuaderno" });
    expect(dialog).toHaveAccessibleDescription(
      "Uno por materia o tema: ahí se juntan sus páginas.",
    );
    const title = within(dialog).getByRole("textbox", { name: "Título" });
    expect(title).toHaveAttribute("data-slot", "input");
    const create = within(dialog).getByRole("button", {
      name: "Crear cuaderno",
    });
    expect(create).toHaveAttribute("data-variant", "brand");
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveAttribute("data-variant", "outline");

    await user.type(title, "Biología{Enter}");
    expect(onCreate).toHaveBeenCalledWith("Biología");
  });

  it("Renombrar cuaderno: violet Guardar", async () => {
    const user = userEvent.setup();
    render(
      <RenameNotebookDialog
        initialTitle="Biología"
        onRename={() => {}}
        trigger={<button type="button">Renombrar</button>}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Renombrar" }));

    const dialog = screen.getByRole("dialog", { name: "Renombrar cuaderno" });
    expect(within(dialog).getByRole("textbox", { name: "Título" })).toHaveValue(
      "Biología",
    );
    expect(
      within(dialog).getByRole("button", { name: "Guardar" }),
    ).toHaveAttribute("data-variant", "brand");
  });

  it("Apariencia: described, marks the current colour as pressed", async () => {
    const user = userEvent.setup();
    render(
      <ChangeAppearanceDialog
        notebookTitle="Biología"
        currentColor="green"
        onChange={() => {}}
        trigger={<button type="button">Cambiar apariencia</button>}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Cambiar apariencia" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Apariencia de Biología",
    });
    expect(dialog).toHaveAccessibleDescription("Elige el color de su portada.");
    expect(
      within(dialog).getByRole("button", { name: "Color green" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: "Color pink" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
