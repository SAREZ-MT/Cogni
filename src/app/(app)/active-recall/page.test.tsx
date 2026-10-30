import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    ...overrides,
  };
}

// Biología: two pages, three sessions (latest of the notebook: 22 sept,
// 80 %); Cálculo: one page, one session.
const PAGES = [
  entry("membrana", "biologia", "Biología Celular", [
    session("s-3", "2026-09-18T12:00:00.000Z", 58),
  ]),
  entry("mitocondria", "biologia", "Biología Celular", [
    session("s-2", "2026-09-22T12:00:00.000Z", 80),
    session("s-1", "2026-09-20T12:00:00.000Z", 70),
  ]),
  entry("derivadas", "calculo", "Cálculo III", [
    session("s-4", "2026-09-21T12:00:00.000Z", 33),
  ]),
];

describe("ActiveRecallHubPage", () => {
  beforeEach(() => {
    listRecallHubAction.mockReset();
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: PAGES, averageMastery: 47 },
    });
    getGenerationStatusAction.mockReset();
    getGenerationStatusAction.mockResolvedValue({
      ok: true,
      value: { remainingToday: 2, resetAt: "2026-10-30T00:00:00.000Z" },
    });
    loadCreateExamNotebooks.mockReset();
    loadCreateExamNotebooks.mockResolvedValue(null);
    CreateFromPageDialog.mockReset();
    CreateFromPageDialog.mockImplementation(((props: { trigger: string }) =>
      createElement("div", {
        "data-testid": `create-recall-${props.trigger}`,
      })) as never);
  });

  // Phase 8 H11: with sessions listed, "Generar preguntas" opens from a
  // tile fixed first in the grid (AI only: no manual recall questions).
  it("puts the create tile first in the notebooks grid", async () => {
    render(await ActiveRecallHubPage());

    const tile = screen.getByTestId("create-recall-tile");
    expect(tile.parentElement?.firstElementChild).toBe(tile);
    expect(CreateFromPageDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        technique: "recall",
        trigger: "tile",
        remaining: 2,
        notebooks: null,
      }),
      undefined,
    );
    expect(screen.queryByTestId("create-recall-cta")).toBeNull();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ActiveRecallHubPage());

    expect(
      screen.getByRole("heading", { name: "Recordación activa" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).toBeNull();
  });

  it("totals the real sessions and notebooks in the header", async () => {
    render(await ActiveRecallHubPage());

    expect(screen.getByText("4 sesiones · 2 cuadernos")).toBeInTheDocument();
  });

  it("summarises sessions, the study-engine average mastery and notebooks in pills", async () => {
    render(await ActiveRecallHubPage());

    expect(screen.getByText("4 sesiones guardadas")).toBeInTheDocument();
    expect(screen.getByText("47 % dominio promedio")).toBeInTheDocument();
    expect(screen.getByText("2 cuadernos activos")).toBeInTheDocument();
  });

  it("uses the singular for one session and one notebook", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: [PAGES[2]], averageMastery: 0 },
    });

    render(await ActiveRecallHubPage());

    expect(screen.getByText("1 sesión · 1 cuaderno")).toBeInTheDocument();
    expect(screen.getByText("1 sesión guardada")).toBeInTheDocument();
    expect(screen.getByText("1 cuaderno activo")).toBeInTheDocument();
    expect(screen.getByText("1 página con preguntas")).toBeInTheDocument();
  });

  it("shows 0 % average mastery when the mastery is unknown", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: PAGES, averageMastery: null },
    });

    render(await ActiveRecallHubPage());

    expect(screen.getByText("0 % dominio promedio")).toBeInTheDocument();
  });

  it("offers a quick start into the first page that has questions", async () => {
    render(await ActiveRecallHubPage());

    const quickStart = screen.getByRole("link", { name: /Nueva sesión/ });
    expect(quickStart).toHaveAttribute(
      "href",
      "/active-recall/biologia/membrana",
    );
    expect(quickStart).toHaveTextContent("3 páginas con preguntas");
  });

  it("starts the quick session on the first page with recall questions due today", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [
          PAGES[0],
          { ...PAGES[1], dueToday: 2 },
          { ...PAGES[2], dueToday: 5 },
        ],
        averageMastery: 47,
      },
    });

    render(await ActiveRecallHubPage());

    expect(screen.getByRole("link", { name: /Nueva sesión/ })).toHaveAttribute(
      "href",
      "/active-recall/biologia/mitocondria",
    );
  });

  it("links each notebook card to its sessions with the latest session's percentage", async () => {
    render(await ActiveRecallHubPage());

    expect(
      screen.getByRole("link", { name: /Biología Celular/ }),
    ).toHaveAttribute("href", "/active-recall/biologia");
    expect(
      screen.getByText("3 sesiones · último dominio 80 %"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cálculo III/ })).toHaveAttribute(
      "href",
      "/active-recall/calculo",
    );
    expect(
      screen.getByText("1 sesión · último dominio 33 %"),
    ).toBeInTheDocument();
  });

  it("badges each notebook card with its recall questions due today", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [
          { ...PAGES[0], dueToday: 4 },
          { ...PAGES[1], dueToday: 3 },
          { ...PAGES[2], dueToday: 0 },
        ],
        averageMastery: 47,
      },
    });

    render(await ActiveRecallHubPage());

    const biologia = screen.getByRole("link", { name: /Biología Celular/ });
    expect(within(biologia).getByText("7")).toBeInTheDocument();
    const calculo = screen.getByRole("link", { name: /Cálculo III/ });
    expect(calculo.querySelector(".bg-error-500")).toBeNull();
  });

  it("shows no due badge when the due counts are unknown", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: PAGES.map((page) => ({ ...page, dueToday: null })),
        averageMastery: 47,
      },
    });

    render(await ActiveRecallHubPage());

    for (const link of screen.getAllByRole("link", {
      name: /Biología|Cálculo/,
    })) {
      expect(link.querySelector(".bg-error-500")).toBeNull();
    }
  });

  it("reads 0 % for a latest session still being evaluated", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [
          entry("p", "nb", "Cuaderno", [
            session("s", "2026-09-22T12:00:00.000Z", null),
          ]),
        ],
        averageMastery: 0,
      },
    });

    render(await ActiveRecallHubPage());

    expect(
      screen.getByText("1 sesión · último dominio 0 %"),
    ).toBeInTheDocument();
  });

  // Phase 8 H16: questions generated from the hub, no finished session.
  it("shows the notebook card for a page with questions and no finished session", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [entry("nucleo", "nb-new", "Química", [])],
        averageMastery: 0,
      },
    });

    render(await ActiveRecallHubPage());

    const card = screen.getByRole("link", { name: /Química/ });
    expect(card).toHaveAttribute("href", "/active-recall/nb-new");
    expect(card).toHaveTextContent("0 sesiones · último dominio 0 %");
    expect(
      screen.queryByRole("heading", {
        name: "Practica explicando con tus palabras",
      }),
    ).toBeNull();
  });

  it("shows the empty state when no page has a session", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: [], averageMastery: null },
    });

    render(await ActiveRecallHubPage());

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
    expect(screen.getByText("0 sesiones · 0 cuadernos")).toBeInTheDocument();
  });

  it("shows the load error in the empty state when the sessions cannot load", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });

    render(await ActiveRecallHubPage());

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
