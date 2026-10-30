import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound, redirect }));

const { getNotebookForRoute } = vi.hoisted(() => ({
  getNotebookForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  DeletePageButton: ({ pageId, title }: { pageId: string; title: string }) => (
    <button type="button" data-testid={`delete-${pageId}`}>
      Eliminar {title}
    </button>
  ),
  createPageAction,
  getNotebookForRoute,
}));

const { createPageAction } = vi.hoisted(() => ({
  createPageAction: vi.fn(),
}));

// The dialog is a client component tested on its own; here it renders only
// its trigger and hands the route's blank-page action to the test.
const dialogProps = vi.hoisted(() => ({
  current: null as null | {
    notebookId: string;
    createBlankPage: () => Promise<void>;
  },
}));
vi.mock("./_components/new-page-dialog", () => ({
  NewPageDialog: (props: {
    notebookId: string;
    createBlankPage: () => Promise<void>;
    trigger: React.ReactNode;
  }) => {
    dialogProps.current = props;
    return props.trigger;
  },
}));

import NotebookPage from "./page";

const notebook = { id: "nb1", title: "Biología", color: "green", icon: null };
const pages = [
  {
    id: "p1",
    title: "Mitosis",
    updatedAt: new Date("2026-09-03T10:00:00.000Z"),
  },
  {
    id: "p2",
    title: "Meiosis",
    updatedAt: new Date("2026-09-04T10:00:00.000Z"),
  },
];

async function renderRoute(view?: string) {
  const ui = await NotebookPage({
    params: Promise.resolve({ notebookId: "nb1" }),
    searchParams: Promise.resolve({ view }),
  });
  return render(ui);
}

