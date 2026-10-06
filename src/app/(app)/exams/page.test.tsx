import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listExamHubAction } = vi.hoisted(() => ({
  listExamHubAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({ listExamHubAction }));
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

  it("derives the totals from the real pages", async () => {
    render(await ExamsHubPage());

    expect(screen.getByText("3 exámenes · 2 cuadernos")).toBeInTheDocument();
    expect(screen.getByText("3 exámenes presentados")).toBeInTheDocument();
    expect(screen.getByText("1 aprobado")).toBeInTheDocument();
    expect(screen.getByText("1 pendiente de repetir")).toBeInTheDocument();
  });

  it("links the retake banner to the failed page's exam", async () => {
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

  it("starts a new exam on the first page with questions", async () => {
    render(await ExamsHubPage());

    expect(screen.getByRole("link", { name: /Nuevo examen/ })).toHaveAttribute(
      "href",
      "/exams/biologia/mitocondria",
    );
    expect(screen.getByText("3 páginas con preguntas")).toBeInTheDocument();
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

    expect(screen.getByText("Aún no tienes exámenes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Abre una página en el editor y usa Técnicas → Examen → Generar.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nuevo examen/ })).toBeNull();
  });

  it("fails loudly instead of showing a false empty state when the pages cannot load", async () => {
    listExamHubAction.mockResolvedValue({
      ok: false,
      error: { code: "EXAMS_UNEXPECTED", message: "x" },
    });

    await expect(ExamsHubPage()).rejects.toThrow();
  });
});
