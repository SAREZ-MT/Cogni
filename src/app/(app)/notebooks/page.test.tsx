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
    variant = "pill",
    label = "Nuevo cuaderno",
  }: {
    variant?: string;
    label?: string;
  }) => (
    <button type="button" data-variant={variant}>
      {label}
    </button>
  ),
  getHomeOverview,
}));

vi.mock("../_components/breadcrumb", () => ({ SetBreadcrumb: () => null }));
vi.mock("../_components/notebook-card", () => ({
  NotebookCard: ({ notebook }: { notebook: { title: string } }) => (
    <article>{notebook.title}</article>
  ),
}));
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
    expect(screen.getByText("Aún no tienes cuadernos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toHaveAttribute("data-variant", "pill");
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
});
