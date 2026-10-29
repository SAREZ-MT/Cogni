import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));
const { listRecallHubAction } = vi.hoisted(() => ({
  listRecallHubAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({ listRecallHubAction }));
const { getNotebookTitleForRoute } = vi.hoisted(() => ({
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({ getNotebookTitleForRoute }));

import ActiveRecallNotebookPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

const params = (notebookId: string) => ({
  params: Promise.resolve({ notebookId }),
});

function entry(
  pageId: string,
  pageTitle: string,
  sessions: Record<string, unknown>[],
  notebookId = NOTEBOOK,
) {
  return {
    pageId,
    pageTitle,
    notebookId,
    notebookTitle: "Biología Celular",
    notebookColor: "green",
    sessions,
    mastery: 50,
    dueToday: 0,
  };
}

const PAGES = [
  entry("mitocondria", "Mitocondria", [
    {
      id: "session-new",
      finishedAt: "2026-09-24T12:00:00.000Z",
      questionCount: 10,
      correct: 8,
      partial: 1,
      incorrect: 1,
      percentage: 80,
    },
    {
      id: "session-old",
      finishedAt: "2026-09-20T12:00:00.000Z",
      questionCount: 8,
      correct: 5,
      partial: 2,
      incorrect: 1,
      percentage: 70,
    },
  ]),
  entry("membrana", "Membrana celular", [
    {
      id: "session-pending",
      finishedAt: "2026-09-18T12:00:00.000Z",
      questionCount: 6,
      correct: 0,
      partial: 0,
      incorrect: 0,
      percentage: null,
    },
  ]),
  entry(
    "otra",
    "De otro cuaderno",
    [
      {
        id: "session-x",
        finishedAt: "2026-09-18T12:00:00.000Z",
        questionCount: 1,
        correct: 1,
        partial: 0,
        incorrect: 0,
        percentage: 100,
      },
    ],
    "other",
  ),
];

describe("ActiveRecallNotebookPage", () => {
  beforeEach(() => {
    notFound.mockClear();
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
    listRecallHubAction.mockReset();
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: PAGES, averageMastery: 50 },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByRole("heading", { name: "Biología Celular" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).toBeNull();
    expect(getNotebookTitleForRoute).toHaveBeenCalledWith(NOTEBOOK);
  });

  it("lists this notebook's pages with their latest session", async () => {
    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByText("3 sesiones · 2 páginas con preguntas"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
    expect(screen.getByText("24 sept")).toBeInTheDocument();
    expect(screen.getByText("10 preguntas · 2 sesiones")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("8✓ · 1~ · 1✗")).toBeInTheDocument();
    expect(screen.queryByText("De otro cuaderno")).toBeNull();
  });

  it("opens each page card on its latest session's results", async () => {
    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    expect(screen.getByRole("link", { name: /Mitocondria/ })).toHaveAttribute(
      "href",
      `/active-recall/${NOTEBOOK}/mitocondria/resultados?sesion=session-new`,
    );
    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toHaveAttribute(
      "href",
      `/active-recall/${NOTEBOOK}/membrana/resultados?sesion=session-pending`,
    );
  });

  it("reads 0 % for a latest session still being evaluated", async () => {
    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    const card = screen.getByRole("link", { name: /Membrana celular/ });
    expect(card).toHaveTextContent("0%");
    expect(card).toHaveTextContent("0✓ · 0~ · 0✗");
  });

  it("shows the empty state when no page of the notebook has a session", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: { pages: [PAGES[2]], averageMastery: 100 },
    });

    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    expect(screen.getByText("Sin sesiones todavía")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Abre una página de este cuaderno y usa Técnicas → Recordación activa → Generar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0 sesiones · 0 páginas con preguntas"),
    ).toBeInTheDocument();
  });

  // Phase 8 H16: questions generated from the hub, no finished session.
  it("lists a page with questions and no finished session with a card that opens its session", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: true,
      value: {
        pages: [entry("nucleo", "Núcleo celular", [])],
        averageMastery: 0,
      },
    });

    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    const card = screen.getByRole("link", { name: /Núcleo celular/ });
    expect(card).toHaveAttribute("href", `/active-recall/${NOTEBOOK}/nucleo`);
    expect(card).toHaveTextContent("Practicar →");
    expect(screen.queryByText("Sin sesiones todavía")).toBeNull();
    expect(
      screen.getByText("0 sesiones · 1 página con preguntas"),
    ).toBeInTheDocument();
  });

  it("shows the load error in the empty state when the sessions cannot load", async () => {
    listRecallHubAction.mockResolvedValue({
      ok: false,
      error: { code: "RECALL_UNEXPECTED", message: "x" },
    });

    render(await ActiveRecallNotebookPage(params(NOTEBOOK)));

    expect(
      screen.getByText("No pudimos cargar tus sesiones. Intenta de nuevo."),
    ).toBeInTheDocument();
  });

  it("answers 404 for a notebook that is unknown, archived or another user's", async () => {
    getNotebookTitleForRoute.mockResolvedValue(null);

    await expect(ActiveRecallNotebookPage(params("missing"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(listRecallHubAction).not.toHaveBeenCalled();
  });
});
