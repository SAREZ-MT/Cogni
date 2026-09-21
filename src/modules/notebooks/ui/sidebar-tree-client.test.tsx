import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarNotebook } from "../application/list-sidebar";
import { SidebarTreeClient } from "./sidebar-tree-client";

const { createNotebook, getSidebarTree, renameNotebook, renamePage } =
  vi.hoisted(() => ({
    createNotebook: vi.fn(),
    getSidebarTree: vi.fn(),
    renameNotebook: vi.fn(),
    renamePage: vi.fn(),
  }));
vi.mock("../actions", () => ({
  createNotebook,
  archiveNotebook: vi.fn(),
  archivePage: vi.fn(),
  createPage: vi.fn(),
  renameNotebook,
  renamePage,
  setNotebookAppearance: vi.fn(),
  getSidebarTree,
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("SidebarTreeClient", () => {
  beforeEach(() => {
    createNotebook.mockReset();
    getSidebarTree.mockReset();
    getSidebarTree.mockResolvedValue([]);
    renameNotebook.mockReset();
    renamePage.mockReset();
  });

  // Scenario "Reescritura de shell-empty-state.spec.ts" (e2e) — the same
  // empty-state copy and control are covered here at the component level.
  it("shows the empty-state message and a control to create the first notebook", () => {
    render(<SidebarTreeClient initialNotebooks={[]} />, { wrapper: Wrapper });

    expect(
      screen.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear cuaderno" }),
    ).toBeInTheDocument();
  });

  it("submits the dialog title through the createNotebook mutation", async () => {
    createNotebook.mockResolvedValue({
      id: "n1",
      title: "Trabajo",
      icon: null,
      color: null,
    });
    const user = userEvent.setup();
    render(<SidebarTreeClient initialNotebooks={[]} />, { wrapper: Wrapper });

    await user.click(screen.getByRole("button", { name: "Crear cuaderno" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Título"), "Trabajo");
    await user.click(dialog.getByRole("button", { name: "Crear cuaderno" }));

    expect(createNotebook).toHaveBeenCalledWith({ title: "Trabajo" });
  });

  it("renders active notebooks and their pages from initialData", () => {
    const initialNotebooks: SidebarNotebook[] = [
      {
        id: "n1",
        title: "Cuaderno 1",
        icon: null,
        color: null,
        pages: [{ id: "p1", title: "Página 1" }],
      },
    ];
    render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText("Cuaderno 1")).toBeInTheDocument();
    expect(screen.getByText("Página 1")).toBeInTheDocument();
  });

  // A failed mutation's rollback must never clobber a sibling mutation's
  // own optimistic update that landed on the tree afterward (the rollback
  // snapshot goes stale the moment another mutation touches the tree).
  it("keeps a sibling mutation's optimistic update after a concurrent mutation's rollback", async () => {
    let rejectRenameNotebook!: (error: Error) => void;
    renameNotebook.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRenameNotebook = reject;
      }),
    );
    renamePage.mockReturnValue(new Promise(() => {})); // stays pending
    // Never resolves: keeps onSettled's invalidate/refetch from replacing
    // the optimistic state we are asserting on.
    getSidebarTree.mockReturnValue(new Promise(() => {}));

    const initialNotebooks: SidebarNotebook[] = [
      { id: "n1", title: "Cuaderno 1", icon: null, color: null, pages: [] },
      {
        id: "n2",
        title: "Cuaderno 2",
        icon: null,
        color: null,
        pages: [{ id: "p1", title: "Página 1" }],
      },
    ];
    const user = userEvent.setup();
    render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
      wrapper: Wrapper,
    });

    // Mutation 1 (will fail): rename notebook n1.
    await user.dblClick(screen.getByRole("button", { name: "Cuaderno 1" }));
    await user.clear(screen.getByDisplayValue("Cuaderno 1"));
    await user.type(screen.getByRole("textbox"), "Cuaderno renombrado{Enter}");

    // Mutation 2 (stays pending, its optimistic update must survive):
    // rename page p1, started while mutation 1 is still in flight.
    await user.dblClick(screen.getByText("Página 1"));
    await user.clear(screen.getByDisplayValue("Página 1"));
    await user.type(screen.getByRole("textbox"), "Página renombrada{Enter}");

    expect(renameNotebook).toHaveBeenCalledTimes(1);
    expect(renamePage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Página renombrada")).toBeInTheDocument();

    // Mutation 1 rejects after mutation 2 already applied its own update.
    rejectRenameNotebook(new Error("network error"));
    // Flush the mutation's onError microtask before asserting; the string
    // we assert on is already present, so findByText alone would resolve
    // immediately without actually waiting for the rejection to settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // A wholesale rollback to mutation 1's pre-optimistic snapshot would
    // wipe mutation 2's still-pending optimistic rename back to "Página 1".
    expect(screen.queryByText("Página 1")).not.toBeInTheDocument();
    expect(screen.getByText("Página renombrada")).toBeInTheDocument();
  });
});
