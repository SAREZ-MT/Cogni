import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDecksAction, getGenerationStatusAction } = vi.hoisted(() => ({
  listDecksAction: vi.fn(),
  getGenerationStatusAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  listDecksAction,
  getGenerationStatusAction,
}));
const { CreateFromPageDialog, loadCreateExamNotebooks } = vi.hoisted(() => ({
  CreateFromPageDialog: vi.fn(),
  loadCreateExamNotebooks: vi.fn(),
}));
vi.mock("./_components/create-from-page-dialog", () => ({
  CreateFromPageDialog,
}));
vi.mock("../exams/_lib/create-exam-notebooks", () => ({
  loadCreateExamNotebooks,
}));
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
    getGenerationStatusAction.mockReset();
    getGenerationStatusAction.mockResolvedValue({
      ok: true,
      value: { remainingToday: 3, resetAt: "2026-10-30T00:00:00.000Z" },
    });
    loadCreateExamNotebooks.mockReset();
    loadCreateExamNotebooks.mockResolvedValue([
      { id: "n1", title: "Biología", pages: [] },
    ]);
    CreateFromPageDialog.mockReset();
    CreateFromPageDialog.mockImplementation(((props: { trigger: string }) =>
      createElement("div", {
        "data-testid": `create-flashcards-${props.trigger}`,
      })) as never);
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

  // Phase 8 H11: with decks listed, the dialog also opens from a tile
  // fixed first in the grid; an unreadable limit passes as unknown.
  it("puts the create tile first in the decks grid", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", "n1", "Biología", 2)],
    });
    getGenerationStatusAction.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "x" },
    });

    render(await FlashcardsHubPage());

    const tile = screen.getByTestId("create-flashcards-tile");
    expect(tile.parentElement?.firstElementChild).toBe(tile);
    expect(CreateFromPageDialog).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "tile", remaining: null }),
      undefined,
    );
    expect(screen.queryByTestId("create-flashcards-cta")).toBeNull();
  });

  it("shows the empty state when there are no decks", async () => {
    listDecksAction.mockResolvedValue({ ok: true, value: [] });

    render(await FlashcardsHubPage());

    // Phase 8 H10: the illustrated empty state (fanned flashcards, gradient
    // headline) leads to the notebooks, where cards are generated.
    expect(
      screen.getByRole("heading", {
        name: "Tus primeras flashcards te esperan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Elige una página de tus cuadernos y la IA crea tarjetas para repasarlas aquí.",
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="technique-empty-art"]'),
    ).toHaveAttribute("data-technique", "flashcards");
    // Phase 8 H11: the technique theme on the header and the empty state.
    expect(
      document.querySelector('[data-slot="technique-hub-header"]'),
    ).toHaveAttribute("data-technique-theme", "flashcards");
    expect(
      document.querySelector('[data-slot="illustrated-empty-state"]'),
    ).toHaveAttribute("data-technique-theme", "flashcards");
    // Phase 8 H11: the CTA opens the "pick a page" dialog with the
    // notebooks and the generations left today.
    const empty = document.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(
      empty.querySelector('[data-testid="create-flashcards-cta"]'),
    ).toBeInTheDocument();
    expect(CreateFromPageDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        technique: "flashcards",
        trigger: "cta",
        remaining: 3,
        notebooks: [{ id: "n1", title: "Biología", pages: [] }],
      }),
      undefined,
    );
    expect(
      screen.queryByRole("link", { name: "Ir a mis cuadernos" }),
    ).toBeNull();
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
    expect(
      screen.getByRole("heading", {
        name: "Tus primeras flashcards te esperan",
      }),
    ).toBeInTheDocument();
  });
});
