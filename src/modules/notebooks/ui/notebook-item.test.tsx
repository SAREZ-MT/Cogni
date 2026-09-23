import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import type { SidebarNotebook } from "../application/list-sidebar";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { NotebookItem } from "./notebook-item";
import { SIDEBAR_TREE_QUERY_KEY } from "./sidebar-tree-query-key";

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

function notebookItemElement() {
  return (
    <NotebookItem
      notebook={notebook}
      onRename={noop}
      onSetAppearance={noop}
      onArchive={noop}
      onCreatePage={noop}
      onRenamePage={noop}
      onArchivePage={noop}
    />
  );
}

describe("NotebookItem", () => {
  // Regression guard for tests/e2e/notebooks-acceptance.spec.ts, which
  // targets these exact accessible names.
  it("keeps the existing notebook action buttons and their accessible names", () => {
    renderNotebookItem(notebookItemElement());

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

  // S3 sidebar-order fix, "notebook rows not truncating early": the hover
  // actions used to reserve inline flex space at all times, shrinking the
  // title even when nothing was hovered. They must now float over the row
  // (removed from flow) so the title's flex-1 always gets the full width.
  it("floats the hover actions instead of reserving inline space next to the title", () => {
    renderNotebookItem(notebookItemElement());

    const title = screen.getByRole("button", { name: "Biología" });
    expect(title.className).toContain("flex-1");

    const actions = screen
      .getByRole("button", { name: "Archivar cuaderno Biología" })
      .closest('[data-slot="notebook-item-actions"]');
    expect(actions).not.toBeNull();
    // Actions stay in flow but hidden until hover/focus-within: they must
    // never overlay the title (an absolute overlay intercepted clicks and
    // double-clicks on the title's right half, breaking rename).
    // ...and never `display: none` either: Playwright/assistive tech must
    // still find the action buttons without hovering first (the e2e
    // suite clicks "Crear página en {título}" directly). In-flow +
    // opacity-0 is the Phase 1 behaviour that keeps both properties.
    expect(actions).not.toHaveClass("absolute");
    expect(actions).not.toHaveClass("hidden");
    expect(actions).toHaveClass("opacity-0");
    expect(actions).toHaveClass("group-hover/notebook:opacity-100");
    expect(actions).toHaveClass("group-focus-within/notebook:opacity-100");
  });

  it("does not render the actions menu trigger by default (no slot mounted)", () => {
    renderNotebookItem(notebookItemElement());

    expect(
      screen.queryByRole("button", { name: "Acciones de Biología" }),
    ).not.toBeInTheDocument();
  });

  it("does not render the actions menu trigger when a mounted slot yields no items (T9 visual follow-up: empty Radix menu renders as a thin sliver)", () => {
    renderNotebookItem(
      <NotebookActionsSlotProvider menuItems={() => null}>
        {notebookItemElement()}
      </NotebookActionsSlotProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Acciones de Biología" }),
    ).not.toBeInTheDocument();
  });

  it("renders without a QueryClientProvider when no slot is mounted (R3-hard-queryclient-dependency)", () => {
    expect(() => render(notebookItemElement())).not.toThrow();
    expect(
      screen.getByRole("button", { name: "Archivar cuaderno Biología" }),
    ).toBeInTheDocument();
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
        {notebookItemElement()}
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

  it("passes a refreshTree helper that invalidates the real sidebar tree query key", async () => {
    const invalidateQueries = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.invalidateQueries = invalidateQueries;
    const menuItems = vi.fn(
      (
        _notebook: { id: string; title: string },
        _helpers: { refreshTree: () => void },
      ) => <DropdownMenuItem>Importar PDF</DropdownMenuItem>,
    );
    const user = userEvent.setup();

    renderNotebookItem(
      <NotebookActionsSlotProvider menuItems={menuItems}>
        {notebookItemElement()}
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
      queryKey: SIDEBAR_TREE_QUERY_KEY,
    });
  });
});
