import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { NotebookCardActions } from "./notebook-card-actions";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const {
  renameNotebook,
  setNotebookAppearance,
  previewNotebookDeletion,
  deleteNotebook,
} = vi.hoisted(() => ({
  renameNotebook: vi.fn().mockResolvedValue(undefined),
  setNotebookAppearance: vi.fn().mockResolvedValue(undefined),
  previewNotebookDeletion: vi.fn(),
  deleteNotebook: vi.fn(),
}));
vi.mock("../actions", () => ({
  renameNotebook,
  setNotebookAppearance,
  previewNotebookDeletion,
  deleteNotebook,
}));

const notebook = {
  id: "n1",
  title: "Biología",
  icon: null,
  color: "purple" as const,
};

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Acciones de Biología" }),
  );
}

describe("NotebookCardActions", () => {
  beforeEach(() => {
    refresh.mockReset();
    renameNotebook.mockClear();
    setNotebookAppearance.mockClear();
    previewNotebookDeletion.mockReset().mockResolvedValue({
      ok: true,
      value: { pages: 4, decks: 2, recallSets: 0, examSets: 1 },
    });
    deleteNotebook.mockReset().mockResolvedValue({
      ok: true,
      value: { notebookId: "n1" },
    });
  });

  it("offers rename, appearance and delete", async () => {
    const user = userEvent.setup();
    render(<NotebookCardActions notebook={notebook} />);

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: "Renombrar" })).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Cambiar apariencia" }),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Eliminar" })).toBeVisible();
  });

  // Phase 8 H19: a real delete, confirmed in the app dialog with the
  // server's cascade counts.
  it("deletes the notebook after confirming the counts, then refreshes", async () => {
    const user = userEvent.setup();
    render(<NotebookCardActions notebook={notebook} />);

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    const dialog = await screen.findByRole("dialog", {
      name: "¿Eliminar el cuaderno «Biología»?",
    });
    expect(
      await screen.findByText("Se eliminarán 4 páginas, 2 mazos y 1 examen."),
    ).toBeInTheDocument();
    expect(previewNotebookDeletion).toHaveBeenCalledWith({ notebookId: "n1" });
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar cuaderno" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(deleteNotebook).toHaveBeenCalledWith({ notebookId: "n1" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the delete fails", async () => {
    deleteNotebook.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOTEBOOK_NOT_FOUND", message: "x" },
    });
    const user = userEvent.setup();
    render(<NotebookCardActions notebook={notebook} />);

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    await screen.findByText("Se eliminarán 4 páginas, 2 mazos y 1 examen.");
    await user.click(screen.getByRole("button", { name: "Eliminar cuaderno" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este cuaderno ya no existe.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  describe("items injected through the notebook actions slot (PDF import)", () => {
    it("renders the injected items in the card menu, for the card's notebook", async () => {
      const onImport = vi.fn();
      const menuItems = vi.fn((nb: { id: string; title: string }) => (
        <DropdownMenuItem onSelect={() => onImport(nb.id)}>
          Importar PDF
        </DropdownMenuItem>
      ));
      const user = userEvent.setup();
      render(
        <NotebookActionsSlotProvider menuItems={menuItems}>
          <NotebookCardActions notebook={notebook} />
        </NotebookActionsSlotProvider>,
      );

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: "Importar PDF" }));

      expect(menuItems).toHaveBeenCalledWith(
        { id: "n1", title: "Biología" },
        { refreshTree: expect.any(Function) },
      );
      expect(onImport).toHaveBeenCalledWith("n1");
    });

    it("refreshes the server-rendered screen when an injected action reports a change", async () => {
      let refreshTree: () => void = () => {};
      const user = userEvent.setup();
      render(
        <NotebookActionsSlotProvider
          menuItems={(_nb, helpers) => {
            refreshTree = helpers.refreshTree;
            return <DropdownMenuItem>Importar PDF</DropdownMenuItem>;
          }}
        >
          <NotebookCardActions notebook={notebook} />
        </NotebookActionsSlotProvider>,
      );
      await openMenu(user);

      refreshTree();

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("shows only the built-in items when no slot is mounted", async () => {
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);

      expect(
        screen.queryByRole("menuitem", { name: "Importar PDF" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("menu after a dialog item completes", () => {
    it("closes the actions menu once a rename is saved", async () => {
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      await user.clear(screen.getByLabelText("Título"));
      await user.type(screen.getByLabelText("Título"), "Química");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(renameNotebook).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes the actions menu once an appearance color is picked", async () => {
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(
        screen.getByRole("menuitem", { name: "Cambiar apariencia" }),
      );
      await user.click(screen.getByRole("button", { name: "Color mint" }));

      await waitFor(() => expect(setNotebookAppearance).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes the actions menu when the dialog is cancelled", async () => {
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  // F4b (odd/tasks/review-followups.md): the actions throw on failure and the
  // transitions used to swallow it, so nothing told the user and the menu
  // simply closed as if it had worked.
  describe("when an action fails", () => {
    it("announces a failed rename and does not refresh", async () => {
      renameNotebook.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      await user.clear(screen.getByLabelText("Título"));
      await user.type(screen.getByLabelText("Título"), "Química");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No se pudo renombrar el cuaderno",
      );
      expect(refresh).not.toHaveBeenCalled();
    });

    it("announces a failed appearance change", async () => {
      setNotebookAppearance.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(
        screen.getByRole("menuitem", { name: "Cambiar apariencia" }),
      );
      await user.click(screen.getByRole("button", { name: "Color mint" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No se pudo cambiar la apariencia del cuaderno",
      );
      expect(refresh).not.toHaveBeenCalled();
    });

    it("clears a failure message when dismissed", async () => {
      renameNotebook.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      await user.clear(screen.getByLabelText("Título"));
      await user.type(screen.getByLabelText("Título"), "Química");
      await user.click(screen.getByRole("button", { name: "Guardar" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not announce anything when the action succeeds", async () => {
      const user = userEvent.setup();
      render(<NotebookCardActions notebook={notebook} />);

      await openMenu(user);
      await user.click(
        screen.getByRole("menuitem", { name: "Cambiar apariencia" }),
      );
      await user.click(screen.getByRole("button", { name: "Color mint" }));

      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
