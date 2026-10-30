import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/flashcards/nb/pg/editar",
}));
const { listFlashcardsAction } = vi.hoisted(() => ({
  listFlashcardsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  listFlashcardsAction,
  saveDeckEditsAction: vi.fn(),
  MAX_FLASHCARD_SIDE_LENGTH: 1000,
}));
const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));

import DeckEditPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const props = (search: Record<string, string> = {}) => ({
  params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
  searchParams: Promise.resolve(search),
});

describe("DeckEditPage (Phase 8 H18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({ id: PAGE, title: "Tu apunte" });
    getNotebookTitleForRoute.mockResolvedValue("Cuaderno");
    listFlashcardsAction.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "c1",
          pageId: PAGE,
          front: "Pregunta 1",
          back: "Respuesta 1",
          position: 0,
        },
        {
          id: "c2",
          pageId: PAGE,
          front: "Pregunta 2",
          back: "Respuesta 2",
          position: 1,
        },
      ],
    });
  });

  it("lists every card as an editable entry under the flashcards theme", async () => {
    const { container } = render(await DeckEditPage(props()));

    expect(
      screen.getByRole("heading", { name: "Tu apunte" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("item-editor-entry")).toHaveLength(2);
    expect(screen.getAllByLabelText("Frente")[0]).toHaveValue("Pregunta 1");
    expect(
      container.querySelector('[data-technique-theme="flashcards"]'),
    ).not.toBeNull();
  });

  it("leads back to the hub as it was when opened from it", async () => {
    const FILTER = "2b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
    render(await DeckEditPage(props({ desde: "hub", cuaderno: FILTER })));

    expect(screen.getByRole("link", { name: /Flashcards/ })).toHaveAttribute(
      "href",
      `/flashcards?cuaderno=${FILTER}`,
    );
  });

  it("answers 404 for an unknown page or unreadable cards", async () => {
    getPageForRoute.mockResolvedValueOnce(null);
    await expect(DeckEditPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    listFlashcardsAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "X", message: "x" },
    });
    await expect(DeckEditPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a page without cards to its techniques panel", async () => {
    listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });

    render(await DeckEditPage(props()));

    expect(screen.queryByTestId("item-editor-entry")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Generar desde la página" }),
    ).toHaveAttribute("href", `/notebooks/${NOTEBOOK}/pages/${PAGE}`);
  });
});
