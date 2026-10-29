import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { getNotebookForRoute } = vi.hoisted(() => ({
  getNotebookForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  ArchivePageButton: ({ pageId, title }: { pageId: string; title: string }) => (
    <button type="button" data-testid={`archive-${pageId}`}>
      Archivar {title}
    </button>
  ),
  createPageAction: vi.fn(),
  getNotebookForRoute,
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

  it("keeps the 'Nueva página' action", async () => {
    await renderRoute();

    expect(
      screen.getByRole("button", { name: "Nueva página" }),
    ).toBeInTheDocument();
  });

  it("renders pages as a card grid by default, each linking to its page with an archive action", async () => {
    await renderRoute();

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[0]).getByRole("link", { name: /Mitosis/ }),
    ).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
    expect(within(items[1]).getByTestId("archive-p2")).toBeInTheDocument();
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

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
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
    expect(screen.getByTestId("archive-p1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("falls back to the grid for an unknown view value", async () => {
    await renderRoute("kanban");

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
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

    expect(screen.getByText("Crea tu primera página")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver como lista" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva página" }),
    ).toBeInTheDocument();
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
