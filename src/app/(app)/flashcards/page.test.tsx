import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDecksAction } = vi.hoisted(() => ({ listDecksAction: vi.fn() }));
vi.mock("@/modules/flashcards", () => ({ listDecksAction }));
vi.mock("@/modules/notebooks", () => ({
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
}));

import FlashcardsHubPage from "./page";

function deck(
  pageId: string,
  notebookId: string,
  notebookTitle: string,
  count: number,
  color: string | null = "purple",
) {
  return {
    pageId,
    notebookId,
    pageTitle: `Página ${pageId}`,
    notebookTitle,
    notebookColor: color,
    count,
  };
}

describe("FlashcardsHubPage (real data)", () => {
  beforeEach(() => {
    listDecksAction.mockReset();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");
    listDecksAction.mockResolvedValue({ ok: true, value: [] });

    render(await FlashcardsHubPage());

    expect(
      screen.getByRole("heading", { name: "Flashcards" }),
    ).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("groups the real decks by notebook with the summed card counts and no due data", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("p1", "n1", "Biología", 8),
        deck("p2", "n1", "Biología", 12),
        deck("p3", "n2", "Cálculo", 10, "blue"),
      ],
    });

    render(await FlashcardsHubPage());

    expect(screen.getByText("30 tarjetas · 2 cuadernos")).toBeInTheDocument();
    const biologia = screen.getByRole("link", { name: /Biología/ });
    expect(biologia).toHaveAttribute("href", "/flashcards/n1");
    expect(within(biologia).getByText(/20 tarjetas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cálculo/ })).toHaveAttribute(
      "href",
      "/flashcards/n2",
    );
    expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/al día/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Estudiar ahora/ }),
    ).not.toBeInTheDocument();
  });

  it("uses singular forms for one card in one notebook", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Biología", 1)],
    });

    render(await FlashcardsHubPage());

    expect(screen.getByText("1 tarjeta · 1 cuaderno")).toBeInTheDocument();
  });

  it("falls back to a default tone for a notebook without a known color", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Sin color", 2, null)],
    });

    render(await FlashcardsHubPage());

    expect(screen.getByRole("link", { name: /Sin color/ })).toBeInTheDocument();
  });

  it("shows the empty state when there are no decks", async () => {
    listDecksAction.mockResolvedValue({ ok: true, value: [] });

    render(await FlashcardsHubPage());

    expect(screen.getByText("Sin mazos todavía")).toBeInTheDocument();
  });

  it("tells the student when the decks could not be loaded", async () => {
    listDecksAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARDS_UNEXPECTED", message: "x" },
    });

    render(await FlashcardsHubPage());

    expect(
      screen.getByText("No pudimos cargar tus mazos. Intenta de nuevo."),
    ).toBeInTheDocument();
  });
});
