import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listExamHubAction } = vi.hoisted(() => ({
  listExamHubAction: vi.fn(),
}));
// Phase 8 H19: the card's delete provider is client code with its own test.
vi.mock("../_components/delete-technique-set", () => ({
  DeleteTechniqueSetProvider: ({ children }: { children: unknown }) => children,
  DeleteTechniqueSetMenuItem: () => null,
}));
vi.mock("@/modules/exams", () => ({ listExamHubAction }));
const { getPagePickerTree, CreateExamDialog } = vi.hoisted(() => ({
  getPagePickerTree: vi.fn(),
  CreateExamDialog: vi.fn(() => null),
}));
vi.mock("./_components/create-exam-dialog", () => ({ CreateExamDialog }));
vi.mock("@/modules/notebooks", () => ({
  getPagePickerTree,
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

import ExamsHubPage from "./page";

function entry(
  pageId: string,
  notebookId: string,
  notebookTitle: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId,
    notebookTitle,
    notebookColor: "green",
    questionCount: 10,
    attempts: 0,
    lastScore: null,
    passed: false,
    lastFinishedAt: null,
    retakePending: false,
    ready: true,
    dueToday: 0,
    failedDueNow: false,
    bestScore: null,
    latestQuestionAt: "2026-09-01T10:00:00.000Z",
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

// Cuaderno A: Mitocondria failed (retake pending, 2 exams, last 50 %),
// Membrana passed (1 exam, best 92 %, last 85 %); Cuaderno B: Derivadas
// never examined.
const ENTRIES = [
  entry("membrana", NB_A, "Cuaderno A", {
    pageTitle: "Membrana celular",
    attempts: 3,
    lastScore: 85,
    bestScore: 92,
    passed: true,
    lastFinishedAt: "2026-10-01T10:00:00.000Z",
  }),
  entry("mitocondria", NB_A, "Cuaderno A", {
    pageTitle: "Mitocondria",
    questionCount: 20,
    attempts: 2,
    lastScore: 50,
    bestScore: 50,
    lastFinishedAt: "2026-09-20T10:00:00.000Z",
    retakePending: true,
    dueToday: 4,
  }),
  entry("derivadas", NB_B, "Cuaderno B", {
    pageTitle: "Derivadas parciales",
    notebookColor: "blue",
    questionCount: 15,
  }),
];

const titles = () =>
  screen
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

const cardOf = (title: string) =>
  screen
    .getByRole("heading", { level: 3, name: title })
    .closest("article") as HTMLElement;

describe("ExamsHubPage (flat since Phase 8 H17)", () => {
  beforeEach(() => {
    getPagePickerTree.mockReset();
    getPagePickerTree.mockResolvedValue([]);
    CreateExamDialog.mockClear();
    // Each instance renders a marker named after its trigger, so the
    // tests can see where the dialog's entry points sit.
    CreateExamDialog.mockImplementation(((props: { trigger?: string }) =>
      createElement("div", {
        "data-testid": `create-exam-${props.trigger ?? "button"}`,
      })) as never);
    listExamHubAction.mockReset();
    listExamHubAction.mockResolvedValue({ ok: true, value: ENTRIES });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ExamsHubPage(hub()));

    expect(
      screen.getByRole("heading", { name: "Exámenes" }),
    ).toBeInTheDocument();
  });

  it("lists every exam page after the create tile, with the counts in the header", async () => {
    render(await ExamsHubPage(hub()));

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(
      screen.getByText("5 exámenes · 3 páginas · 2 cuadernos"),
    ).toBeInTheDocument();
    const tile = screen.getByTestId("create-exam-tile");
    expect(tile.parentElement?.firstElementChild).toBe(tile);
    // The retake banner and the summary pills are gone: the cards say it.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/pendientes? de repetir/)).toBeNull();
    expect(screen.queryByText(/exámenes presentados/)).toBeNull();
  });

  it("orders the retake first, then never examined, then the most recent", async () => {
    render(await ExamsHubPage(hub()));

    expect(titles()).toEqual([
      "Mitocondria",
      "Derivadas parciales",
      "Membrana celular",
    ]);
  });

  it("offers a filled retake on a failed page, with its last attempt", async () => {
    render(await ExamsHubPage(hub()));

    const card = cardOf("Mitocondria");
    expect(
      within(card).getByText("Repetir cuando estés listo"),
    ).toBeInTheDocument();
    expect(within(card).getByText(/Último intento/)).toHaveTextContent(
      "Último intento 50 %",
    );
    expect(within(card).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    const retake = within(card).getByRole("link", {
      name: "Repetir examen: Mitocondria",
    });
    expect(retake).toHaveAttribute("data-emphasis", "primary");
    expect(retake).toHaveAttribute(
      "href",
      `/exams/${NB_A}/mitocondria?desde=hub`,
    );
  });

  it("shows the best and last scores of an examined page, with a soft Hacer examen", async () => {
    render(await ExamsHubPage(hub()));

    const card = cardOf("Membrana celular");
    expect(within(card).getByText(/Mejor nota/)).toHaveTextContent(
      "Mejor nota 92 % · último 85 %",
    );
    expect(within(card).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "92",
    );
    expect(
      within(card).getByRole("link", {
        name: "Hacer examen: Membrana celular",
      }),
    ).toHaveAttribute("data-emphasis", "soft");
  });

  it("says a never-examined page has no attempts, without a bar", async () => {
    render(await ExamsHubPage(hub()));

    const card = cardOf("Derivadas parciales");
    expect(within(card).getByText("Sin intentos")).toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).toBeNull();
    expect(within(card).getByTestId("technique-item-metric")).toHaveTextContent(
      "15 preguntas",
    );
  });

  it("filters by notebook on the server and keeps the filter in the exam links", async () => {
    render(await ExamsHubPage(hub(NB_B)));

    expect(titles()).toEqual(["Derivadas parciales"]);
    expect(
      screen.getByRole("link", { name: "Hacer examen: Derivadas parciales" }),
    ).toHaveAttribute(
      "href",
      `/exams/${NB_B}/derivadas?desde=hub&cuaderno=${NB_B}`,
    );
  });

  it("says so inline, with the create tile, when the chosen notebook has no exams", async () => {
    render(await ExamsHubPage(hub("33333333-3333-4333-8333-333333333333")));

    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.getByText("Este cuaderno aún no tiene exámenes."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-exam-tile")).toBeInTheDocument();
  });

  it("offers the questions and the page in the card menu", async () => {
    render(await ExamsHubPage(hub()));

    expect(
      screen.getByRole("button", { name: "Acciones de Mitocondria" }),
    ).toBeInTheDocument();
  });

  // Phase 8 H18: "Ver preguntas" became "Editar preguntas", the edit page.
  it("leads the menu's Editar preguntas to the page's edit page", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(await ExamsHubPage(hub()));

    await user.click(
      screen.getByRole("button", { name: "Acciones de Mitocondria" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /Editar preguntas/ }),
    ).toHaveAttribute("href", expect.stringMatching(/\/editar\?desde=hub$/));
    expect(
      screen.queryByRole("menuitem", { name: /Ver preguntas/ }),
    ).toBeNull();
  });

  it("shows the empty state when no page has questions", async () => {
    listExamHubAction.mockResolvedValue({ ok: true, value: [] });

    render(await ExamsHubPage(hub()));

    // Phase 8 H10: the illustrated empty state (a stacked exam sheet,
    // gradient headline). Since H13 the header has no "Crear examen": the
    // CTA is the empty hub's only create control.
    expect(
      screen.getByRole("heading", { name: "Pon a prueba lo que sabes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Elige una página y la IA crea un examen de opción múltiple desde su texto.",
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="technique-empty-art"]'),
    ).toHaveAttribute("data-technique", "exams");
    // Phase 8 H11: the technique theme on the header and the empty state.
    expect(
      document.querySelector('[data-slot="technique-hub-header"]'),
    ).toHaveAttribute("data-technique-theme", "exams");
    expect(
      document.querySelector('[data-slot="illustrated-empty-state"]'),
    ).toHaveAttribute("data-technique-theme", "exams");
    // Phase 8 H11: the CTA opens "Crear examen" itself; there is no grid, so
    // no create tile, and since H13 no header button either.
    const empty = document.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(
      empty.querySelector('[data-testid="create-exam-cta"]'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("create-exam-button")).toBeNull();
    expect(screen.queryByTestId("create-exam-tile")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Ir a mis cuadernos" }),
    ).toBeNull();
    expect(screen.queryByText(/Técnicas → Examen/)).toBeNull();
  });

  it("shows the load error in the empty state when the pages cannot load", async () => {
    listExamHubAction.mockResolvedValue({
      ok: false,
      error: { code: "EXAMS_UNEXPECTED", message: "x" },
    });

    render(await ExamsHubPage(hub()));

    expect(
      screen.getByText("No pudimos cargar tus exámenes. Intenta de nuevo."),
    ).toBeInTheDocument();
    // Same empty state as Flashcards' load error: its headline stays.
    expect(
      screen.getByRole("heading", { name: "Pon a prueba lo que sabes" }),
    ).toBeInTheDocument();
  });

  it("offers 'Crear examen' only from the grid tile: no header button, no 'Nuevo examen'", async () => {
    render(await ExamsHubPage(hub()));

    // Phase 8 H13: the header's button is gone; H11's grid tile stays.
    expect(
      CreateExamDialog.mock.calls.map(
        (call) => (call as unknown as [{ trigger?: string }])[0].trigger,
      ),
    ).toEqual(["tile"]);
    expect(screen.queryByText("Nuevo examen")).toBeNull();
    expect(screen.queryByText(/páginas con preguntas/)).toBeNull();
  });

  describe("Crear examen (Phase 6 T5b)", () => {
    const TREE = [
      {
        id: "nb-1",
        title: "Biología",
        icon: null,
        color: "green",
        pages: [{ id: "p-1", title: "Mitocondria" }],
      },
    ];

    it("offers 'Crear examen' with the owner's notebooks and their pages", async () => {
      getPagePickerTree.mockResolvedValue(TREE);
      listExamHubAction.mockResolvedValue({ ok: true, value: [] });

      render(await ExamsHubPage(hub()));

      // H11's empty-state CTA is the only trigger (no header button, H13).
      expect(CreateExamDialog).toHaveBeenCalledTimes(1);
      const [props] = CreateExamDialog.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ];
      expect(props.notebooks).toEqual([
        {
          id: "nb-1",
          title: "Biología",
          pages: [{ id: "p-1", title: "Mitocondria" }],
        },
      ]);
      expect(props.initialNotebookId).toBeUndefined();
    });

    it("still offers it, with the notebooks unknown (a load error), when the tree cannot be read", async () => {
      getPagePickerTree.mockRejectedValue(new Error("db down"));
      listExamHubAction.mockResolvedValue({ ok: true, value: [] });

      render(await ExamsHubPage(hub()));

      const [props] = CreateExamDialog.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ];
      expect(props.notebooks).toBeNull();
    });
  });
});
