import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));
const { listExamHubAction } = vi.hoisted(() => ({
  listExamHubAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({ listExamHubAction }));
const { getNotebookTitleForRoute, getSidebarTree, CreateExamDialog } =
  vi.hoisted(() => ({
    getNotebookTitleForRoute: vi.fn(),
    getSidebarTree: vi.fn(),
    CreateExamDialog: vi.fn(({ trigger }: { trigger?: string }) => (
      // A stand-in trigger, so the test sees where each one renders.
      <button type="button" data-testid={`create-exam-${trigger}`} />
    )),
  }));
vi.mock("@/modules/notebooks", () => ({
  getNotebookTitleForRoute,
  getSidebarTree,
}));
vi.mock("../_components/create-exam-dialog", () => ({ CreateExamDialog }));

import ExamsNotebookPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function params(notebookId: string) {
  return { params: Promise.resolve({ notebookId }) };
}

function entry(pageId: string, overrides: Record<string, unknown> = {}) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: NOTEBOOK,
    notebookTitle: "Biología Celular",
    notebookColor: "green",
    questionCount: 10,
    attempts: 0,
    lastScore: null,
    passed: false,
    lastFinishedAt: null,
    retakePending: false,
    ready: true,
    dueToday: 0,
    ...overrides,
  };
}

const ENTRIES = [
  entry("mitocondria", {
    pageTitle: "Mitocondria",
    attempts: 2,
    lastScore: 60,
    lastFinishedAt: "2026-09-22T12:00:00.000Z",
    retakePending: true,
  }),
  entry("membrana", {
    pageTitle: "Membrana celular",
    questionCount: 12,
    attempts: 1,
    lastScore: 83,
    passed: true,
    lastFinishedAt: "2026-09-18T12:00:00.000Z",
  }),
  entry("derivadas", { pageTitle: "Derivadas parciales" }),
  entry("otra", { pageTitle: "Otro cuaderno", notebookId: "other" }),
];

describe("ExamsNotebookPage (real data)", () => {
  beforeEach(() => {
    notFound.mockClear();
    getSidebarTree.mockReset();
    getSidebarTree.mockResolvedValue([]);
    CreateExamDialog.mockClear();
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
    listExamHubAction.mockReset();
    listExamHubAction.mockResolvedValue({ ok: true, value: ENTRIES });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ExamsNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByRole("heading", { name: "Biología Celular" }),
    ).toBeInTheDocument();
  });

  it("answers 404 for an unknown, archived or foreign notebook", async () => {
    getNotebookTitleForRoute.mockResolvedValue(null);

    await expect(ExamsNotebookPage(params("no-existe"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("lists the notebook's exam pages with their retake state", async () => {
    render(await ExamsNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByText("3 exámenes · 3 páginas con preguntas"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mitocondria" })).toHaveAttribute(
      "href",
      `/exams/${NOTEBOOK}/mitocondria?retake=1`,
    );
    expect(screen.getByText("Repetir pendiente")).toBeInTheDocument();
    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(screen.getByText("22 sept")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Membrana celular" }),
    ).toHaveAttribute("href", `/exams/${NOTEBOOK}/membrana/resultados`);
    expect(screen.getByText("12 preguntas · 1 intento")).toBeInTheDocument();
    expect(screen.queryByText("Otro cuaderno")).toBeNull();
  });

  it("lists a never-examined page as 'Sin intentar' with its exam link", async () => {
    render(await ExamsNotebookPage(params(NOTEBOOK)));

    const link = screen.getByRole("link", { name: "Derivadas parciales" });
    expect(link).toHaveAttribute("href", `/exams/${NOTEBOOK}/derivadas`);
    const card = link.parentElement?.parentElement as HTMLElement;
    expect(within(card).getByText("Sin intentar")).toBeInTheDocument();
    expect(within(card).getByText("Presentar examen →")).toBeInTheDocument();
  });

  it("shows the empty state when the notebook has no exam pages", async () => {
    listExamHubAction.mockResolvedValue({ ok: true, value: [] });

    render(await ExamsNotebookPage(params(NOTEBOOK)));

    expect(screen.getByText("Sin exámenes todavía")).toBeInTheDocument();
    expect(
      screen.getByText("0 exámenes · 0 páginas con preguntas"),
    ).toBeInTheDocument();
    // Phase 8 H13: the empty state's CTA is the only create control.
    expect(screen.getByTestId("create-exam-cta")).toBeInTheDocument();
    expect(screen.queryByTestId("create-exam-tile")).toBeNull();
    expect(screen.queryByTestId("create-exam-button")).toBeNull();
  });

  // Phase 8 H13 (user 2026-10-29): no "Crear examen" in the header; as on
  // the hubs, a create tile is fixed first in the grid.
  it("puts the create tile first in the grid, not in the header", async () => {
    render(await ExamsNotebookPage(params(NOTEBOOK)));

    const tile = screen.getByTestId("create-exam-tile");
    expect(tile.parentElement?.firstElementChild).toBe(tile);
    expect(screen.queryByTestId("create-exam-button")).toBeNull();
    expect(screen.queryByTestId("create-exam-cta")).toBeNull();
    expect(CreateExamDialog).toHaveBeenCalledTimes(1);
  });

  it("shows the load error in the empty state when the pages cannot load", async () => {
    listExamHubAction.mockResolvedValue({
      ok: false,
      error: { code: "EXAMS_UNEXPECTED", message: "x" },
    });

    render(await ExamsNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByText("No pudimos cargar tus exámenes. Intenta de nuevo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).toBeNull();
  });

  it("marks a passed page with questions due today", async () => {
    listExamHubAction.mockResolvedValue({
      ok: true,
      value: [{ ...ENTRIES[1], dueToday: 2 }],
    });

    render(await ExamsNotebookPage(params(NOTEBOOK)));

    expect(screen.getByText("Vence hoy")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Membrana celular" }),
    ).toHaveAttribute("href", `/exams/${NOTEBOOK}/membrana`);
    expect(screen.getByText("Rendir examen →")).toBeInTheDocument();
  });

  it("offers 'Crear examen' with this notebook preselected", async () => {
    getSidebarTree.mockResolvedValue([
      { id: "x", title: "Otro", icon: null, color: null, pages: [] },
      {
        id: NOTEBOOK,
        title: "Biología Celular",
        icon: null,
        color: "green",
        pages: [{ id: "p-1", title: "Mitocondria" }],
      },
    ]);

    render(await ExamsNotebookPage(params(NOTEBOOK)));

    const [props] = CreateExamDialog.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(props.initialNotebookId).toBe(NOTEBOOK);
    expect(props.notebooks).toEqual([
      { id: "x", title: "Otro", pages: [] },
      {
        id: NOTEBOOK,
        title: "Biología Celular",
        pages: [{ id: "p-1", title: "Mitocondria" }],
      },
    ]);
  });
});
