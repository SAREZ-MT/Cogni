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
vi.mock("@/modules/identity", () => ({
  getCurrentTimeZoneSetting: async () => ({
    status: "ok",
    timeZone: "America/Bogota",
    chosen: true,
  }),
}));
vi.mock("./_components/delete-deck", () => ({
  DeleteDeckProvider: ({ children }: { children: unknown }) => children,
  DeleteDeckMenuItem: () => null,
}));
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

const NB_A = "11111111-1111-4111-8111-111111111111";
const NB_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-29T15:00:00.000Z");

function hub(cuaderno?: string) {
  return {
    searchParams: Promise.resolve(cuaderno === undefined ? {} : { cuaderno }),
  };
}

function deck(
  pageId: string,
  notebookId: string,
  notebookTitle: string,
  count: number,
  overrides: {
    color?: string | null;
    latestCardAt?: string;
    nextDueAt?: string | null;
  } = {},
) {
  return {
    pageId,
    notebookId,
    pageTitle: `Página ${pageId}`,
    notebookTitle,
    notebookColor: overrides.color === undefined ? "yellow" : overrides.color,
    count,
    latestCardAt: overrides.latestCardAt ?? "2026-10-20T10:00:00.000Z",
    nextDueAt: overrides.nextDueAt ?? null,
  };
}

function due(pageId: string, notebookId: string, flashcard: number) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId,
    notebookTitle: "x",
    notebookColor: "yellow",
    due: { flashcard, exam_question: 0, recall_question: 0 },
    earliestDueAt: new Date("2026-10-29T08:00:00.000Z"),
  };
}

const cards = () => screen.queryAllByRole("article");
const titles = (root: HTMLElement = document.body) =>
  within(root)
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

