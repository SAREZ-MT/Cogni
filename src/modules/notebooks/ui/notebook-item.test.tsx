import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import type { SidebarNotebook } from "../application/list-sidebar";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { NotebookItem } from "./notebook-item";

const notebook: SidebarNotebook = {
  id: "n1",
  title: "Biología",
  icon: null,
  color: null,
  pages: [],
};

const noop = () => {};

function renderNotebookItem(
  ui: React.ReactElement,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe("NotebookItem", () => {
  // Regression guard for tests/e2e/notebooks-acceptance.spec.ts, which
  // targets these exact accessible names.
  it("keeps the existing notebook action buttons and their accessible names", () => {
    renderNotebookItem(
      <NotebookItem
        notebook={notebook}
        onRename={noop}
        onSetAppearance={noop}
        onArchive={noop}
        onCreatePage={noop}
        onRenamePage={noop}
        onArchivePage={noop}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cambiar apariencia de Biología" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear página en Biología" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archivar cuaderno Biología" }),
    ).toBeInTheDocument();
  });

  it("renders an actions menu trigger with no items by default", async () => {
    const user = userEvent.setup();
    renderNotebookItem(
      <NotebookItem
        notebook={notebook}
        onRename={noop}
        onSetAppearance={noop}
        onArchive={noop}
        onCreatePage={noop}
        onRenamePage={noop}
        onArchivePage={noop}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Acciones de Biología",
    });
    await user.click(trigger);

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("opens the actions menu from the keyboard and activates an injected item with Enter", async () => {
    const onImport = vi.fn();
    const user = userEvent.setup();

    renderNotebookItem(
      <NotebookActionsSlotProvider
        menuItems={(nb) => (
          <DropdownMenuItem onSelect={() => onImport(nb.id)}>
            Importar PDF
          </DropdownMenuItem>
        )}
      >
        <NotebookItem
          notebook={notebook}
          onRename={noop}
          onSetAppearance={noop}
          onArchive={noop}
          onCreatePage={noop}
          onRenamePage={noop}
          onArchivePage={noop}
        />
      </NotebookActionsSlotProvider>,
    );

    screen.getByRole("button", { name: "Acciones de Biología" }).focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("menuitem", { name: "Importar PDF" }),
    ).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(onImport).toHaveBeenCalledWith("n1");
  });

  it("passes a refreshTree helper that invalidates the sidebar tree query", async () => {
    const invalidateQueries = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.invalidateQueries = invalidateQueries;
    const menuItems = vi.fn(
      (
        _notebook: { id: string; title: string },
        _helpers: { refreshTree: () => void },
      ) => null,
    );
    const user = userEvent.setup();

    renderNotebookItem(
      <NotebookActionsSlotProvider menuItems={menuItems}>
        <NotebookItem
          notebook={notebook}
          onRename={noop}
          onSetAppearance={noop}
          onArchive={noop}
          onCreatePage={noop}
          onRenamePage={noop}
          onArchivePage={noop}
        />
      </NotebookActionsSlotProvider>,
      client,
    );

    await user.click(
      screen.getByRole("button", { name: "Acciones de Biología" }),
    );

    expect(menuItems).toHaveBeenCalledWith(
      { id: "n1", title: "Biología" },
      { refreshTree: expect.any(Function) },
    );
    const helpers = menuItems.mock.calls[0]?.[1];
    helpers?.refreshTree();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notebooks", "sidebar-tree"],
    });
  });
});
