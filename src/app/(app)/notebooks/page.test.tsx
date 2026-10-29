import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));

const { getHomeOverview } = vi.hoisted(() => ({ getHomeOverview: vi.fn() }));
vi.mock("@/modules/notebooks", () => ({
  CreateNotebookTrigger: ({
    variant,
    label = "Nuevo cuaderno",
  }: {
    variant: string;
    label?: string;
  }) => (
    <button type="button" data-variant={variant}>
      {label}
    </button>
  ),
  getHomeOverview,
  NotebookCardActions: ({ notebook }: { notebook: { title: string } }) => (
    <button type="button">{`Acciones de ${notebook.title}`}</button>
  ),
}));

vi.mock("../_components/breadcrumb", () => ({ SetBreadcrumb: () => null }));
vi.mock("../_components/notebook-list-row", () => ({
  NotebookListRow: () => null,
}));
vi.mock("@/shared/ui/view-toggle", () => ({ ViewToggle: () => null }));

import NotebooksPage from "./page";

async function renderRoute() {
  const ui = await NotebooksPage({ searchParams: Promise.resolve({}) });
  return render(ui as React.ReactElement);
}

// Phase 8 H4-T1 (user-approved mockup 2026-10-20): the notebooks hub's
// empty state is an illustrated invitation with three steps and a CTA that
// opens the same create-notebook dialog as the header.
describe("notebooks hub route", () => {
  beforeEach(() => {
    redirect.mockReset();
    getCurrentUser.mockResolvedValue({ id: "u1" });
    getHomeOverview.mockResolvedValue({ notebooks: [] });
  });

  it("drops the 'Biblioteca' eyebrow and states there are no notebooks yet", async () => {
    await renderRoute();

    expect(
      screen.getByRole("heading", { level: 1, name: "Cuadernos" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Biblioteca")).toBeNull();
    expect(screen.getByText("Tus materias, organizadas")).toBeInTheDocument();
    expect(screen.getByText("Aún no tienes cuadernos")).toBeInTheDocument();
  });

  // Phase 8 H4-T4 (user decision 2026-10-20): no header create button in
  // any state; the empty state's CTA and the grid's tile create notebooks.
  it("renders no header create button when empty: only the empty state's CTA", async () => {
    await renderRoute();

    expect(screen.queryByRole("button", { name: "Nuevo cuaderno" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Crear mi primer cuaderno" }),
    ).toHaveAttribute("data-variant", "cta");
  });

  it("gives the title personality: a gradient h1 beside a violet notebook badge", async () => {
    await renderRoute();

    const title = screen.getByRole("heading", { level: 1, name: "Cuadernos" });
    expect(title).toHaveClass("text-gradient-brand", "text-[32px]");
    const header = title.closest("div")?.parentElement as HTMLElement;
    const badge = header.querySelector(
      '[data-slot="notebook-cover"]',
    ) as HTMLElement;
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(badge).toHaveClass("h-[70px]", "w-[58px]");
    // No "+" tile or icon on the badge (user correction 2026-10-20).
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.textContent).toBe("");
    expect(
      badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The dot separates the tagline from the count.
    expect(header.querySelectorAll('[data-part="separator"]')).toHaveLength(1);
  });

  it.each([
    [2, "2 cuadernos"],
    [5, "5 cuadernos"],
  ])("counts %i notebooks as '%s' and keeps only the grid's create tile", async (count, copy) => {
    getHomeOverview.mockResolvedValue({
      notebooks: Array.from({ length: count }, (_, index) => ({
        id: `nb${index}`,
        title: `Cuaderno ${index}`,
        color: null,
        icon: null,
        pageCount: 0,
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      })),
    });
    await renderRoute();

    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.getByText("Tus materias, organizadas")).toBeInTheDocument();
    const creates = screen.getAllByRole("button", { name: "Nuevo cuaderno" });
    expect(creates).toHaveLength(1);
    expect(creates[0]).toHaveAttribute("data-variant", "tile");
  });

  it("shows the illustrated empty state with its steps and the create CTA", async () => {
    const { container } = await renderRoute();

    const empty = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    // Phase 8 H4-T3 (user decision 2026-10-20): a CSS notebook fan, no
    // illustration image.
    expect(empty.querySelector("img")).toBeNull();
    expect(
      empty.querySelector('[data-part="art"] [data-slot="notebook-fan"]'),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      within(empty).getByRole("heading", {
        name: "Todas tus materias, en un solo lugar",
      }),
    ).toBeInTheDocument();
    expect(
      within(empty).getByText(
        "Crea un cuaderno para cada materia o tema que estudies. Ahí se juntan tus apuntes, los que escribes y los que importas desde PDF, para que todo quede ordenado y a mano cuando lo necesites.",
      ),
    ).toBeInTheDocument();
    expect(
      within(empty)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "1Crea un cuaderno por materia",
      "2Escribe o importa tus apuntes",
      "3Repasa con las técnicas",
    ]);
    expect(
      within(empty).getByRole("button", { name: "Crear mi primer cuaderno" }),
    ).toHaveAttribute("data-variant", "cta");
  });

  // Phase 8 H4-T2 (user decision 2026-10-20): the invitation keeps the
  // calendar's glow, on the dotted paper, and cascades.
  it("uses the cascade entrance and the dotted paper", async () => {
    const { container } = await renderRoute();

    const empty = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(empty).toHaveAttribute("data-entrance", "cascade");
    expect(empty).toHaveAttribute("data-surface", "paper");
  });

  it("keeps the count description and no empty state when notebooks exist", async () => {
    getHomeOverview.mockResolvedValue({
      notebooks: [
        {
          id: "nb1",
          title: "Biología",
          color: null,
          icon: null,
          pageCount: 0,
          updatedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    });
    const { container } = await renderRoute();

    expect(screen.getByText("1 cuaderno")).toBeInTheDocument();
    expect(screen.queryByText("Biblioteca")).toBeNull();
    expect(
      container.querySelector('[data-slot="illustrated-empty-state"]'),
    ).toBeNull();
  });

  // Phase 8 H4-T5 (user request 2026-10-28): the grid shows each notebook
  // as the empty state's closed notebook, not a flat card.
  it("presents each notebook in the grid as a notebook cover", async () => {
    getHomeOverview.mockResolvedValue({
      notebooks: [
        {
          id: "nb1",
          title: "Biología",
          color: "green",
          icon: "🧬",
          pageCount: 1,
          updatedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
        {
          id: "nb2",
          title: "Cálculo",
          color: null,
          icon: null,
          pageCount: 4,
          updatedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    });
    const { container } = await renderRoute();

    const cards = container.querySelectorAll(
      '[data-slot="notebook-cover-card"]',
    );
    expect(cards).toHaveLength(2);
    const [biology, calculus] = Array.from(cards) as HTMLElement[];
    expect(biology).toHaveAttribute("data-tone", "green");
    expect(calculus).toHaveAttribute("data-tone", "purple");
    expect(
      within(biology).getByRole("link", { name: "Biología" }),
    ).toHaveAttribute("href", "/notebooks/nb1");
    expect(within(biology).getByText("1 página")).toBeInTheDocument();
    // User correction 2026-10-28: no notebook icon on the cover.
    expect(within(biology).queryByText("🧬")).toBeNull();
    expect(within(calculus).getByText("4 páginas")).toBeInTheDocument();
    expect(
      within(calculus).getByRole("button", { name: "Acciones de Cálculo" }),
    ).toBeInTheDocument();
  });
});