describe("FlashcardsHubPage (real data, flat since Phase 8 H17)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
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

    render(await FlashcardsHubPage(hub()));

    expect(
      screen.getByRole("heading", { name: "Flashcards" }),
    ).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("lists every deck as its own card, with the counts in the header", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("p1", NB_A, "Cuaderno A", 12),
        deck("p2", NB_B, "Cuaderno B", 5),
        deck("p3", NB_B, "Cuaderno B", 1),
      ],
    });

    render(await FlashcardsHubPage(hub()));

    expect(cards()).toHaveLength(3);
    expect(
      screen.getByText("18 tarjetas · 3 mazos · 2 cuadernos"),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("technique-item-metric")
        .map((metric) => metric.textContent),
    ).toEqual(["12 tarjetas", "5 tarjetas", "1 tarjeta"]);
    // No notebook level any more: no link to /flashcards/{notebookId}.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^\/flashcards\/[^/?]+$/);
    }
  });

  it("puts the decks due today first under PARA HOY with a filled Repasar that opens the review from the hub", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("old", NB_A, "Cuaderno A", 4, {
          latestCardAt: "2026-10-01T10:00:00.000Z",
          nextDueAt: "2026-10-30T15:00:00.000Z",
        }),
        deck("due-old", NB_A, "Cuaderno A", 8, {
          latestCardAt: "2026-10-02T10:00:00.000Z",
        }),
        deck("due-new", NB_B, "Cuaderno B", 6, {
          latestCardAt: "2026-10-25T10:00:00.000Z",
        }),
        deck("new", NB_B, "Cuaderno B", 9, {
          latestCardAt: "2026-10-26T10:00:00.000Z",
          nextDueAt: "2026-11-01T15:00:00.000Z",
        }),
      ],
    });
    listDueTodayAction.mockResolvedValue({
      ok: true,
      value: [due("due-old", NB_A, 3), due("due-new", NB_B, 5)],
    });

    render(await FlashcardsHubPage(hub()));

    const dueGroup = screen.getByRole("region", { name: "Para hoy 2" });
    const upToDate = screen.getByRole("region", { name: "Al día 2" });
    expect(titles(dueGroup)).toEqual(["Página due-new", "Página due-old"]);
    expect(titles(upToDate)).toEqual(["Página new", "Página old"]);
    // The create tile leads the first group.
    expect(
      within(dueGroup).getByTestId("create-flashcards-tile"),
    ).toBeInTheDocument();
    expect(within(upToDate).queryByTestId("create-flashcards-tile")).toBeNull();

    const review = within(dueGroup).getByRole("link", {
      name: "Repasar: Página due-new",
    });
    expect(review).toHaveAttribute(
      "href",
      `/flashcards/${NB_B}/due-new?repasar=1&desde=hub`,
    );
    expect(review).toHaveAttribute("data-emphasis", "primary");
    expect(within(dueGroup).getByText("5 para hoy")).toBeInTheDocument();

    expect(
      within(upToDate).getByRole("link", { name: "Repasar: Página new" }),
    ).toHaveAttribute("data-emphasis", "soft");
    expect(within(upToDate).getByText("repaso en 3 días")).toBeInTheDocument();
    expect(within(upToDate).getByText("repaso mañana")).toBeInTheDocument();
    expect(
      within(upToDate).getAllByText("Al día", { selector: "span" }),
    ).toHaveLength(2);
    // The old "Repasos de hoy" list is gone.
    expect(screen.queryByTestId("due-today")).toBeNull();
  });

  it("puts the create tile in the up-to-date group when nothing is due", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", NB_A, "Cuaderno A", 4)],
    });

    render(await FlashcardsHubPage(hub()));

    expect(screen.queryByRole("region", { name: /Para hoy/ })).toBeNull();
    const upToDate = screen.getByRole("region", { name: "Al día 1" });
    expect(
      within(upToDate).getByTestId("create-flashcards-tile"),
    ).toBeInTheDocument();
  });

  it("never claims a deck is up to date when the due list could not load", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", NB_A, "Cuaderno A", 4)],
    });
    listDueTodayAction.mockResolvedValue({
      ok: false,
      error: { code: "SCHEDULING_UNEXPECTED", message: "x" },
    });

    render(await FlashcardsHubPage(hub()));

    expect(cards()).toHaveLength(1);
    expect(screen.queryByText("Al día")).toBeNull();
    expect(screen.queryByRole("region", { name: /Al día/ })).toBeNull();
    expect(screen.getByTestId("create-flashcards-tile")).toBeInTheDocument();
  });

  it("filters by notebook on the server from ?cuaderno=, keeping the filter in the links", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("p1", NB_A, "Cuaderno A", 4),
        deck("p2", NB_B, "Cuaderno B", 5),
        deck("p3", NB_B, "Cuaderno B", 6),
      ],
    });

    render(await FlashcardsHubPage(hub(NB_B)));

    const filter = screen.getByRole("navigation", {
      name: "Filtrar por cuaderno",
    });
    expect(
      within(filter)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Todos3", "Cuaderno A1", "Cuaderno B2"]);
    expect(
      within(filter).getByRole("link", { current: "page" }),
    ).toHaveTextContent("Cuaderno B");
    expect(cards()).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Repasar: Página p2" }),
    ).toHaveAttribute(
      "href",
      `/flashcards/${NB_B}/p2?repasar=1&desde=hub&cuaderno=${NB_B}`,
    );
    // The header keeps the totals.
    expect(
      screen.getByText("15 tarjetas · 3 mazos · 2 cuadernos"),
    ).toBeInTheDocument();
  });

  it("says so inline, with the create tile, when the chosen notebook has no decks", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", NB_A, "Cuaderno A", 4)],
    });

    render(await FlashcardsHubPage(hub(NB_B)));

    expect(cards()).toHaveLength(0);
    expect(
      screen.getByText("Este cuaderno aún no tiene mazos."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-flashcards-tile")).toBeInTheDocument();
  });

  it("offers the deck's actions in its menu", async () => {
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [deck("p1", NB_A, "Cuaderno A", 4)],
    });

    render(await FlashcardsHubPage(hub()));

    expect(
      screen.getByRole("button", { name: "Acciones de Página p1" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no decks", async () => {
    listDecksAction.mockResolvedValue({ ok: true, value: [] });

    render(await FlashcardsHubPage(hub()));

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

    render(await FlashcardsHubPage(hub()));

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
