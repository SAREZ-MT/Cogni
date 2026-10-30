import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Phase 8 H19: the card's delete provider is client code with its own test.
vi.mock("../_components/delete-technique-set", () => ({
  DeleteTechniqueSetProvider: ({ children }: { children: unknown }) => children,
  DeleteTechniqueSetMenuItem: () => null,
}));
vi.mock("server-only", () => ({}));

const { listRecallHubAction } = vi.hoisted(() => ({
  listRecallHubAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({ listRecallHubAction }));
const {
  getGenerationStatusAction,
  CreateFromPageDialog,
  loadCreateExamNotebooks,
} = vi.hoisted(() => ({
  getGenerationStatusAction: vi.fn(),
  CreateFromPageDialog: vi.fn(),
  loadCreateExamNotebooks: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({ getGenerationStatusAction }));
vi.mock("../flashcards/_components/create-from-page-dialog", () => ({
  CreateFromPageDialog,
}));
vi.mock("../exams/_lib/create-exam-notebooks", () => ({
  loadCreateExamNotebooks,
}));

import ActiveRecallHubPage from "./page";

function session(
  id: string,
  finishedAt: string,
  percentage: number | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    finishedAt,
    questionCount: 10,
    correct: 8,
    partial: 1,
    incorrect: 1,
    percentage,
    ...overrides,
  };
}

function entry(
  pageId: string,
  notebookId: string,
  notebookTitle: string,
  sessions: ReturnType<typeof session>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId,
    notebookTitle,
    notebookColor: "green",
    sessions,
    mastery: 50,
    dueToday: 0,
    questionCount: 8,
    latestQuestionAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

const NB_A = "11111111-1111-4111-8111-111111111111";
const NB_B = "22222222-2222-4222-8222-222222222222";

function hub(cuaderno?: string) {
  return {
    searchParams: Promise.resolve(cuaderno === undefined ? {} : { cuaderno }),
  };
}

// Cuaderno A: a practised page (2 sessions, 86 % mastery), one never
// practised, one with questions due; Cuaderno B: one practised page.
const PAGES = [
  entry(
    "practicada",
    NB_A,
    "Cuaderno A",
    [
      session("s-2", "2026-09-22T12:00:00.000Z", 80),
      session("s-1", "2026-09-20T12:00:00.000Z", 70),
    ],
    { mastery: 86 },
  ),
  entry("nueva", NB_A, "Cuaderno A", [], {
    questionCount: 10,
    mastery: 0,
    latestQuestionAt: "2026-09-01T12:00:00.000Z",
  }),
  entry(
    "pendiente",
    NB_A,
    "Cuaderno A",
    [session("s-3", "2026-09-01T12:00:00.000Z", 50)],
    { dueToday: 2, mastery: 64 },
  ),
  entry(
    "otra",
    NB_B,
    "Cuaderno B",
    [session("s-4", "2026-09-25T12:00:00.000Z", 33)],
    { mastery: 40, questionCount: 1 },
  ),
];

const titles = () =>
  screen
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

const cardOf = (title: string) =>
  screen
    .getByRole("heading", { level: 3, name: title })
    .closest("article") as HTMLElement;

describe("ActiveRecallHubPage (flat since Phase 8 H17)", () => {
  beforeEach(() => {
    listRecallHubAction.mockReset();
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: PAGES, averageMastery: 47 },
    });
    getGenerationStatusAction.mockReset();
    getGenerationStatusAction.mockResolvedValue({
      ok: true,
      value: { remainingToday: 3, resetAt: "2026-10-30T00:00:00.000Z" },
    });
    loadCreateExamNotebooks.mockReset();
    loadCreateExamNotebooks.mockResolvedValue([]);
    CreateFromPageDialog.mockReset();
    CreateFromPageDialog.mockImplementation(((props: { trigger: string }) =>
      createElement("div", {
        "data-testid": `create-recall-${props.trigger}`,
      })) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ActiveRecallHubPage(hub()));

    expect(
      screen.getByRole("heading", { name: "Recordación activa" }),
    ).toBeInTheDocument();
  });

  it("lists every recall page as its own card after the create tile, with the counts in the header", async () => {
    render(await ActiveRecallHubPage(hub()));

    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(
      screen.getByText("4 sesiones · 4 páginas · 2 cuadernos"),
    ).toBeInTheDocument();
    const grid = screen.getByTestId("create-recall-tile").parentElement;
    expect(grid?.firstElementChild).toBe(
      screen.getByTestId("create-recall-tile"),
    );
    // No average-mastery pills, no quick start, no notebook cards.
    expect(screen.queryByText(/dominio promedio/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Nueva sesión/ })).toBeNull();
  });

  it("orders pending pages first, then never practised, then the most recent", async () => {
    render(await ActiveRecallHubPage(hub()));

    expect(titles()).toEqual([
      "Página pendiente",
      "Página nueva",
      "Página otra",
      "Página practicada",
    ]);
  });

  it("fills Practicar and shows the questions due on a pending page", async () => {
    render(await ActiveRecallHubPage(hub()));

    const card = cardOf("Página pendiente");
    expect(within(card).getByText("2 para repasar")).toBeInTheDocument();
    expect(within(card).getByText(/1 sesión · dominio/)).toHaveTextContent(
      "1 sesión · dominio 64 %",
    );
    expect(within(card).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "64",
    );
    const practise = within(card).getByRole("link", {
      name: "Practicar: Página pendiente",
    });
    expect(practise).toHaveAttribute("data-emphasis", "primary");
    expect(practise).toHaveAttribute(
      "href",
      `/active-recall/${NB_A}/pendiente?desde=hub`,
    );
  });

  it("shows the sessions and mastery of a practised page, softly", async () => {
    render(await ActiveRecallHubPage(hub()));

    const card = cardOf("Página practicada");
    expect(within(card).getByTestId("technique-item-metric")).toHaveTextContent(
      "8 preguntas",
    );
    expect(within(card).getByText(/2 sesiones · dominio/)).toHaveTextContent(
      "2 sesiones · dominio 86 %",
    );
    expect(
      within(card).getByRole("link", { name: "Practicar: Página practicada" }),
    ).toHaveAttribute("data-emphasis", "soft");
    expect(
      within(cardOf("Página otra")).getByTestId("technique-item-metric"),
    ).toHaveTextContent("1 pregunta");
  });

  it("says a page with questions has no finished session yet, without a bar", async () => {
    render(await ActiveRecallHubPage(hub()));

    const card = cardOf("Página nueva");
    expect(
      within(card).getByText("Sin sesiones terminadas"),
    ).toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).toBeNull();
  });

  it("filters by notebook on the server and keeps the filter in the practice links", async () => {
    render(await ActiveRecallHubPage(hub(NB_B)));

    expect(titles()).toEqual(["Página otra"]);
    expect(
      screen.getByRole("link", { name: "Practicar: Página otra" }),
    ).toHaveAttribute(
      "href",
      `/active-recall/${NB_B}/otra?desde=hub&cuaderno=${NB_B}`,
    );
    const filter = screen.getByRole("navigation", {
      name: "Filtrar por cuaderno",
    });
    expect(
      within(filter).getByRole("link", { current: "page" }),
    ).toHaveTextContent("Cuaderno B");
  });

  it("says so inline, with the create tile, when the chosen notebook has no recall pages", async () => {
    render(
      await ActiveRecallHubPage(hub("33333333-3333-4333-8333-333333333333")),
    );

    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.getByText("Este cuaderno aún no tiene preguntas para practicar."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-recall-tile")).toBeInTheDocument();
  });

  it("shows no due pill and no mastery when those counts are unknown", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [{ ...PAGES[2], dueToday: null, mastery: null }],
        averageMastery: null,
      },
    });

    render(await ActiveRecallHubPage(hub()));

    expect(screen.queryByText(/para repasar/)).toBeNull();
    expect(screen.getByText("1 sesión")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("offers the page and its latest results in the card menu", async () => {
    render(await ActiveRecallHubPage(hub()));

    expect(
      screen.getByRole("button", { name: "Acciones de Página practicada" }),
    ).toBeInTheDocument();
  });

  // Phase 8 H18: the card practises; the menu's "Editar preguntas" opens
  // the page's recall edit page, keeping the hub marker.
  it("leads the menu's Editar preguntas to the page's edit page", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(await ActiveRecallHubPage(hub()));

    await user.click(
      screen.getByRole("button", { name: "Acciones de Página practicada" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /Editar preguntas/ }),
    ).toHaveAttribute(
      "href",
      `/active-recall/${NB_A}/practicada/editar?desde=hub`,
    );
  });

  it("shows the empty state when no page has a session", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: [], averageMastery: null },
    });

    render(await ActiveRecallHubPage(hub()));

    // Phase 8 H10: the illustrated empty state (stacked prompt cards,
    // gradient headline) leads to the notebooks, where questions are made.
    expect(
      screen.getByRole("heading", {
        name: "Practica explicando con tus palabras",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Elige una página de tus cuadernos: la IA crea preguntas abiertas y las respondes aquí.",
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="technique-empty-art"]'),
    ).toHaveAttribute("data-technique", "recall");
    // Phase 8 H11: the technique theme on the header and the empty state.
    expect(
      document.querySelector('[data-slot="technique-hub-header"]'),
    ).toHaveAttribute("data-technique-theme", "recall");
    expect(
      document.querySelector('[data-slot="illustrated-empty-state"]'),
    ).toHaveAttribute("data-technique-theme", "recall");
    // Phase 8 H11: the CTA opens the "pick a page" dialog.
    const empty = document.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(
      empty.querySelector('[data-testid="create-recall-cta"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir a mis cuadernos" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Nueva sesión/ })).toBeNull();
    expect(
      screen.getByText("0 sesiones · 0 páginas · 0 cuadernos"),
    ).toBeInTheDocument();
  });

  it("shows the load error in the empty state when the sessions cannot load", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });

    render(await ActiveRecallHubPage(hub()));

    expect(
      screen.getByRole("heading", {
        name: "Practica explicando con tus palabras",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No pudimos cargar tus sesiones. Intenta de nuevo."),
    ).toBeInTheDocument();
  });
});
