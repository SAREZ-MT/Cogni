import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { listFlashcardsAction } = vi.hoisted(() => ({
  listFlashcardsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({ listFlashcardsAction }));
const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));

import FlashcardsSessionPage from "./page";

const props = (notebookId: string, pageId: string) => ({
  params: Promise.resolve({ notebookId, pageId }),
});

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";

const card = (n: number) => ({
  id: `c${n}`,
  pageId: PAGE,
  front: `Pregunta ${n}`,
  back: `Respuesta ${n}`,
  position: n,
});

describe("FlashcardsSessionPage", () => {
  beforeEach(() => {
    getPageForRoute.mockReset();
    getNotebookTitleForRoute.mockReset();
    listFlashcardsAction.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  describe("sample player (design preview, Phase 4 grading still pending)", () => {
    it("starts the sample deck of a sample page while design previews are enabled", async () => {
      vi.stubEnv("NODE_ENV", "development");

      render(
        await FlashcardsSessionPage(
          props("biologia-celular", "membrana-celular"),
        ),
      );

      expect(screen.getByText("Membrana celular")).toBeInTheDocument();
      expect(
        screen.getByText("12 tarjetas en esta sesión"),
      ).toBeInTheDocument();
      expect(getPageForRoute).not.toHaveBeenCalled();
    });

    it("never serves sample decks in production: sample ids fall through to the real lookup and 404", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");
      getPageForRoute.mockResolvedValue(null);

      await expect(
        FlashcardsSessionPage(props("biologia-celular", "membrana-celular")),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });

  describe("real deck (ungraded review list)", () => {
    beforeEach(() => {
      getPageForRoute.mockResolvedValue({ id: PAGE, title: "Mitocondria" });
      listFlashcardsAction.mockResolvedValue({
        ok: true,
        value: [card(0), card(1)],
      });
    });

    it("shows the page's real cards as flip cards, without grading, in production too", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        screen.getByRole("heading", { name: "Mitocondria" }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 tarjetas")).toBeInTheDocument();
      expect(screen.getAllByTestId("flip-card")).toHaveLength(2);
      expect(screen.getByText("Pregunta 0")).toBeInTheDocument();
      expect(screen.queryByText("Otra vez")).not.toBeInTheDocument();
      expect(getPageForRoute).toHaveBeenCalledWith(NOTEBOOK, PAGE);
      expect(listFlashcardsAction).toHaveBeenCalledWith({ pageId: PAGE });
    });

    it("answers 404 when the page is unknown, archived or another user's", async () => {
      getPageForRoute.mockResolvedValue(null);

      await expect(
        FlashcardsSessionPage(props(NOTEBOOK, PAGE)),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("answers 404 when the page has no cards: a deck is never empty", async () => {
      listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });

      await expect(
        FlashcardsSessionPage(props(NOTEBOOK, PAGE)),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("answers 404 when the cards cannot be loaded", async () => {
      listFlashcardsAction.mockResolvedValue({
        ok: false,
        error: { code: "FLASHCARDS_UNEXPECTED", message: "x" },
      });

      await expect(
        FlashcardsSessionPage(props(NOTEBOOK, PAGE)),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });
});
