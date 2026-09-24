import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SidebarPage } from "../application/list-sidebar";
import { NotebookActionsSlotProvider } from "./notebook-actions-slot";
import { PageItem } from "./page-item";

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
          onArchive={noop}
        />
      </ul>,
    );

    expect(
      screen.getByRole("link", { name: "Capítulo 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archivar página Capítulo 1" }),
    ).toBeInTheDocument();
  });

  // S7 (odd/tasks/app-shell-restyle.md, sidebar-preview.png): page titles
  // get the same two-line clamp treatment as notebook titles instead of
  // truncating to a single line.
  it("clamps the title to two lines and wraps instead of truncating", () => {
    render(
      <ul>
        <PageItem
          notebookId="n1"
          page={page}
          onRename={noop}
          onArchive={noop}
        />
      </ul>,
    );

    const link = screen.getByRole("link", { name: "Capítulo 1" });
    expect(link.className).not.toContain("truncate");

    const titleSpan = screen.getByText("Capítulo 1");
    expect(titleSpan.className).toContain("line-clamp-2");
    expect(titleSpan.className).toContain("whitespace-normal");
    expect(titleSpan.className).not.toContain("truncate");
  });

  it("renders no badge by default", () => {
    render(
      <ul>
        <PageItem
          notebookId="n1"
          page={page}
          onRename={noop}
          onArchive={noop}
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
            onArchive={noop}
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
            onArchive={noop}
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
            onArchive={noop}
          />
        </ul>
      </NotebookActionsSlotProvider>,
    );
    expect(screen.getByTestId("import-badge")).toBeInTheDocument();

    await user.dblClick(screen.getByRole("link", { name: "Capítulo 1" }));

    expect(screen.queryByTestId("import-badge")).not.toBeInTheDocument();
  });
});
