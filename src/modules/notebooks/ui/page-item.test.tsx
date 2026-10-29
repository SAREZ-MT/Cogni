import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SidebarPage } from "../application/list-sidebar";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { PageItem } from "./page-item";

// Phase 8 H19: the delete dialogs call the notebooks Server Actions.
vi.mock("../actions", () => ({
  previewNotebookDeletion: vi.fn(),
  deleteNotebook: vi.fn(),
  previewPageDeletion: vi.fn(),
  deletePage: vi.fn(),
}));

const page: SidebarPage = { id: "p1", title: "Capítulo 1" };
const noop = () => {};

describe("PageItem", () => {
  // Regression guard for tests/e2e/notebooks-acceptance.spec.ts, which
  // targets these exact accessible names.
  it("keeps the existing page link and archive button accessible names", () => {
    render(
      <ul>
        <PageItem
          notebookId="n1"
          page={page}
          onRename={noop}
          onDeleted={noop}
        />
      </ul>,
    );

    expect(
      screen.getByRole("link", { name: "Capítulo 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar página Capítulo 1" }),
    ).toBeInTheDocument();
  });

  // Design pass 2 (5b87e25, sidebar as a floating card): the tree rows went
  // back to a single-line truncated title inside the narrower card, replacing
  // the S7 two-line clamp.
  it("truncates the title to a single line instead of wrapping", () => {
    render(
      <ul>
        <PageItem
          notebookId="n1"
          page={page}
          onRename={noop}
          onDeleted={noop}
        />
      </ul>,
    );

    const titleSpan = screen.getByText("Capítulo 1");
    expect(titleSpan.className).toContain("truncate");
    expect(titleSpan.className).not.toContain("line-clamp-2");
    expect(titleSpan.className).not.toContain("whitespace-normal");
  });

  it("renders no badge by default", () => {
    render(
      <ul>
        <PageItem
          notebookId="n1"
          page={page}
          onRename={noop}
          onDeleted={noop}
        />
      </ul>,
    );

    expect(screen.queryByTestId("import-badge")).not.toBeInTheDocument();
  });

  it("renders the injected badge next to the page title", () => {
    render(
      <NotebookActionsSlotProvider
        pageBadge={(p) => <span data-testid="import-badge">{p.id}</span>}
      >
        <ul>
          <PageItem
            notebookId="n1"
            page={page}
            onRename={noop}
            onDeleted={noop}
          />
        </ul>
      </NotebookActionsSlotProvider>,
    );

    expect(screen.getByTestId("import-badge")).toHaveTextContent("p1");
  });

  it("renders nothing for a badge slot that explicitly returns null (R3-badge-truthiness-and-editing)", () => {
    render(
      <NotebookActionsSlotProvider pageBadge={() => null}>
        <ul>
          <PageItem
            notebookId="n1"
            page={page}
            onRename={noop}
            onDeleted={noop}
          />
        </ul>
      </NotebookActionsSlotProvider>,
    );

    expect(screen.queryByTestId("import-badge")).not.toBeInTheDocument();
  });

  it("hides the injected badge while the page title is being edited (R3-badge-truthiness-and-editing)", async () => {
    const user = userEvent.setup();
    render(
      <NotebookActionsSlotProvider
        pageBadge={(p) => <span data-testid="import-badge">{p.id}</span>}
      >
        <ul>
          <PageItem
            notebookId="n1"
            page={page}
            onRename={noop}
            onDeleted={noop}
          />
        </ul>
      </NotebookActionsSlotProvider>,
    );
    expect(screen.getByTestId("import-badge")).toBeInTheDocument();

    await user.dblClick(screen.getByRole("link", { name: "Capítulo 1" }));

    expect(screen.queryByTestId("import-badge")).not.toBeInTheDocument();
  });
});