describe("notebook detail route", () => {
  beforeEach(() => {
    notFound.mockClear();
    redirect.mockClear();
    createPageAction.mockReset();
    dialogProps.current = null;
    getNotebookForRoute.mockReset();
    getNotebookForRoute.mockResolvedValue({ notebook, pages });
  });

  it("renders not-found for a foreign or archived notebook", async () => {
    getNotebookForRoute.mockResolvedValue(null);

    await expect(renderRoute()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("offers a back link to the notebooks library", async () => {
    await renderRoute();

    expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
      "href",
      "/notebooks",
    );
  });

  // Phase 8 H5-T2 (user 2026-10-29): one create control, first in the grid
  // or the list, like the hub; the header has none.
  it("has no create button in the header", async () => {
    const { container } = await renderRoute();

    const header = container
      .querySelector("h1")
      ?.closest(".justify-between") as HTMLElement;
    expect(within(header).queryByRole("button")).toBeNull();
  });

  it.each([
    ["grid", undefined],
    ["list", "list"],
  ] as const)("puts a single 'Nueva página' create control first in the %s view", async (_name, view) => {
    await renderRoute(view);

    const creates = screen.getAllByRole("button", { name: "Nueva página" });
    expect(creates).toHaveLength(1);
    // H5-T3: it opens the "how to create" dialog instead of submitting.
    expect(creates[0]).toHaveAttribute("type", "button");
    expect(creates[0].closest("form")).toBeNull();
    const firstPageLink = screen.getByRole("link", { name: /Mitosis/ });
    expect(
      creates[0].compareDocumentPosition(firstPageLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // Phase 8 H5-T3 (user 2026-10-29): a blank page opens in its editor
  // right after it is created.
  it("creates a blank page and redirects to its editor", async () => {
    createPageAction.mockResolvedValue({ id: "new1" });
    await renderRoute();

    expect(dialogProps.current?.notebookId).toBe("nb1");
    await dialogProps.current?.createBlankPage();
    expect(createPageAction).toHaveBeenCalledWith({ notebookId: "nb1" });
    expect(redirect).toHaveBeenCalledWith("/notebooks/nb1/pages/new1");
  });

  it("makes the grid's first item the sheet-shaped create tile", async () => {
    await renderRoute();

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
      within(items[0]).getByRole("button", { name: "Nueva página" }),
    ).toHaveAttribute("data-slot", "page-sheet-create-tile");
  });

  it("renders pages as a card grid by default, each linking to its page with a delete action", async () => {
    await renderRoute();

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem").slice(1);
    expect(items).toHaveLength(2);
    expect(
      within(items[0]).getByRole("link", { name: /Mitosis/ }),
    ).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
    expect(within(items[1]).getByTestId("delete-p2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver como cuadrícula" }),
    ).toHaveAttribute("aria-current", "true");
  });

  // Phase 8 H5-T1 (user request 2026-10-29): the hub header's line — a
  // badge and a gradient title — with a page-sheet badge in the notebook's
  // colour, and each page as a paper sheet.
  it("heads the page with a page-sheet badge in the notebook's colour and a gradient title", async () => {
    const { container } = await renderRoute();

    const heading = screen.getByRole("heading", { level: 1, name: "Biología" });
    expect(heading).toHaveClass("text-gradient-brand", "text-[32px]");
    const badge = container.querySelector('[data-slot="page-sheet"]');
    expect(badge).toHaveAttribute("data-tone", "green");
    expect(badge).toHaveClass("h-[70px]", "w-[58px]");
    // No uppercase eyebrow anymore: "Cuaderno" joins the meta line.
    expect(screen.getByText("Cuaderno")).not.toHaveClass("uppercase");
    expect(screen.getByText("2 páginas")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-part="separator"]')).toHaveLength(
      1,
    );
  });

  it("presents each page as a paper sheet with its update date", async () => {
    await renderRoute();

    const items = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .slice(1);
    for (const item of items) {
      expect(within(item).getByRole("article")).toHaveAttribute(
        "data-slot",
        "page-sheet-card",
      );
    }
    expect(within(items[0]).getByRole("article")).toHaveAttribute(
      "data-tone",
      "green",
    );
    expect(within(items[0]).getByRole("article")).toHaveTextContent(
      /Actualizada \d+ sept/,
    );
  });

  it("lays the sheets on the hub's container-query grid, capped at five columns", async () => {
    await renderRoute();

    expect(screen.getByRole("list")).toHaveClass(
      "grid-cols-1",
      "@[300px]/grid:grid-cols-2",
      "@[960px]/grid:grid-cols-5",
    );
  });

  it("renders pages as list rows when ?view=list", async () => {
    await renderRoute("list");

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mitosis" })).toHaveAttribute(
      "href",
      "/notebooks/nb1/pages/p1",
    );
    expect(screen.getByRole("link", { name: "Meiosis" })).toHaveAttribute(
      "href",
      "/notebooks/nb1/pages/p2",
    );
    expect(screen.getByTestId("delete-p1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("falls back to the grid for an unknown view value", async () => {
    await renderRoute("kanban");

    // The create tile plus the two pages.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("builds the toggle links from the notebook id", async () => {
    await renderRoute();

    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).toHaveAttribute("href", "/notebooks/nb1?view=list");
  });

  it("shows the empty state, without view toggle, when the notebook has no pages", async () => {
    getNotebookForRoute.mockResolvedValue({ notebook, pages: [] });
    await renderRoute();

    expect(
      screen.queryByRole("link", { name: "Ver como lista" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva página" }),
    ).toBeInTheDocument();
  });

  // Phase 8 H5-T4 (user request 2026-10-29): the hub's empty-state line —
  // a fan of page sheets in the notebook's colour on the dotted paper, a
  // cascade entrance, a gradient headline and one violet CTA that opens
  // the "Nueva página" dialog.
  it("invites the first page with a fan of sheets in the notebook's colour", async () => {
    getNotebookForRoute.mockResolvedValue({ notebook, pages: [] });
    const { container } = await renderRoute();

    const empty = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(empty).toHaveAttribute("data-entrance", "cascade");
    expect(empty).toHaveAttribute("data-surface", "paper");
    const fan = empty.querySelector('[data-slot="page-sheet-fan"]');
    expect(fan?.querySelector('[data-slot="page-sheet"]')).toHaveAttribute(
      "data-tone",
      "green",
    );
    expect(
      within(empty).getByText("Tu cuaderno está listo para su primera página"),
    ).toBeInTheDocument();
    const cta = within(empty).getByRole("button", { name: "Nueva página" });
    expect(cta).toHaveClass("bg-primary-600", "rounded-pill");
    expect(dialogProps.current?.notebookId).toBe("nb1");
  });

  it("says the notebook has no pages yet in the header, without the old sentence", async () => {
    getNotebookForRoute.mockResolvedValue({ notebook, pages: [] });
    await renderRoute();

    expect(screen.getByText("Sin páginas todavía")).toBeInTheDocument();
    expect(
      screen.queryByText("Aún no hay páginas. Crea la primera para empezar."),
    ).toBeNull();
  });

  it.each([
    [1, "1 página"],
    [2, "2 páginas"],
  ])("describes %i page(s) as '%s'", async (count, text) => {
    getNotebookForRoute.mockResolvedValue({
      notebook,
      pages: pages.slice(0, count),
    });
    await renderRoute();

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
