import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/active-recall/nb/pg/editar",
}));
const { listRecallQuestionsAction, saveRecallEditsAction } = vi.hoisted(() => ({
  listRecallQuestionsAction: vi.fn(),
  saveRecallEditsAction: vi.fn(),
}));
vi.mock("@/modules/active-recall", () => ({
  listRecallQuestionsAction,
  saveRecallEditsAction,
}));
const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));

import RecallEditPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const Q1 = "3c2d3e4f-5f60-4172-8899-b2c3d4e5f607";
const props = (search: Record<string, string> = {}) => ({
  params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
  searchParams: Promise.resolve(search),
});

describe("RecallEditPage (Phase 8 H18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({ id: PAGE, title: "Tu apunte" });
    getNotebookTitleForRoute.mockResolvedValue("Cuaderno");
    listRecallQuestionsAction.mockResolvedValue({
      ok: true,
      value: [
        {
          id: Q1,
          pageId: PAGE,
          prompt: "Explica la idea principal",
          keyConcepts: ["Idea A", "Idea B"],
          acceptableAnswerSummary: "Resumen esperado",
          origin: "ai",
        },
      ],
    });
  });

  it("lists every question with its key concepts, one per line, under the recall theme", async () => {
    const { container } = render(await RecallEditPage(props()));

    expect(screen.getByLabelText("Pregunta")).toHaveValue(
      "Explica la idea principal",
    );
    expect(screen.getByLabelText("Conceptos clave")).toHaveValue(
      "Idea A\nIdea B",
    );
    expect(screen.getByLabelText("Respuesta esperada")).toHaveValue(
      "Resumen esperado",
    );
    expect(
      container.querySelector('[data-technique-theme="recall"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: /Recordación activa/ }),
    ).toHaveAttribute("href", `/active-recall?cuaderno=${NOTEBOOK}`);
  });

  it("saves the key concepts as a list", async () => {
    saveRecallEditsAction.mockResolvedValue({ ok: true, value: [] });
    const user = userEvent.setup();
    render(await RecallEditPage(props({ desde: "hub" })));

    const concepts = screen.getByLabelText("Conceptos clave");
    await user.type(concepts, "\n Idea C \n\n");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(saveRecallEditsAction).toHaveBeenCalledWith({
      pageId: PAGE,
      updates: [
        {
          id: Q1,
          prompt: "Explica la idea principal",
          keyConcepts: ["Idea A", "Idea B", "Idea C"],
          acceptableAnswerSummary: "Resumen esperado",
        },
      ],
      creates: [],
      deletes: [],
    });
  });

  it("answers 404 for an unknown page", async () => {
    getPageForRoute.mockResolvedValue(null);
    await expect(RecallEditPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
