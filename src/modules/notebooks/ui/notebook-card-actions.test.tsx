import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { NotebookCardActions } from "./notebook-card-actions";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { renameNotebook, setNotebookAppearance, archiveNotebook } = vi.hoisted(
  () => ({
    renameNotebook: vi.fn().mockResolvedValue(undefined),
    setNotebookAppearance: vi.fn().mockResolvedValue(undefined),
    archiveNotebook: vi.fn().mockResolvedValue(undefined),
  }),
);
vi.mock("../actions", () => ({
  renameNotebook,
  setNotebookAppearance,
  archiveNotebook,
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
    archiveNotebook.mockClear();
  });

  it("offers rename, appearance and archive", async () => {
    const user = userEvent.setup();
    render(<NotebookCardActions notebook={notebook} />);

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: "Renombrar" })).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Cambiar apariencia" }),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Archivar" })).toBeVisible();
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
});
