import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/flashcards/nb/pg",
}));

const { listFlashcardsAction } = vi.hoisted(() => ({
  listFlashcardsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  listFlashcardsAction,
  createFlashcardAction: vi.fn(),
  archiveFlashcardAction: vi.fn(),
  startFlashcardSessionAction: vi.fn(),
  gradeFlashcardAction: vi.fn(),
  finishFlashcardSessionAction: vi.fn(),
  MAX_FLASHCARD_SIDE_LENGTH: 1000,
}));
const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getPageForRoute,
  getNotebookTitleForRoute,
}));

import FlashcardsSessionPage from "./page";

const props = (
  notebookId: string,
  pageId: string,
  search: Record<string, string> = {},
) => ({
  params: Promise.resolve({ notebookId, pageId }),
  searchParams: Promise.resolve(search),
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

  describe("real deck (review list + graded review)", () => {
    beforeEach(() => {
      getPageForRoute.mockResolvedValue({ id: PAGE, title: "Mitocondria" });
      listFlashcardsAction.mockResolvedValue({
        ok: true,
        value: [card(0), card(1)],
      });
    });

    it("shows the page's real cards as flip cards, ungraded until Repasar, in production too", async () => {
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

    it("offers Nueva tarjeta on the page deck and an archive action per card", async () => {
      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        screen.getByRole("button", { name: "Nueva tarjeta" }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Archivar tarjeta" }),
      ).toHaveLength(2);
    });

    it("starts the review right away when opened from Repasos de hoy (?repasar=1)", async () => {
      const { startFlashcardSessionAction } = await import(
        "@/modules/flashcards"
      );
      vi.mocked(startFlashcardSessionAction).mockResolvedValue({
        ok: false,
        error: { code: "STUDY_ENGINE_NOTHING_DUE", message: "x" },
      });

      render(
        await FlashcardsSessionPage(props(NOTEBOOK, PAGE, { repasar: "1" })),
      );

      expect(await screen.findByText("Estás al día")).toBeInTheDocument();
      expect(startFlashcardSessionAction).toHaveBeenCalledWith({
        pageId: PAGE,
      });
    });

    it("waits for Repasar without ?repasar=1", async () => {
      const { startFlashcardSessionAction } = await import(
        "@/modules/flashcards"
      );
      vi.mocked(startFlashcardSessionAction).mockClear();

      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(startFlashcardSessionAction).not.toHaveBeenCalled();
    });

    it("offers Repasar on a deck with cards", async () => {
      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        screen.getByRole("button", { name: /Repasar/ }),
      ).toBeInTheDocument();
    });

    it("lets a page without cards start its deck with the first card", async () => {
      listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });

      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        screen.getByRole("heading", { name: "Mitocondria" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Esta página aún no tiene tarjetas"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("flip-card")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Repasar/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Nueva tarjeta" }).length,
      ).toBeGreaterThan(0);
      expect(notFound).not.toHaveBeenCalled();
    });

    // Phase 8 H11: a technique hub's "Crear a mano" lands here with
    // ?nueva=1, which opens "Nueva tarjeta" at once for the first card.
    it("opens Nueva tarjeta at once with ?nueva=1", async () => {
      listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });

      render(
        await FlashcardsSessionPage(props(NOTEBOOK, PAGE, { nueva: "1" })),
      );

      expect(
        screen.getByRole("dialog", { name: "Nueva tarjeta" }),
      ).toBeInTheDocument();
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
