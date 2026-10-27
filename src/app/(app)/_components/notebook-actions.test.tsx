import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// notebook-actions.tsx is the composition root design.md assigns this exact
// wiring to ("Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 5). `notebooks` and `ingestion` are
// mocked so this test proves only the wiring between them, the same way
// actions.test.ts files in this codebase mock their infrastructure.
const { start } = vi.hoisted(() => ({ start: vi.fn() }));
const { capturedActiveImportsProps } = vi.hoisted(() => ({
  capturedActiveImportsProps: [] as Array<{ initialPageIds: string[] }>,
}));
vi.mock("@/modules/ingestion", () => ({
  DocumentImportProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="document-import-provider">{children}</div>
  ),
  ImportDocumentMenuItem: ({
    notebook,
    onImported,
  }: {
    notebook: { id: string; title: string };
    onImported?: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        start({ notebookId: notebook.id });
        onImported?.();
      }}
    >
      Importar documento de {notebook.title}
    </button>
  ),
  ActiveImportsProvider: ({
    initialPageIds,
    children,
  }: {
    initialPageIds: string[];
    children: ReactNode;
  }) => {
    capturedActiveImportsProps.push({ initialPageIds });
    return <div data-testid="active-imports-provider">{children}</div>;
  },
  ImportingPageBadge: ({ pageId }: { pageId: string }) => (
    <span data-testid={`badge-${pageId}`}>importando</span>
  ),
}));

type MenuItems = (
  notebook: { id: string; title: string },
  helpers: { refreshTree: () => void },
) => ReactNode;
type PageBadge = (page: { id: string }) => ReactNode;

const { capturedSlotProps } = vi.hoisted(() => ({
  capturedSlotProps: [] as Array<{
    menuItems?: MenuItems;
    pageBadge?: PageBadge;
  }>,
}));
vi.mock("@/modules/notebooks/ui/notebook-actions-slot", () => ({
  NotebookActionsSlotProvider: (props: {
    children: ReactNode;
    menuItems?: MenuItems;
    pageBadge?: PageBadge;
  }) => {
    capturedSlotProps.push(props);
    return <div data-testid="slot-provider">{props.children}</div>;
  },
}));

async function importNotebookActions() {
  const mod = await import("./notebook-actions");
  return mod.NotebookActions;
}

describe("NotebookActions composition root", () => {
  it("mounts ActiveImportsProvider around DocumentImportProvider around NotebookActionsSlotProvider and renders the children", async () => {
    const NotebookActions = await importNotebookActions();

    render(
      <NotebookActions initialPageIds={[]}>
        <div data-testid="sidebar-tree-stub">árbol</div>
      </NotebookActions>,
    );

    expect(screen.getByTestId("active-imports-provider")).toBeInTheDocument();
    expect(screen.getByTestId("document-import-provider")).toBeInTheDocument();
    expect(screen.getByTestId("slot-provider")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-tree-stub")).toBeInTheDocument();
  });

  it("passes initialPageIds through to ActiveImportsProvider (server-side getActiveImports() call in layout.tsx)", async () => {
    const NotebookActions = await importNotebookActions();

    render(
      <NotebookActions initialPageIds={["page-1", "page-2"]}>
        <div />
      </NotebookActions>,
    );

    expect(capturedActiveImportsProps.at(-1)?.initialPageIds).toEqual([
      "page-1",
      "page-2",
    ]);
  });

  it("passes a menuItems function that renders ImportDocumentMenuItem wired to the caller's refreshTree helper", async () => {
    const NotebookActions = await importNotebookActions();
    const refreshTree = vi.fn();
    const user = userEvent.setup();

    render(
      <NotebookActions initialPageIds={[]}>
        <div />
      </NotebookActions>,
    );

    const { menuItems } = capturedSlotProps.at(-1) ?? {};
    expect(menuItems).toBeDefined();
    render(menuItems?.({ id: "nb-1", title: "Biología" }, { refreshTree }));

    await user.click(
      screen.getByRole("button", { name: "Importar documento de Biología" }),
    );

    expect(start).toHaveBeenCalledWith({ notebookId: "nb-1" });
    expect(refreshTree).toHaveBeenCalledTimes(1);
  });

  it("passes a pageBadge function that renders ImportingPageBadge for the given page", async () => {
    const NotebookActions = await importNotebookActions();

    render(
      <NotebookActions initialPageIds={[]}>
        <div />
      </NotebookActions>,
    );

    const { pageBadge } = capturedSlotProps.at(-1) ?? {};
    expect(pageBadge).toBeDefined();
    render(pageBadge?.({ id: "page-1" }) as ReactElement);

    expect(screen.getByTestId("badge-page-1")).toBeInTheDocument();
  });
});
