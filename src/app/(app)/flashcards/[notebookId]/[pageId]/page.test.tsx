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

const { listFlashcardsAction, listDecksAction } = vi.hoisted(() => ({
  listFlashcardsAction: vi.fn(),
  listDecksAction: vi.fn(),
}));
vi.mock("@/modules/identity", () => ({
  getCurrentTimeZoneSetting: vi.fn(async () => ({ timeZone: "UTC" })),
}));
vi.mock("@/modules/flashcards", () => ({
  listFlashcardsAction,
  listDecksAction,
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

  describe("real deck (direct practice)", () => {
    beforeEach(() => {
      listDecksAction.mockResolvedValue({ ok: true, value: [] });
      getPageForRoute.mockResolvedValue({ id: PAGE, title: "Mitocondria" });
      listFlashcardsAction.mockResolvedValue({
        ok: true,
        value: [card(0), card(1)],
      });
    });

    // Phase 8 H18 (user 2026-10-29): opening a deck practises it; the
    // cards are listed and edited on the edit page, not here.
    it("lists no cards and starts the graded review at once, in production too", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");
      const { startFlashcardSessionAction } = await import(
        "@/modules/flashcards"
      );
      vi.mocked(startFlashcardSessionAction).mockReset();
      vi.mocked(startFlashcardSessionAction).mockResolvedValue({
        ok: true,
        value: {
          sessionId: "7c1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6",
          cards: [
            {
              itemId: "i0",
              flashcardId: "c0",
              front: "Pregunta 0",
              back: "Respuesta 0",
              nextIntervalDays: { again: 1, hard: 1, good: 1, easy: 4 },
            },
          ],
        },
      });

      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(await screen.findByTestId("flashcard-player")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Archivar tarjeta" }),
      ).toBeNull();
      expect(startFlashcardSessionAction).toHaveBeenCalledWith({
        pageId: PAGE,
      });
      expect(getPageForRoute).toHaveBeenCalledWith(NOTEBOOK, PAGE);
      expect(listFlashcardsAction).toHaveBeenCalledWith({ pageId: PAGE });
    });

    it("answers 404 when the page is unknown, archived or another user's", async () => {
      getPageForRoute.mockResolvedValue(null);

      await expect(
        FlashcardsSessionPage(props(NOTEBOOK, PAGE)),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("says the deck is up to date, with its next review, when nothing is due", async () => {
      const { startFlashcardSessionAction } = await import(
        "@/modules/flashcards"
      );
      vi.mocked(startFlashcardSessionAction).mockResolvedValue({
        ok: false,
        error: { code: "STUDY_ENGINE_NOTHING_DUE", message: "x" },
      });
      listDecksAction.mockResolvedValue({
        ok: true,
        value: [
          {
            pageId: PAGE,
            nextDueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          },
        ],
      });

      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        await screen.findByText("Estás al día con este mazo"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Tu próximo repaso es en 3 días/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Repasar igual" }),
      ).toBeInTheDocument();
    });

    it("practises at once with ?modo=practica, starting no session", async () => {
      const { startFlashcardSessionAction } = await import(
        "@/modules/flashcards"
      );
      vi.mocked(startFlashcardSessionAction).mockClear();

      render(
        await FlashcardsSessionPage(
          props(NOTEBOOK, PAGE, { modo: "practica" }),
        ),
      );

      expect(await screen.findByTestId("flashcard-player")).toBeInTheDocument();
      expect(screen.getByText("Modo práctica")).toBeInTheDocument();
      expect(startFlashcardSessionAction).not.toHaveBeenCalled();
    });

    it("offers Repasar on a deck with cards", async () => {
      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(
        screen.getByRole("button", { name: /Repasar/ }),
      ).toBeInTheDocument();
    });

    it("sends a page without cards to its techniques panel to generate them", async () => {
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
      expect(screen.queryByText("Nueva tarjeta")).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Generar desde la página" }),
      ).toHaveAttribute("href", `/notebooks/${NOTEBOOK}/pages/${PAGE}`);
      expect(notFound).not.toHaveBeenCalled();
    });

    // Phase 8 H17: no notebook level. Back leads to the hub, filtered by
    // the deck's notebook, or as the hub was (?desde=hub&cuaderno=).
    it("leads back to the hub filtered by the notebook by default", async () => {
      render(await FlashcardsSessionPage(props(NOTEBOOK, PAGE)));

      expect(screen.getByRole("link", { name: /Flashcards/ })).toHaveAttribute(
        "href",
        `/flashcards?cuaderno=${NOTEBOOK}`,
      );
    });

    it("leads back to the hub as it was when opened from it", async () => {
      const OTHER = "2b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
      render(
        await FlashcardsSessionPage(
          props(NOTEBOOK, PAGE, { desde: "hub", cuaderno: OTHER }),
        ),
      );
      expect(screen.getByRole("link", { name: /Flashcards/ })).toHaveAttribute(
        "href",
        `/flashcards?cuaderno=${OTHER}`,
      );
    });

    // Phase 8 H12 removed the H11 `?nueva=1` auto-open; H13 removed manual
    // creation altogether, so the flag opens nothing.
    it("opens no dialog with ?nueva=1", async () => {
      listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });

      render(
        await FlashcardsSessionPage(props(NOTEBOOK, PAGE, { nueva: "1" })),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
