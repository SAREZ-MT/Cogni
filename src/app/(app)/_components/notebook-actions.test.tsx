import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// notebook-actions.tsx is the composition root design.md assigns this exact
// wiring to ("Decision: Menú de acciones del cuaderno con slot inyectado
// desde la raíz de composición", step 5). `notebooks` and `ingestion` are
// mocked so this test proves only the wiring between them, the same way
// actions.test.ts files in this codebase mock their infrastructure.
const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/modules/ingestion", () => ({
  PdfImportProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="pdf-import-provider">{children}</div>
  ),
  ImportPdfMenuItem: ({
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
      Importar PDF de {notebook.title}
    </button>
  ),
}));

type MenuItems = (
  notebook: { id: string; title: string },
  helpers: { refreshTree: () => void },
) => ReactNode;

const { capturedSlotProps } = vi.hoisted(() => ({
  capturedSlotProps: [] as Array<{
    menuItems?: MenuItems;
    pageBadge?: unknown;
  }>,
}));
vi.mock("@/modules/notebooks/ui/notebook-actions-slot", () => ({
  NotebookActionsSlotProvider: (props: {
    children: ReactNode;
    menuItems?: MenuItems;
    pageBadge?: unknown;
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
  it("mounts PdfImportProvider around NotebookActionsSlotProvider and renders the children", async () => {
    const NotebookActions = await importNotebookActions();

    render(
      <NotebookActions>
        <div data-testid="sidebar-tree-stub">árbol</div>
      </NotebookActions>,
    );

    expect(screen.getByTestId("pdf-import-provider")).toBeInTheDocument();
    expect(screen.getByTestId("slot-provider")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-tree-stub")).toBeInTheDocument();
  });

  it("passes a menuItems function that renders ImportPdfMenuItem wired to the caller's refreshTree helper", async () => {
    const NotebookActions = await importNotebookActions();
    const refreshTree = vi.fn();
    const user = userEvent.setup();

    render(
      <NotebookActions>
        <div />
      </NotebookActions>,
    );

    const { menuItems } = capturedSlotProps.at(-1) ?? {};
    expect(menuItems).toBeDefined();
    render(menuItems?.({ id: "nb-1", title: "Biología" }, { refreshTree }));

    await user.click(
      screen.getByRole("button", { name: "Importar PDF de Biología" }),
    );

    expect(start).toHaveBeenCalledWith({ notebookId: "nb-1" });
    expect(refreshTree).toHaveBeenCalledTimes(1);
  });

  it("leaves pageBadge undefined (T13 adds the importing badge)", async () => {
    const NotebookActions = await importNotebookActions();

    render(
      <NotebookActions>
        <div />
      </NotebookActions>,
    );

    expect(capturedSlotProps.at(-1)?.pageBadge).toBeUndefined();
  });
});
