import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardView } from "@/modules/flashcards";
import { err, ok } from "@/shared/kernel/result";
import { TECHNIQUES_PANEL_COOKIE } from "../../../../../_components/techniques-panel-cookie";
import {
  TECHNIQUES_PANEL_SLOT_ID,
  TechniquesPanelSlot,
} from "../../../../../_components/techniques-panel-slot";
import { TechniquesPanel, type TechniquesPanelProps } from "./techniques-panel";

const { generateFlashcardsAction, listFlashcardsAction } = vi.hoisted(() => ({
  generateFlashcardsAction: vi.fn(),
  listFlashcardsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  generateFlashcardsAction,
  listFlashcardsAction,
}));

const NOTEBOOK_ID = "nb-1";
const PAGE_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function card(n: number): FlashcardView {
  return {
    id: `c${n}`,
    pageId: PAGE_ID,
    front: `Pregunta ${n}`,
    back: `Respuesta ${n}`,
    position: n,
  };
}

const baseProps: TechniquesPanelProps = {
  initialCollapsed: false,
  notebookId: NOTEBOOK_ID,
  pageId: PAGE_ID,
  showPreviews: true,
  initialFlashcards: [],
  initialRemaining: 6,
};

function clearCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom
  document.cookie = `${TECHNIQUES_PANEL_COOKIE}=; max-age=0; path=/`;
}

async function renderPanel(
  initialCollapsed: boolean,
  overrides: Partial<TechniquesPanelProps> = {},
) {
  const view = render(
    <>
      <TechniquesPanelSlot />
      <TechniquesPanel
        {...baseProps}
        {...overrides}
        initialCollapsed={initialCollapsed}
      />
    </>,
  );
  // The panel resolves its portal target in an effect after mount.
  await act(async () => {});
  return view;
}

