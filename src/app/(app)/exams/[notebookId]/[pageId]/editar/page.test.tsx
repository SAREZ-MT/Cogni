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
  usePathname: () => "/exams/nb/pg/editar",
}));
const { listExamQuestionsAction, saveExamEditsAction } = vi.hoisted(() => ({
  listExamQuestionsAction: vi.fn(),
  saveExamEditsAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({
  listExamQuestionsAction,
  saveExamEditsAction,
  MAX_STEM_LENGTH: 1000,
  MAX_OPTION_LENGTH: 300,
  MAX_CONCEPT_LENGTH: 120,
  MAX_EXPLANATION_LENGTH: 2000,
  normalizeWording: (text: string) => text.trim().toLowerCase(),
}));
const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));

import ExamEditPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const Q1 = "3c2d3e4f-5f60-4172-8899-b2c3d4e5f607";
const props = (search: Record<string, string> = {}) => ({
  params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
  searchParams: Promise.resolve(search),
});

describe("ExamEditPage (Phase 8 H18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageForRoute.mockResolvedValue({ id: PAGE, title: "Tu apunte" });
    getNotebookTitleForRoute.mockResolvedValue("Cuaderno");
    listExamQuestionsAction.mockResolvedValue({
      ok: true,
      value: [
        {
          id: Q1,
          pageId: PAGE,
          stem: "¿Cuál es la opción correcta?",
          options: ["Opción A", "Opción B", "Opción C", "Opción D"],
          correctIndex: 1,
          explanation: "Porque sí.",
          concept: "Concepto",
          origin: "ai",
        },
      ],
    });
  });

  it("lists every question with its options and the correct one, under the exams theme", async () => {
    const { container } = render(await ExamEditPage(props({ desde: "hub" })));

    expect(screen.getByLabelText("Enunciado")).toHaveValue(
      "¿Cuál es la opción correcta?",
    );
    expect(screen.getByLabelText("Opción B")).toHaveValue("Opción B");
    expect(screen.getByLabelText("Opción B es la correcta")).toBeChecked();
    expect(screen.getByLabelText("Concepto que evalúa")).toHaveValue(
      "Concepto",
    );
    expect(
      container.querySelector('[data-technique-theme="exams"]'),
    ).not.toBeNull();
    expect(screen.getByRole("link", { name: /Exámenes/ })).toHaveAttribute(
      "href",
      "/exams",
    );
  });

  it("refuses repeated options inline", async () => {
    const user = userEvent.setup();
    render(await ExamEditPage(props()));

    const option = screen.getByLabelText("Opción C");
    await user.clear(option);
    await user.type(option, "Opción A");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      screen.getByText("Las 4 opciones deben ser distintas."),
    ).toBeInTheDocument();
    expect(saveExamEditsAction).not.toHaveBeenCalled();
  });

  it("saves a new correct option", async () => {
    saveExamEditsAction.mockResolvedValue({ ok: true, value: [] });
    const user = userEvent.setup();
    render(await ExamEditPage(props()));

    await user.click(screen.getByLabelText("Opción D es la correcta"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(saveExamEditsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: PAGE,
        updates: [expect.objectContaining({ id: Q1, correctIndex: 3 })],
      }),
    );
  });

  it("answers 404 for an unknown page", async () => {
    getPageForRoute.mockResolvedValue(null);
    await expect(ExamEditPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
