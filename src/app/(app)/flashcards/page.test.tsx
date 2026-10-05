import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDecksAction } = vi.hoisted(() => ({ listDecksAction: vi.fn() }));
vi.mock("@/modules/flashcards", () => ({ listDecksAction }));
const { listDueTodayAction } = vi.hoisted(() => ({
  listDueTodayAction: vi.fn(),
}));
vi.mock("@/modules/scheduling", () => ({ listDueTodayAction }));
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

function due(
  pageId: string,
  notebookId: string,
  notebookTitle: string,
  flashcard: number,
  overrides: { examQuestion?: number; color?: string | null } = {},
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId,
    notebookTitle,
    notebookColor: overrides.color === undefined ? "purple" : overrides.color,
    due: {
      flashcard,
      exam_question: overrides.examQuestion ?? 0,
      recall_question: 0,
    },
    earliestDueAt: new Date("2026-10-04T08:00:00.000Z"),
  };
}

describe("FlashcardsHubPage (real data)", () => {
  beforeEach(() => {
    listDecksAction.mockReset();
    listDueTodayAction.mockReset();
    listDueTodayAction.mockResolvedValue({ ok: true, value: [] });
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

  it("groups the real decks by notebook with the summed card and due counts", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("p1", "n1", "Biología", 8),
        deck("p2", "n1", "Biología", 12),
        deck("p3", "n2", "Cálculo", 10, "blue"),
      ],
    });
    listDueTodayAction.mockResolvedValue({
      ok: true,
      value: [due("p1", "n1", "Biología", 2), due("p2", "n1", "Biología", 3)],
    });

    render(await FlashcardsHubPage());

    expect(screen.getByText("30 tarjetas · 2 cuadernos")).toBeInTheDocument();
    const biologia = screen.getByRole("link", { name: /^Biología/ });
    expect(biologia).toHaveAttribute("href", "/flashcards/n1");
    expect(biologia).toHaveTextContent("20 tarjetas · 5 pendientes");
    const calculo = screen.getByRole("link", { name: /^Cálculo/ });
    expect(calculo).toHaveAttribute("href", "/flashcards/n2");
    expect(calculo).toHaveTextContent("10 tarjetas · al día");
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
  });

  it("lists Repasos de hoy: only pages with flashcards due, in the scheduler's order", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Biología", 8), deck("p3", "n2", "Cálculo", 4)],
    });
    listDueTodayAction.mockResolvedValue({
      ok: true,
      value: [
        due("p3", "n2", "Cálculo", 1, { color: "blue" }),
        // Only exam questions due: not a flashcards review.
        due("p9", "n2", "Cálculo", 0, { examQuestion: 2 }),
        due("p1", "n1", "Biología", 4),
      ],
    });

    render(await FlashcardsHubPage());

    const list = screen.getByTestId("due-today");
    const rows = within(list).getAllByTestId("due-today-row");
    expect(
      rows.map((row) => within(row).getByRole("link").getAttribute("href")),
    ).toEqual(["/flashcards/n2/p3?repasar=1", "/flashcards/n1/p1?repasar=1"]);
    expect(
      within(rows[0] as HTMLElement).getByText("1 pendiente"),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText("4 pendientes"),
    ).toBeInTheDocument();
  });

  it("says you are up to date when no flashcard is due", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Biología", 8)],
    });

    render(await FlashcardsHubPage());

    expect(
      within(screen.getByTestId("due-today")).getByText("Estás al día"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Biología/ })).toHaveTextContent(
      "8 tarjetas · al día",
    );
  });

  it("never claims a deck is up to date when the due list could not load", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Biología", 8)],
    });
    listDueTodayAction.mockResolvedValue({
      ok: false,
      error: { code: "SCHEDULING_UNEXPECTED", message: "x" },
    });

    render(await FlashcardsHubPage());

    expect(
      screen.getByText(
        "No pudimos cargar tus repasos de hoy. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/al día/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Biología/ })).toHaveTextContent(
      "8 tarjetas",
    );
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
    // Nothing can be due without cards: no Repasos de hoy section.
    expect(screen.queryByTestId("due-today")).not.toBeInTheDocument();
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