describe("TechniquesPanel", () => {
  beforeEach(() => {
    clearCookie();
    generateFlashcardsAction.mockReset();
    listFlashcardsAction.mockReset();
  });

  it("portals into the layout slot, not inline", async () => {
    await renderPanel(false);

    const slot = document.getElementById(TECHNIQUES_PANEL_SLOT_ID);
    expect(slot).toContainElement(screen.getByTestId("techniques-panel"));
  });

  it("renders nothing when the slot does not exist", async () => {
    render(<TechniquesPanel {...baseProps} />);
    await act(async () => {});

    expect(screen.queryByTestId("techniques-panel")).not.toBeInTheDocument();
  });

  it("lists the three techniques with previews on: only Flashcards is live, the other two stay disabled previews", async () => {
    await renderPanel(false);

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("Active recall")).toBeInTheDocument();
    expect(screen.getByText("Examen")).toBeInTheDocument();
    expect(screen.getByTestId("generate-flashcards")).toBeEnabled();
    const generate = screen.getAllByRole("button", { name: "Generar" });
    expect(generate).toHaveLength(3);
    expect(
      generate.filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(2);
  });

  it("shows only Flashcards and no sample sections with previews off", async () => {
    await renderPanel(false, { showPreviews: false });

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.queryByText("Active recall")).not.toBeInTheDocument();
    expect(screen.queryByText("Examen")).not.toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sesiones de Active Recall"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Exámenes recientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Mitocondria")).not.toBeInTheDocument();
  });

  it("keeps the active recall and exam saved items as a labelled sample preview", async () => {
    await renderPanel(false);

    expect(screen.getByText("Generado en esta página")).toBeInTheDocument();
    expect(screen.getByText("Vista previa")).toBeInTheDocument();
    expect(screen.getByText("Sesiones de Active Recall")).toBeInTheDocument();
    expect(screen.getByText("Exámenes recientes")).toBeInTheDocument();
    // The flashcards deck is real now, never the sample one.
    expect(screen.queryByRole("link", { name: /Mitocondria/ })).toBeNull();
  });

  describe("flashcards (real data)", () => {
    it("renders the page's cards from the initial data, linking to the deck", async () => {
      await renderPanel(false, {
        initialFlashcards: [card(0), card(1)],
      });

      expect(screen.getByText("Mazo de esta página")).toBeInTheDocument();
      const items = screen.getAllByTestId("flashcard-item");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent("Pregunta 0");
      expect(items[0]).toHaveAttribute("title", "Respuesta 0");
      expect(items[0]).toHaveAttribute(
        "href",
        expect.stringContaining(`/flashcards/${NOTEBOOK_ID}/${PAGE_ID}`),
      );
    });

    it("shows an empty state when the page has no cards yet", async () => {
      await renderPanel(false);

      expect(screen.queryByTestId("flashcard-item")).not.toBeInTheDocument();
      expect(
        screen.getByText("Aún no hay tarjetas en esta página"),
      ).toBeInTheDocument();
    });

    it("shows the remaining generations from the status", async () => {
      await renderPanel(false, { initialRemaining: 4 });

      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Te quedan 4 generaciones hoy",
      );
    });

    it("uses the singular for one remaining generation", async () => {
      await renderPanel(false, { initialRemaining: 1 });

      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Te queda 1 generación hoy",
      );
    });

    it("hides the counter when the status is unknown and keeps Generar enabled", async () => {
      await renderPanel(false, { initialRemaining: null });

      expect(
        screen.queryByTestId("generation-remaining"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("generate-flashcards")).toBeEnabled();
    });

    it("disables Generar and says so when no generations remain", async () => {
      await renderPanel(false, { initialRemaining: 0 });

      expect(screen.getByTestId("generate-flashcards")).toBeDisabled();
      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Llegaste al límite de hoy. Vuelve mañana.",
      );
    });

    it("generates for the page, shows pending, then refreshes the list and the counter", async () => {
      const user = userEvent.setup();
      let resolveGenerate: (value: unknown) => void = () => {};
      generateFlashcardsAction.mockReturnValue(
        new Promise((resolve) => {
          resolveGenerate = resolve;
        }),
      );
      listFlashcardsAction.mockResolvedValue(ok([card(0), card(1), card(2)]));
      await renderPanel(false, { initialRemaining: 4 });

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(generateFlashcardsAction).toHaveBeenCalledWith({
        pageId: PAGE_ID,
      });
      const pending = screen.getByTestId("generate-flashcards");
      expect(pending).toBeDisabled();
      expect(pending).toHaveTextContent("Generando…");

      await act(async () => {
        resolveGenerate(
          ok({
            cards: [card(0), card(1), card(2)],
            remainingToday: 3,
            truncated: false,
            wordsUsed: 10,
            wordsTotal: 10,
          }),
        );
      });

      expect(listFlashcardsAction).toHaveBeenCalledWith({ pageId: PAGE_ID });
      expect(screen.getAllByTestId("flashcard-item")).toHaveLength(3);
      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Te quedan 3 generaciones hoy",
      );
      expect(screen.getByTestId("generate-flashcards")).toBeEnabled();
      expect(screen.queryByTestId("generation-notice")).not.toBeInTheDocument();
      expect(screen.queryByTestId("generation-error")).not.toBeInTheDocument();
    });

    it("falls back to the generated cards when refreshing the list fails", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValue(
        ok({
          cards: [card(0)],
          remainingToday: 2,
          truncated: false,
          wordsUsed: 5,
          wordsTotal: 5,
        }),
      );
      listFlashcardsAction.mockResolvedValue(
        err({ code: "FLASHCARDS_UNEXPECTED", message: "x" }),
      );
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(await screen.findAllByTestId("flashcard-item")).toHaveLength(1);
    });

    it("tells the student how many words were used when the page was truncated", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValue(
        ok({
          cards: [card(0)],
          remainingToday: 2,
          truncated: true,
          wordsUsed: 9000,
          wordsTotal: 15000,
        }),
      );
      listFlashcardsAction.mockResolvedValue(ok([card(0)]));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(await screen.findByTestId("generation-notice")).toHaveTextContent(
        "Se usaron las primeras 9000 palabras de la página",
      );
    });

    it.each([
      ["AI_DAILY_LIMIT_REACHED", "Llegaste al límite de hoy. Vuelve mañana."],
      ["AI_PAGE_EMPTY", "La página está vacía: escribe algo antes de generar."],
      [
        "AI_GENERATION_FAILED",
        "No pudimos generar las tarjetas. Intenta de nuevo.",
      ],
      [
        "FLASHCARDS_UNEXPECTED",
        "No pudimos generar las tarjetas. Intenta de nuevo.",
      ],
      ["PAGE_NOT_FOUND", "No pudimos generar las tarjetas. Intenta de nuevo."],
      [
        "FLASHCARDS_SESSION_REQUIRED",
        "Tu sesión expiró. Inicia sesión de nuevo.",
      ],
    ])("maps %s to its Spanish message", async (code, message) => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValue(err({ code, message: "x" }));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(await screen.findByTestId("generation-error")).toHaveTextContent(
        message,
      );
      expect(listFlashcardsAction).not.toHaveBeenCalled();
    });

    it("zeroes the counter when the daily limit is reached", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValue(
        err({ code: "AI_DAILY_LIMIT_REACHED", message: "x" }),
      );
      await renderPanel(false, { initialRemaining: 1 });

      await user.click(screen.getByTestId("generate-flashcards"));

      await within(screen.getByTestId("techniques-panel")).findByText(
        "Llegaste al límite de hoy. Vuelve mañana.",
        { selector: "[data-testid=generation-remaining]" },
      );
      expect(screen.getByTestId("generate-flashcards")).toBeDisabled();
    });

    it("clears the previous error and notice on the next attempt", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValueOnce(
        err({ code: "AI_GENERATION_FAILED", message: "x" }),
      );
      await renderPanel(false);
      await user.click(screen.getByTestId("generate-flashcards"));
      await screen.findByTestId("generation-error");

      generateFlashcardsAction.mockResolvedValueOnce(
        ok({
          cards: [card(0)],
          remainingToday: 1,
          truncated: false,
          wordsUsed: 3,
          wordsTotal: 3,
        }),
      );
      listFlashcardsAction.mockResolvedValue(ok([card(0)]));
      await user.click(screen.getByTestId("generate-flashcards"));

      await screen.findAllByTestId("flashcard-item");
      expect(screen.queryByTestId("generation-error")).not.toBeInTheDocument();
    });

    it("reports an unexpected rejection instead of throwing", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockRejectedValue(new Error("network"));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(await screen.findByTestId("generation-error")).toHaveTextContent(
        "No pudimos generar las tarjetas. Intenta de nuevo.",
      );
    });
  });

  it("starts collapsed from the server-read cookie and offers to expand", async () => {
    await renderPanel(true);

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Expandir panel de técnicas" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Generar")).not.toBeInTheDocument();
    expect(screen.queryByText("Mazo de esta página")).not.toBeInTheDocument();
  });

  it("collapses on click and persists the choice in a cookie", async () => {
    const user = userEvent.setup();
    await renderPanel(false);

    await user.click(
      screen.getByRole("button", { name: "Colapsar panel de técnicas" }),
    );

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(document.cookie).toContain(`${TECHNIQUES_PANEL_COOKIE}=collapsed`);
  });

  it("expands again and persists 'expanded'", async () => {
    const user = userEvent.setup();
    await renderPanel(true);

    await user.click(
      screen.getByRole("button", { name: "Expandir panel de técnicas" }),
    );

    expect(screen.getByTestId("techniques-panel")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(document.cookie).toContain(`${TECHNIQUES_PANEL_COOKIE}=expanded`);
  });
});

describe("TechniquesPanelSlot", () => {
  it("renders an empty display:contents box so it takes no layout space", () => {
    const { container } = render(<TechniquesPanelSlot />);

    const slot = container.firstElementChild as HTMLElement;
    expect(slot.id).toBe(TECHNIQUES_PANEL_SLOT_ID);
    expect(slot).toHaveClass("contents");
    expect(slot).toBeEmptyDOMElement();
  });
});
