import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NotebookActionsSlotProvider,
  useNotebookActionsSlot,
} from "./notebook-actions-slot";

// Consumer probe: renders exactly what a real slot consumer (NotebookItem,
// PageItem) does — read the context, call the render props if present.
function Probe() {
  const slot = useNotebookActionsSlot();
  return (
    <div>
      <span data-testid="menu-items">
        {slot.menuItems?.(
          { id: "n1", title: "Biología" },
          { refreshTree: vi.fn() },
        ) ?? "none"}
      </span>
      <span data-testid="page-badge">
        {slot.pageBadge?.({ id: "p1" }) ?? "none"}
      </span>
    </div>
  );
}

describe("NotebookActionsSlotProvider", () => {
  it("defaults to no injected menu items and no badge when unmounted", () => {
    render(<Probe />);

    expect(screen.getByTestId("menu-items")).toHaveTextContent("none");
    expect(screen.getByTestId("page-badge")).toHaveTextContent("none");
  });

  it("exposes the injected menuItems render prop with the notebook and refreshTree helper", () => {
    const menuItems = vi.fn(
      (notebook: { id: string; title: string }) => `menu:${notebook.title}`,
    );

    render(
      <NotebookActionsSlotProvider menuItems={menuItems}>
        <Probe />
      </NotebookActionsSlotProvider>,
    );

    expect(screen.getByTestId("menu-items")).toHaveTextContent("menu:Biología");
    expect(menuItems).toHaveBeenCalledWith(
      { id: "n1", title: "Biología" },
      { refreshTree: expect.any(Function) },
    );
  });

  it("exposes the injected pageBadge render prop with the page", () => {
    const pageBadge = vi.fn((page: { id: string }) => `badge:${page.id}`);

    render(
      <NotebookActionsSlotProvider pageBadge={pageBadge}>
        <Probe />
      </NotebookActionsSlotProvider>,
    );

    expect(screen.getByTestId("page-badge")).toHaveTextContent("badge:p1");
    expect(pageBadge).toHaveBeenCalledWith({ id: "p1" });
  });

  it("keeps the default (no items) when only pageBadge is provided", () => {
    render(
      <NotebookActionsSlotProvider pageBadge={() => "b"}>
        <Probe />
      </NotebookActionsSlotProvider>,
    );

    expect(screen.getByTestId("menu-items")).toHaveTextContent("none");
  });
});
