import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarNotebook } from "../application/list-sidebar";
import { SidebarTreeClient } from "./sidebar-tree-client";

const { createNotebook, getSidebarTree } = vi.hoisted(() => ({
  createNotebook: vi.fn(),
  getSidebarTree: vi.fn(),
}));
vi.mock("../actions", () => ({
  createNotebook,
  archiveNotebook: vi.fn(),
  archivePage: vi.fn(),
  createPage: vi.fn(),
  renameNotebook: vi.fn(),
  renamePage: vi.fn(),
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
});
