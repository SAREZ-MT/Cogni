import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarNotebook } from "../application/list-sidebar";
import { SidebarTreeClient } from "./sidebar-tree-client";

const {
  createNotebook,
  createPage,
  getSidebarTree,
  renameNotebook,
  renamePage,
} = vi.hoisted(() => ({
  createNotebook: vi.fn(),
  createPage: vi.fn(),
  getSidebarTree: vi.fn(),
  renameNotebook: vi.fn(),
  renamePage: vi.fn(),
}));
vi.mock("../actions", () => ({
  createNotebook,
  archiveNotebook: vi.fn(),
  archivePage: vi.fn(),
  createPage,
  renameNotebook,
  renamePage,
  setNotebookAppearance: vi.fn(),
  getSidebarTree,
}));

// S4 review follow-up ("refresh after creating a notebook"): a notebook
// created from the sidebar must also refresh Home's server-rendered data.
// Extended for the same follow-up's remaining mutations: the refresh must
// only fire while the user is actually on Home (pathname "/inicio"), never on
// another route (e.g. mid-edit on a page), so usePathname is mocked too.
const { refresh, pathname } = vi.hoisted(() => ({
  refresh: vi.fn(),
  pathname: { current: "/inicio" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => pathname.current,
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
    createPage.mockReset();
    getSidebarTree.mockReset();
    getSidebarTree.mockResolvedValue([]);
    renameNotebook.mockReset();
    renamePage.mockReset();
    refresh.mockReset();
    pathname.current = "/inicio";
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

  // S4 review follow-up: a notebook created from the sidebar's own dialog
  // must refresh Home's server-rendered data too, not only the sidebar
  // tree's React Query cache. R3-refresh-assertion-without-waitfor: wrapped
  // in waitFor like the other refresh tests instead of asserting
  // synchronously right after the click.
  it("refreshes the router after successfully creating a notebook", async () => {
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

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  // R3-sidebar-create-notebook-unconditional-refresh: createNotebook must
  // go through refreshHomeIfActive() like every other mutation, not call
  // router.refresh() unconditionally — a notebook created from the sidebar
  // while editing a page must not re-render that page route.
  //
  // R3-001 (review follow-up folded into S6a): asserting `refresh` was not
  // called right after awaiting only `createNotebook` proved nothing — the
  // mutation's `onSuccess` (which conditionally calls
  // `refreshHomeIfActive()`) may not have run yet at that point, so the
  // assertion could pass for the wrong reason. `onSettled: invalidate()`
  // always runs strictly after `onSuccess` in TanStack Query's mutation
  // lifecycle, and it calls `getSidebarTree` again (the mount's own
  // background refetch is the first call) — waiting for that second call is
  // a deterministic "onSuccess has finished" sign that does not depend on a
  // DOM race the way waiting for the optimistic row to settle would (a
  // second `getSidebarTree` mock resolving mid-interaction can otherwise
  // flip `notebooks.length === 0` to the populated branch and unmount the
  // still-open dialog).
  it("does not refresh the router after creating a notebook outside Home", async () => {
    pathname.current = "/notebooks/n1/pages/p1";
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

    await waitFor(() => {
      expect(createNotebook).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(getSidebarTree.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(refresh).not.toHaveBeenCalled();
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
  it("rolls back a lone failed rename to the previous title", async () => {
    renameNotebook.mockRejectedValue(new Error("network error"));
    // Never resolves: the rollback itself must restore the title, not the
    // refetch triggered by onSettled.
    getSidebarTree.mockReturnValue(new Promise(() => {}));

    const initialNotebooks: SidebarNotebook[] = [
      { id: "n1", title: "Cuaderno 1", icon: null, color: null, pages: [] },
    ];
    const user = userEvent.setup();
    render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
      wrapper: Wrapper,
    });

    await user.dblClick(screen.getByRole("button", { name: "Cuaderno 1" }));
    await user.clear(screen.getByDisplayValue("Cuaderno 1"));
    await user.type(screen.getByRole("textbox"), "Cuaderno renombrado{Enter}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(renameNotebook).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Cuaderno renombrado")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cuaderno 1" }),
    ).toBeInTheDocument();
  });

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

  // Defect: an optimistic page still carrying its temporary client-only id
  // must not be a navigable link (clicking it before the real id arrives
  // 404s), and its notebook's "Crear página" action must not be usable
  // until its own temporary id has been swapped for the real one.
  describe("pending optimistic entries", () => {
    it("renders an optimistic page as non-navigable until its real id arrives", async () => {
      let resolveCreatePage!: (page: { id: string; title: string }) => void;
      createPage.mockReturnValue(
        new Promise((resolve) => {
          resolveCreatePage = resolve;
        }),
      );
      // Never resolves: keeps the background refetch from overwriting the
      // optimistic tree with the stale (still real-notebooks-only) fixture
      // while `await user.click` flushes microtasks, the same reasoning as
      // the rollback tests above.
      getSidebarTree.mockReturnValue(new Promise(() => {}));
      const initialNotebooks: SidebarNotebook[] = [
        { id: "n1", title: "Cuaderno 1", icon: null, color: null, pages: [] },
      ];
      const user = userEvent.setup();
      render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
        wrapper: Wrapper,
      });

      await user.click(
        screen.getByRole("button", { name: "Crear página en Cuaderno 1" }),
      );

      expect(screen.getByText("Sin título")).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Sin título/ }),
      ).not.toBeInTheDocument();

      await act(async () => {
        resolveCreatePage({ id: "real-page-id", title: "Sin título" });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.getByRole("link", { name: /Sin título/ })).toHaveAttribute(
        "href",
        "/notebooks/n1/pages/real-page-id",
      );
    });

    it("disables a pending notebook's create-page action until its real id arrives", async () => {
      let resolveCreateNotebook!: (notebook: {
        id: string;
        title: string;
        icon: null;
        color: null;
      }) => void;
      createNotebook.mockReturnValue(
        new Promise((resolve) => {
          resolveCreateNotebook = resolve;
        }),
      );
      getSidebarTree.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<SidebarTreeClient initialNotebooks={[]} />, { wrapper: Wrapper });

      await user.click(screen.getByRole("button", { name: "Crear cuaderno" }));
      const dialog = within(screen.getByRole("dialog"));
      await user.type(dialog.getByLabelText("Título"), "Trabajo");
      await user.click(dialog.getByRole("button", { name: "Crear cuaderno" }));

      expect(
        screen.getByRole("button", { name: "Crear página en Trabajo" }),
      ).toBeDisabled();

      await act(async () => {
        resolveCreateNotebook({
          id: "real-notebook-id",
          title: "Trabajo",
          icon: null,
          color: null,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(
        screen.getByRole("button", { name: "Crear página en Trabajo" }),
      ).toBeEnabled();
    });
  });

  // Defect: Home's stats/grid/recent pages are server-rendered, so any
  // sidebar mutation besides createNotebook (which already refreshes) must
  // also refresh Home's server data, but only while the user is actually on
  // Home — a refresh while editing a page would re-render the editor route.
  describe("refreshing Home after other mutations", () => {
    it("refreshes the router after creating a page while on Home", async () => {
      createPage.mockResolvedValue({ id: "p1", title: "Sin título" });
      // Never resolves: same reasoning as the "pending optimistic entries"
      // tests above — keeps the background refetch from tearing down the
      // notebook (and its "Crear página" button) mid-interaction.
      getSidebarTree.mockReturnValue(new Promise(() => {}));
      const initialNotebooks: SidebarNotebook[] = [
        { id: "n1", title: "Cuaderno 1", icon: null, color: null, pages: [] },
      ];
      const user = userEvent.setup();
      render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
        wrapper: Wrapper,
      });

      await user.click(
        screen.getByRole("button", { name: "Crear página en Cuaderno 1" }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(refresh).toHaveBeenCalled();
    });

    it("does not refresh the router after creating a page outside Home", async () => {
      pathname.current = "/notebooks/n1/pages/p1";
      createPage.mockResolvedValue({ id: "p1", title: "Sin título" });
      getSidebarTree.mockReturnValue(new Promise(() => {}));
      const initialNotebooks: SidebarNotebook[] = [
        { id: "n1", title: "Cuaderno 1", icon: null, color: null, pages: [] },
      ];
      const user = userEvent.setup();
      render(<SidebarTreeClient initialNotebooks={initialNotebooks} />, {
        wrapper: Wrapper,
      });

      await user.click(
        screen.getByRole("button", { name: "Crear página en Cuaderno 1" }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
