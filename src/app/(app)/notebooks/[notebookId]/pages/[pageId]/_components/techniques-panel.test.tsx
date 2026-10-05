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
const { generateExamQuestionsAction, getExamStartAction } = vi.hoisted(() => ({
  generateExamQuestionsAction: vi.fn(),
  getExamStartAction: vi.fn(),
}));
vi.mock("@/modules/exams", () => ({
  EXAM_DEFAULT_QUESTIONS: 10,
  EXAM_MAX_QUESTIONS: 30,
  EXAM_MIN_QUESTIONS: 10,
  generateExamQuestionsAction,
  getExamStartAction,
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
    generateExamQuestionsAction.mockReset();
    getExamStartAction.mockReset();
    getExamStartAction.mockResolvedValue(
      ok({
        activeQuestionCount: 0,
        retakePending: false,
        failedRootCount: 0,
        openSessionId: null,
        openRetakeSessionId: null,
        lastFinishedSessionId: null,
      }),
    );
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

  it("lists the three techniques with previews on: Flashcards and Examen are live, Active recall stays a disabled preview", async () => {
    await renderPanel(false);

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("Active recall")).toBeInTheDocument();
    expect(screen.getByText("Examen")).toBeInTheDocument();
    expect(screen.getByTestId("generate-flashcards")).toBeEnabled();
    expect(screen.getByTestId("generate-exam-questions")).toBeEnabled();
    const generate = screen.getAllByRole("button", { name: "Generar" });
    expect(generate).toHaveLength(3);
    expect(
      generate.filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(1);
  });

  it("shows Flashcards and Examen but no Active recall or sample sections with previews off", async () => {
    await renderPanel(false, { showPreviews: false });

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.queryByText("Active recall")).not.toBeInTheDocument();
    expect(screen.getByText("Examen")).toBeInTheDocument();
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sesiones de Active Recall"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Exámenes recientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Mitocondria")).not.toBeInTheDocument();
  });

  it("links the Examen card to the page's questions, with both Generar live", async () => {
    await renderPanel(false, { showPreviews: false });

    expect(screen.getByTestId("exam-questions-link")).toHaveAttribute(
      "href",
      `/exams/${NOTEBOOK_ID}/${PAGE_ID}/preguntas`,
    );
    expect(screen.getByTestId("exam-questions-link")).toHaveTextContent(
      "Preguntas",
    );
    const generate = screen.getAllByRole("button", { name: "Generar" });
    expect(generate).toHaveLength(2);
    expect(
      generate.filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(0);
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

  describe("Rendir examen (exam card)", () => {
    function start(
      activeQuestionCount: number,
      retakePending = false,
      failedRootCount = retakePending ? 4 : 0,
    ) {
      getExamStartAction.mockResolvedValue(
        ok({
          activeQuestionCount,
          retakePending,
          failedRootCount,
          openSessionId: null,
          openRetakeSessionId: null,
          lastFinishedSessionId: null,
        }),
      );
    }

    it("links to the page's exam once the page has 10 questions", async () => {
      start(12);
      await renderPanel(false);

      const link = await screen.findByRole("link", { name: /Rendir examen/ });
      expect(link).toHaveAttribute("href", `/exams/${NOTEBOOK_ID}/${PAGE_ID}`);
      expect(getExamStartAction).toHaveBeenCalledWith({ pageId: PAGE_ID });
    });

    it("is disabled with the 10-question note below 10 questions", async () => {
      start(4);
      await renderPanel(false);

      expect(
        await screen.findByText(
          "Necesitas al menos 10 preguntas para rendir un examen.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("take-exam-button")).toBeDisabled();
    });

    it("offers the retake instead of a normal exam while one is pending", async () => {
      start(12, true);
      await renderPanel(false);

      const retake = await screen.findByTestId("retake-exam-button");
      expect(retake).toHaveTextContent("Repetir examen");
      expect(retake).toHaveAttribute(
        "href",
        `/exams/${NOTEBOOK_ID}/${PAGE_ID}`,
      );
      expect(screen.getByTestId("exam-retake-note")).toHaveTextContent(
        "4 conceptos",
      );
      expect(
        screen.queryByRole("link", { name: /Rendir examen/ }),
      ).not.toBeInTheDocument();
    });

    it("asks for more questions instead of a retake that cannot reach 10", async () => {
      start(9, true);
      await renderPanel(false);

      expect(
        await screen.findByTestId("exam-retake-needs-questions"),
      ).toHaveTextContent("Agrega o genera preguntas para repetir el examen.");
      expect(
        screen.queryByTestId("retake-exam-button"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("generate-exam-questions")).toBeInTheDocument();
    });

    it("points to the exam to continue when every failed question was retired", async () => {
      start(12, true, 0);
      await renderPanel(false);

      const retake = await screen.findByTestId("retake-exam-button");
      expect(retake).toHaveTextContent("Continuar");
      expect(retake).toHaveAttribute(
        "href",
        `/exams/${NOTEBOOK_ID}/${PAGE_ID}`,
      );
      expect(screen.getByTestId("exam-retake-note")).toHaveTextContent(
        "Retiraste las preguntas que fallaste",
      );
    });

    it("re-reads the question count after a generation", async () => {
      start(0);
      generateExamQuestionsAction.mockResolvedValue(
        ok({
          questions: [],
          created: 10,
          skipped: 0,
          remainingToday: 5,
          truncated: false,
          wordsUsed: 10,
          wordsTotal: 10,
        }),
      );
      const user = userEvent.setup();
      await renderPanel(false);
      await screen.findByTestId("take-exam-button");
      start(10);

      await user.click(screen.getByTestId("generate-exam-questions"));

      expect(
        await screen.findByRole("link", { name: /Rendir examen/ }),
      ).toBeInTheDocument();
    });
  });

  describe("exam questions (real data)", () => {
    function generated(created: number, skipped = 0, truncated = false) {
      return ok({
        questions: [],
        created,
        skipped,
        remainingToday: 3,
        truncated,
        wordsUsed: 40,
        wordsTotal: 90,
      });
    }

    it("offers 10 to 30 questions in steps of 5, starting at 10", async () => {
      const user = userEvent.setup();
      await renderPanel(false, { showPreviews: false });

      const count = screen.getByRole("group", {
        name: "Preguntas a generar",
      });
      expect(screen.getByTestId("exam-count-value")).toHaveTextContent("10");
      await user.click(
        within(count).getByRole("button", { name: "Más preguntas a generar" }),
      );
      expect(screen.getByTestId("exam-count-value")).toHaveTextContent("15");
    });

    it("generates the chosen count for the page, shows pending, then the created count and the counter", async () => {
      const user = userEvent.setup();
      let resolve: (value: unknown) => void = () => {};
      generateExamQuestionsAction.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      await renderPanel(false, { initialRemaining: 4 });

      await user.click(
        screen.getByRole("button", { name: "Más preguntas a generar" }),
      );
      await user.click(screen.getByTestId("generate-exam-questions"));

      expect(generateExamQuestionsAction).toHaveBeenCalledWith({
        pageId: PAGE_ID,
        count: 15,
      });
      expect(screen.getByTestId("generate-exam-questions")).toHaveTextContent(
        "Generando…",
      );
      await act(async () => resolve(generated(15)));

      expect(
        await screen.findByTestId("exam-generation-notice"),
      ).toHaveTextContent("Se generaron 15 preguntas.");
      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Te quedan 3 generaciones hoy",
      );
    });

    it("says how many generated questions were discarded and when the page was truncated", async () => {
      const user = userEvent.setup();
      generateExamQuestionsAction.mockResolvedValue(generated(9, 1, true));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-exam-questions"));

      expect(
        await screen.findByTestId("exam-generation-notice"),
      ).toHaveTextContent(
        "Se generaron 9 preguntas. 1 se descartó por repetida o inválida. Se usaron las primeras 40 palabras de la página.",
      );
    });

    it.each([
      ["AI_DAILY_LIMIT_REACHED", "Llegaste al límite de hoy. Vuelve mañana."],
      ["AI_PAGE_EMPTY", "La página está vacía: escribe algo antes de generar."],
      [
        "AI_GENERATION_FAILED",
        "No pudimos generar las preguntas. Intenta de nuevo.",
      ],
    ])("maps %s to its message", async (code, message) => {
      const user = userEvent.setup();
      generateExamQuestionsAction.mockResolvedValue(
        err({ code, message: "x" }),
      );
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-exam-questions"));

      expect(
        await screen.findByTestId("exam-generation-error"),
      ).toHaveTextContent(message);
    });

    it("zeroes the shared counter on the daily limit, disabling both Generar", async () => {
      const user = userEvent.setup();
      generateExamQuestionsAction.mockResolvedValue(
        err({ code: "AI_DAILY_LIMIT_REACHED", message: "x" }),
      );
      await renderPanel(false, { initialRemaining: 2 });

      await user.click(screen.getByTestId("generate-exam-questions"));

      await screen.findByTestId("exam-generation-error");
      expect(screen.getByTestId("generate-exam-questions")).toBeDisabled();
      expect(screen.getByTestId("generate-flashcards")).toBeDisabled();
    });

    it("explains a disabled Generar when no generations remain", async () => {
      await renderPanel(false, { initialRemaining: 0 });

      expect(screen.getByTestId("generate-exam-questions")).toBeDisabled();
      expect(screen.getByTestId("exam-generation-limit")).toHaveTextContent(
        "Llegaste al límite de hoy. Vuelve mañana.",
      );
    });

    it("reports an unexpected rejection instead of throwing", async () => {
      const user = userEvent.setup();
      generateExamQuestionsAction.mockRejectedValue(new Error("network"));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-exam-questions"));

      expect(
        await screen.findByTestId("exam-generation-error"),
      ).toHaveTextContent(
        "No pudimos generar las preguntas. Intenta de nuevo.",
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
