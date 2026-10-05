import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { listDecksAction } = vi.hoisted(() => ({ listDecksAction: vi.fn() }));
vi.mock("@/modules/flashcards", () => ({ listDecksAction }));
const { getNotebookTitleForRoute } = vi.hoisted(() => ({
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({ getNotebookTitleForRoute }));
const { listDueTodayAction } = vi.hoisted(() => ({
  listDueTodayAction: vi.fn(),
}));
vi.mock("@/modules/scheduling", () => ({ listDueTodayAction }));

import FlashcardsNotebookPage from "./page";

const params = (notebookId: string) => Promise.resolve({ notebookId });

function deck(
  pageId: string,
  notebookId: string,
  title: string,
  count: number,
) {
  return {
    pageId,
    notebookId,
    pageTitle: title,
    notebookTitle: "Biología Celular",
    notebookColor: "purple",
    count,
  };
}

describe("FlashcardsNotebookPage (real data)", () => {
  beforeEach(() => {
    notFound.mockClear();
    listDecksAction.mockReset();
    listDueTodayAction.mockReset();
    listDueTodayAction.mockResolvedValue({
      ok: true,
      value: [
        {
          pageId: "p2",
          pageTitle: "Membrana celular",
          notebookId: "n1",
          notebookTitle: "Biología Celular",
          notebookColor: "purple",
          due: { flashcard: 4, exam_question: 0, recall_question: 0 },
          earliestDueAt: new Date("2026-10-04T08:00:00.000Z"),
        },
      ],
    });
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
    listDecksAction.mockResolvedValue({
      ok: true,
      value: [
        deck("p1", "n1", "Mitocondria", 8),
        deck("p2", "n1", "Membrana celular", 12),
        deck("p3", "n2", "Otra página", 3),
      ],
    });
  });

  it("is not behind the design-preview gate: it renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    render(await FlashcardsNotebookPage({ params: params("n1") }));

    expect(
      screen.getByRole("heading", { name: "Biología Celular" }),
    ).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("answers 404 for a notebook that is not the caller's", async () => {
    getNotebookTitleForRoute.mockResolvedValue(null);

    await expect(
      FlashcardsNotebookPage({ params: params("nope") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists one deck per page of this notebook only, titled by the page, with its real count and a deck link", async () => {
    render(await FlashcardsNotebookPage({ params: params("n1") }));

    const deckLink = screen.getByRole("link", { name: /Mitocondria/ });
    expect(deckLink).toHaveAttribute("href", "/flashcards/n1/p1");
    expect(deckLink).toHaveTextContent("8 tarjetas");
    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toHaveTextContent("12 tarjetas");
    expect(screen.queryByText("Otra página")).not.toBeInTheDocument();
    expect(
      screen.getByText("20 tarjetas · 2 páginas con flashcards"),
    ).toBeInTheDocument();
  });

  it("shows each deck's due flashcards, or Al día when none is due", async () => {
    render(await FlashcardsNotebookPage({ params: params("n1") }));

    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toHaveTextContent("4 pendientes");
    expect(screen.getByRole("link", { name: /Mitocondria/ })).toHaveTextContent(
      "Al día",
    );
  });

  it("shows no due status when the due list could not load", async () => {
    listDueTodayAction.mockResolvedValue({
      ok: false,
      error: { code: "SCHEDULING_UNEXPECTED", message: "x" },
    });

    render(await FlashcardsNotebookPage({ params: params("n1") }));

    expect(screen.queryByText(/pendiente/)).not.toBeInTheDocument();
    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
  });

  it("shows the empty state for a notebook without decks", async () => {
    listDecksAction.mockResolvedValue({ ok: true, value: [] });

    render(await FlashcardsNotebookPage({ params: params("n1") }));

    expect(screen.getByText("Sin mazos todavía")).toBeInTheDocument();
  });

  it("offers no notebook-level card creation: cards are created from a page", async () => {
    render(await FlashcardsNotebookPage({ params: params("n1") }));

    expect(
      screen.queryByRole("button", { name: /Nueva tarjeta/ }),
    ).not.toBeInTheDocument();
  });
});
