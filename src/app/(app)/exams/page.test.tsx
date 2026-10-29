import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listExamHubAction } = vi.hoisted(() => ({
  listExamHubAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({ listExamHubAction }));
const { getSidebarTree, CreateExamDialog } = vi.hoisted(() => ({
  getSidebarTree: vi.fn(),
  CreateExamDialog: vi.fn(() => null),
}));
vi.mock("./_components/create-exam-dialog", () => ({ CreateExamDialog }));
vi.mock("@/modules/notebooks", () => ({
  getSidebarTree,
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
    ...overrides,
  };
}

// Biología: Mitocondria failed (retake pending, 2 exams, last 60 %),
// Membrana passed (1 exam, 83 %); Cálculo: never examined.
const ENTRIES = [
  entry("mitocondria", "biologia", "Biología Celular", {
    pageTitle: "Mitocondria",
    attempts: 2,
    lastScore: 60,
    lastFinishedAt: "2026-10-05T10:00:00.000Z",
    retakePending: true,
    dueToday: 4,
  }),
  entry("membrana", "biologia", "Biología Celular", {
    pageTitle: "Membrana celular",
    attempts: 1,
    lastScore: 83,
    passed: true,
    lastFinishedAt: "2026-10-01T10:00:00.000Z",
  }),
  entry("derivadas", "calculo", "Cálculo III", {
    pageTitle: "Derivadas parciales",
    notebookColor: "blue",
  }),
];

describe("ExamsHubPage (real data)", () => {
  beforeEach(() => {
    getSidebarTree.mockReset();
    getSidebarTree.mockResolvedValue([]);
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

    render(await ExamsHubPage());

    expect(
      screen.getByRole("heading", { name: "Exámenes" }),
    ).toBeInTheDocument();
  });

  // Phase 8 H11: with exams listed, "Crear examen" also opens from a tile
  // fixed first in the grid, before the notebooks.
  it("puts the create tile first in the notebooks grid", async () => {
    render(await ExamsHubPage());

    const tile = screen.getByTestId("create-exam-tile");
    const grid = tile.parentElement as HTMLElement;
    expect(grid.firstElementChild).toBe(tile);
    expect(grid.querySelectorAll("a")).toHaveLength(2);
    expect(screen.queryByTestId("create-exam-cta")).toBeNull();
    // Phase 8 H13 (user 2026-10-29): no "Crear examen" in the header.
    expect(screen.queryByTestId("create-exam-button")).toBeNull();
  });

  it("derives the totals from the real pages", async () => {
    render(await ExamsHubPage());

    expect(screen.getByText("3 exámenes · 2 cuadernos")).toBeInTheDocument();
    expect(screen.getByText("3 exámenes presentados")).toBeInTheDocument();
    expect(screen.getByText("1 aprobado")).toBeInTheDocument();
    expect(screen.getByText("1 pendiente de repetir")).toBeInTheDocument();
  });

  it("links the retake banner to the failed page's exam", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [{ ...ENTRIES[0], dueToday: 0 }, ENTRIES[1], ENTRIES[2]],
    });
    render(await ExamsHubPage());

    expect(
      screen.getByText("Tienes 1 página pendiente de repetir examen"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fallaste el último examen de Mitocondria; las preguntas falladas vencen mañana.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", "/exams/biologia/mitocondria?retake=1");
  });

  it("has no retake banner when no page is pending", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [ENTRIES[1], ENTRIES[2]],
    });

    render(await ExamsHubPage());

    expect(screen.queryByRole("link", { name: "Repetir examen" })).toBeNull();
    expect(screen.getByText("0 pendientes de repetir")).toBeInTheDocument();
  });

  it("shows one card per notebook with its exams and latest score", async () => {
    render(await ExamsHubPage());

    expect(
      screen.getByRole("link", { name: /Biología Celular/ }),
    ).toHaveAttribute("href", "/exams/biologia");
    expect(
      screen.getByText("3 exámenes · última nota 60 %"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cálculo III/ })).toHaveAttribute(
      "href",
      "/exams/calculo",
    );
    expect(screen.getByText("0 exámenes · sin intentar")).toBeInTheDocument();
  });

  it("takes the notebook's latest score from its most recently finished exam", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [
        entry("a", "nb", "Cuaderno", {
          attempts: 1,
          lastScore: 40,
          lastFinishedAt: "2026-10-01T10:00:00.000Z",
        }),
        entry("b", "nb", "Cuaderno", {
          attempts: 1,
          lastScore: 90,
          lastFinishedAt: "2026-10-04T10:00:00.000Z",
        }),
      ],
    });

    render(await ExamsHubPage());

    expect(
      screen.getByText("2 exámenes · última nota 90 %"),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no page has questions", async () => {
    listExamHubAction.mockResolvedValue({ ok: true, value: [] });

    render(await ExamsHubPage());

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

    render(await ExamsHubPage());

    expect(
      screen.getByText("No pudimos cargar tus exámenes. Intenta de nuevo."),
    ).toBeInTheDocument();
    // Same empty state as Flashcards' load error: its headline stays.
    expect(
      screen.getByRole("heading", { name: "Pon a prueba lo que sabes" }),
    ).toBeInTheDocument();
  });

  it("has no 'Vista previa' pill on real data", async () => {
    render(await ExamsHubPage());

    expect(screen.queryByText("Vista previa")).toBeNull();
  });

  it("says the failed questions are ready once they are due", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [{ ...ENTRIES[0], failedDueNow: true }, ENTRIES[1], ENTRIES[2]],
    });
    render(await ExamsHubPage());

    expect(
      screen.getByText(
        "Fallaste el último examen de Mitocondria; las preguntas falladas ya están para repasar.",
      ),
    ).toBeInTheDocument();
  });

  it("says the failed questions are due tomorrow while only the page's other questions are due", async () => {
    // Mitocondria has 4 exam questions due today, none of them failed.
    render(await ExamsHubPage());

    expect(
      screen.getByText(
        "Fallaste el último examen de Mitocondria; las preguntas falladas vencen mañana.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ya están para repasar/)).toBeNull();
  });

  it("gives neutral advice when the failed questions' due state is unknown", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [
        { ...ENTRIES[0], dueToday: null, failedDueNow: null },
        ENTRIES[1],
        ENTRIES[2],
      ],
    });

    render(await ExamsHubPage());

    expect(
      screen.getByText(
        "Fallaste el último examen de Mitocondria; repasa los conceptos fallados antes de repetir.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/vencen mañana/)).toBeNull();
  });

  it("offers 'Crear examen' only from the grid tile: no header button, no 'Nuevo examen'", async () => {
    render(await ExamsHubPage());

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
      getSidebarTree.mockResolvedValue(TREE);
      listExamHubAction.mockResolvedValue({ ok: true, value: [] });

      render(await ExamsHubPage());

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
      getSidebarTree.mockRejectedValue(new Error("db down"));
      listExamHubAction.mockResolvedValue({ ok: true, value: [] });

      render(await ExamsHubPage());

      const [props] = CreateExamDialog.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ];
      expect(props.notebooks).toBeNull();
    });
  });
});
