import { act, render, screen, waitFor, within } from "@testing-library/react";
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

const { generateRecallQuestionsAction, getRecallPageSummaryAction } =
  vi.hoisted(() => ({
    generateRecallQuestionsAction: vi.fn(),
    getRecallPageSummaryAction: vi.fn(),
  }));
vi.mock("@/modules/active-recall", () => ({
  generateRecallQuestionsAction,
  getRecallPageSummaryAction,
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
  initialFlashcards: [],
  initialRecallQuestionCount: 0,
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

async function generateExamViaDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("generate-exam-questions"));
  await user.click(screen.getByTestId("confirm-exam-generation"));
}

async function waitForText(testId: string, text: string) {
  await waitFor(() =>
    expect(screen.getByTestId(testId)).toHaveTextContent(text),
  );
}

describe("TechniquesPanel", () => {
  beforeEach(() => {
    clearCookie();
    generateFlashcardsAction.mockReset();
    listFlashcardsAction.mockReset();
    generateExamQuestionsAction.mockReset();
    getExamStartAction.mockReset();
    generateRecallQuestionsAction.mockReset();
    getRecallPageSummaryAction.mockReset();
    getRecallPageSummaryAction.mockResolvedValue(ok({ questionCount: 0 }));
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

  it("shows the 'Técnicas de estudio' header and the three techniques, all three Generar live", async () => {
    await renderPanel(false);

    expect(screen.getByText("Técnicas de estudio")).toBeInTheDocument();
    expect(
      screen.getByText("Genera contenido de estudio con IA"),
    ).toBeInTheDocument();
    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("Recordación activa")).toBeInTheDocument();
    expect(screen.getByText("Examen")).toBeInTheDocument();
    expect(screen.getByTestId("generate-flashcards")).toBeEnabled();
    expect(screen.getByTestId("generate-recall-questions")).toBeEnabled();
    expect(screen.getByTestId("generate-exam-questions")).toBeEnabled();
    const generate = screen.getAllByRole("button", { name: "Generar" });
    expect(generate).toHaveLength(3);
    expect(
      generate.filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(0);
  });

  it("colours each Generar with its technique: Flashcards yellow, Recordación activa green, Examen red", async () => {
    await renderPanel(false);

    expect(screen.getByTestId("generate-flashcards")).toHaveClass(
      "bg-pastel-yellow",
      "text-pastel-yellow-fg",
    );
    expect(screen.getByTestId("generate-recall-questions")).toHaveClass(
      "bg-pastel-mint",
      "text-pastel-mint-fg",
    );
    expect(screen.getByTestId("generate-exam-questions")).toHaveClass(
      "bg-pastel-pink",
      "text-pastel-pink-fg",
    );
  });

  it("shows every collapsed technique icon as available", async () => {
    await renderPanel(true);

    for (const title of ["Flashcards", "Recordación activa", "Examen"]) {
      expect(screen.getByTitle(title)).not.toHaveClass("opacity-35");
    }
  });

  it("has no practice buttons or deck links inside the cards and no sample items", async () => {
    getExamStartAction.mockResolvedValue(
      ok({
        activeQuestionCount: 12,
        retakePending: true,
        failedRootCount: 4,
        openSessionId: null,
        openRetakeSessionId: null,
        lastFinishedSessionId: null,
      }),
    );
    await renderPanel(false, {
      initialFlashcards: [card(0), card(1)],
      initialRecallQuestionCount: 10,
    });
    await screen.findByTestId("generated-item-exam");

    for (const id of [
      "take-exam-button",
      "retake-exam-button",
      "exam-retake-note",
      "flashcard-item",
      "flashcard-deck-link",
      "practice-recall-link",
    ]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Vista previa")).not.toBeInTheDocument();
    expect(screen.queryByText("Mitocondria")).not.toBeInTheDocument();
  });

  it("keeps the three cards alike: no Preguntas link and no inline question count", async () => {
    await renderPanel(false);

    expect(screen.queryByTestId("exam-questions-link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Preguntas a generar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the same remaining-generations line under each card", async () => {
    await renderPanel(false, { initialRemaining: 4 });

    for (const id of [
      "generation-remaining",
      "recall-generation-remaining",
      "exam-generation-remaining",
    ]) {
      expect(screen.getByTestId(id)).toHaveTextContent(
        "Te quedan 4 generaciones hoy",
      );
    }
  });

  it("hides every remaining line when the status is unknown", async () => {
    await renderPanel(false, { initialRemaining: null });

    expect(screen.queryByText(/generaciones hoy/)).not.toBeInTheDocument();
  });

  describe("generated items list", () => {
    function examStart(
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

    it("shows an empty state under its label when nothing was generated", async () => {
      await renderPanel(false);

      expect(screen.getByText("Generado en esta página")).toBeInTheDocument();
      expect(
        screen.getByText("Aún no generaste nada en esta página"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Flashcards/ })).toBeNull();
    });

    it("lists one row per generated technique, in panel order, each opening its practice route", async () => {
      examStart(12);
      await renderPanel(false, {
        initialFlashcards: [card(0), card(1), card(2)],
        initialRecallQuestionCount: 10,
      });

      const exam = await screen.findByTestId("generated-item-exam");
      const flashcards = screen.getByTestId("generated-item-flashcards");
      const recall = screen.getByTestId("generated-item-active-recall");
      expect(flashcards).toHaveTextContent("Flashcards");
      expect(flashcards).toHaveTextContent("3 tarjetas");
      expect(flashcards).toHaveAttribute(
        "href",
        `/flashcards/${NOTEBOOK_ID}/${PAGE_ID}?repasar=1`,
      );
      expect(recall).toHaveTextContent("Recordación activa");
      expect(recall).toHaveTextContent("10 preguntas");
      expect(recall).toHaveAttribute(
        "href",
        `/active-recall/${NOTEBOOK_ID}/${PAGE_ID}`,
      );
      expect(exam).toHaveTextContent("Examen");
      expect(exam).toHaveTextContent("12 preguntas");
      expect(exam).toHaveAttribute("href", `/exams/${NOTEBOOK_ID}/${PAGE_ID}`);
      expect(
        screen
          .getAllByRole("link")
          .filter((l) => l.dataset.testid?.startsWith("generated-item-"))
          .map((l) => l.dataset.testid),
      ).toEqual([
        "generated-item-flashcards",
        "generated-item-active-recall",
        "generated-item-exam",
      ]);
      expect(
        screen.queryByText("Aún no generaste nada en esta página"),
      ).not.toBeInTheDocument();
    });

    it("uses the singular for one card or one question", async () => {
      examStart(1);
      await renderPanel(false, {
        initialFlashcards: [card(0)],
        initialRecallQuestionCount: 1,
      });

      expect(
        await screen.findByTestId("generated-item-exam"),
      ).toHaveTextContent("1 pregunta");
      expect(screen.getByTestId("generated-item-flashcards")).toHaveTextContent(
        "1 tarjeta",
      );
      expect(
        screen.getByTestId("generated-item-active-recall"),
      ).toHaveTextContent("1 pregunta");
    });

    it("notes a pending retake on the exam row, which opens the exam route that runs it", async () => {
      examStart(12, true);
      await renderPanel(false);

      const exam = await screen.findByTestId("generated-item-exam");
      expect(exam).toHaveTextContent("12 preguntas · Repetición pendiente");
      expect(exam).toHaveAttribute("href", `/exams/${NOTEBOOK_ID}/${PAGE_ID}`);
    });

    it("reads the exam state for the page and shows no exam row when it fails", async () => {
      getExamStartAction.mockRejectedValue(new Error("offline"));
      await renderPanel(false);
      await act(async () => {});

      expect(getExamStartAction).toHaveBeenCalledWith({ pageId: PAGE_ID });
      expect(
        screen.queryByTestId("generated-item-exam"),
      ).not.toBeInTheDocument();
    });

    it("adds the Flashcards row after a generation", async () => {
      const user = userEvent.setup();
      generateFlashcardsAction.mockResolvedValue(
        ok({
          cards: [card(0), card(1)],
          remainingToday: 3,
          truncated: false,
          wordsUsed: 10,
          wordsTotal: 10,
        }),
      );
      listFlashcardsAction.mockResolvedValue(ok([card(0), card(1)]));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-flashcards"));

      expect(
        await screen.findByTestId("generated-item-flashcards"),
      ).toHaveTextContent("2 tarjetas");
    });

    it("adds the Examen row after a generation", async () => {
      const user = userEvent.setup();
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
      await renderPanel(false);
      await act(async () => {});
      expect(
        screen.queryByTestId("generated-item-exam"),
      ).not.toBeInTheDocument();
      examStart(10);

      await generateExamViaDialog(user);

      expect(
        await screen.findByTestId("generated-item-exam"),
      ).toHaveTextContent("10 preguntas");
    });

    it("re-reads the recall summary after a generation and adds its row", async () => {
      const user = userEvent.setup();
      generateRecallQuestionsAction.mockResolvedValue(
        ok({
          questions: [],
          created: 10,
          remainingToday: 3,
          truncated: false,
          wordsUsed: 10,
          wordsTotal: 10,
        }),
      );
      getRecallPageSummaryAction.mockResolvedValue(ok({ questionCount: 20 }));
      await renderPanel(false, { initialRecallQuestionCount: 10 });

      await user.click(screen.getByTestId("generate-recall-questions"));

      await waitForText("generated-item-active-recall", "20 preguntas");
      expect(getRecallPageSummaryAction).toHaveBeenCalledWith({
        pageId: PAGE_ID,
      });
    });

    it("keeps the previous recall row when re-reading the summary fails", async () => {
      const user = userEvent.setup();
      generateRecallQuestionsAction.mockResolvedValue(
        ok({
          questions: [],
          created: 10,
          remainingToday: 3,
          truncated: false,
          wordsUsed: 10,
          wordsTotal: 10,
        }),
      );
      getRecallPageSummaryAction.mockRejectedValue(new Error("offline"));
      await renderPanel(false, { initialRecallQuestionCount: 10 });

      await user.click(screen.getByTestId("generate-recall-questions"));

      await screen.findByTestId("recall-generation-notice");
      expect(
        screen.getByTestId("generated-item-active-recall"),
      ).toHaveTextContent("10 preguntas");
    });
  });

  describe("flashcards (real data)", () => {
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
      expect(screen.getByTestId("generated-item-flashcards")).toHaveTextContent(
        "3 tarjetas",
      );
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

      expect(
        await screen.findByTestId("generated-item-flashcards"),
      ).toHaveTextContent("1 tarjeta");
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

      await screen.findByTestId("generated-item-flashcards");
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

    it("opens a dialog with the question count (10 to 30 in steps of 5, from 10) instead of generating", async () => {
      const user = userEvent.setup();
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-exam-questions"));

      const dialog = screen.getByRole("dialog", {
        name: "Generar preguntas de examen",
      });
      expect(generateExamQuestionsAction).not.toHaveBeenCalled();
      const count = within(dialog).getByRole("group", {
        name: "Preguntas a generar",
      });
      expect(within(dialog).getByTestId("exam-count-value")).toHaveTextContent(
        "10",
      );
      expect(
        within(count).getByRole("button", {
          name: "Menos preguntas a generar",
        }),
      ).toBeDisabled();
      for (const expected of ["15", "20", "25", "30"]) {
        await user.click(
          within(count).getByRole("button", {
            name: "Más preguntas a generar",
          }),
        );
        expect(
          within(dialog).getByTestId("exam-count-value"),
        ).toHaveTextContent(expected);
      }
      expect(
        within(count).getByRole("button", { name: "Más preguntas a generar" }),
      ).toBeDisabled();
    });

    it("closes the dialog on Cancelar without generating", async () => {
      const user = userEvent.setup();
      await renderPanel(false);
      await user.click(screen.getByTestId("generate-exam-questions"));

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(generateExamQuestionsAction).not.toHaveBeenCalled();
    });

    it("keeps the chosen count the next time the dialog opens", async () => {
      const user = userEvent.setup();
      await renderPanel(false);
      await user.click(screen.getByTestId("generate-exam-questions"));
      await user.click(
        screen.getByRole("button", { name: "Más preguntas a generar" }),
      );
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      await user.click(screen.getByTestId("generate-exam-questions"));

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

      await user.click(screen.getByTestId("generate-exam-questions"));
      await user.click(
        screen.getByRole("button", { name: "Más preguntas a generar" }),
      );
      await user.click(screen.getByTestId("confirm-exam-generation"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

      await generateExamViaDialog(user);

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

      await generateExamViaDialog(user);

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

      await generateExamViaDialog(user);

      await screen.findByTestId("exam-generation-error");
      expect(screen.getByTestId("generate-exam-questions")).toBeDisabled();
      expect(screen.getByTestId("generate-flashcards")).toBeDisabled();
    });

    it("explains a disabled Generar when no generations remain", async () => {
      await renderPanel(false, { initialRemaining: 0 });

      expect(screen.getByTestId("generate-exam-questions")).toBeDisabled();
      expect(screen.getByTestId("exam-generation-remaining")).toHaveTextContent(
        "Llegaste al límite de hoy. Vuelve mañana.",
      );
    });

    it("reports an unexpected rejection instead of throwing", async () => {
      const user = userEvent.setup();
      generateExamQuestionsAction.mockRejectedValue(new Error("network"));
      await renderPanel(false);

      await generateExamViaDialog(user);

      expect(
        await screen.findByTestId("exam-generation-error"),
      ).toHaveTextContent(
        "No pudimos generar las preguntas. Intenta de nuevo.",
      );
    });
  });

  describe("active recall questions (real data)", () => {
    function generated(created: number, truncated = false) {
      return ok({
        questions: [],
        created,
        skipped: 0,
        remainingToday: 3,
        truncated,
        wordsUsed: 40,
        wordsTotal: 90,
      });
    }

    it("generates questions for the page, shows pending, then the created count and the counter", async () => {
      const user = userEvent.setup();
      let resolve: (value: unknown) => void = () => {};
      generateRecallQuestionsAction.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      await renderPanel(false, { initialRemaining: 4 });

      await user.click(screen.getByTestId("generate-recall-questions"));

      expect(generateRecallQuestionsAction).toHaveBeenCalledWith({
        pageId: PAGE_ID,
      });
      expect(screen.getByTestId("generate-recall-questions")).toHaveTextContent(
        "Generando…",
      );
      expect(screen.getByTestId("generate-recall-questions")).toBeDisabled();
      await act(async () => resolve(generated(10)));

      expect(
        await screen.findByTestId("recall-generation-notice"),
      ).toHaveTextContent("Se generaron 10 preguntas.");
      expect(screen.getByTestId("generation-remaining")).toHaveTextContent(
        "Te quedan 3 generaciones hoy",
      );
      expect(screen.getByTestId("generate-recall-questions")).toHaveTextContent(
        "Generar",
      );
    });

    it("says when the page was truncated", async () => {
      const user = userEvent.setup();
      generateRecallQuestionsAction.mockResolvedValue(generated(1, true));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-recall-questions"));

      expect(
        await screen.findByTestId("recall-generation-notice"),
      ).toHaveTextContent(
        "Se generó 1 pregunta. Se usaron las primeras 40 palabras de la página.",
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
      generateRecallQuestionsAction.mockResolvedValue(
        err({ code, message: "x" }),
      );
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-recall-questions"));

      const alert = await screen.findByTestId("recall-generation-error");
      expect(alert).toHaveTextContent(message);
      expect(alert).toHaveAttribute("role", "alert");
    });

    it("zeroes the shared counter on the daily limit, disabling every Generar", async () => {
      const user = userEvent.setup();
      generateRecallQuestionsAction.mockResolvedValue(
        err({ code: "AI_DAILY_LIMIT_REACHED", message: "x" }),
      );
      await renderPanel(false, { initialRemaining: 2 });

      await user.click(screen.getByTestId("generate-recall-questions"));

      await screen.findByTestId("recall-generation-error");
      expect(screen.getByTestId("generate-recall-questions")).toBeDisabled();
      expect(screen.getByTestId("generate-exam-questions")).toBeDisabled();
      expect(screen.getByTestId("generate-flashcards")).toBeDisabled();
    });

    it("explains a disabled Generar when no generations remain", async () => {
      await renderPanel(false, { initialRemaining: 0 });

      expect(screen.getByTestId("generate-recall-questions")).toBeDisabled();
      expect(
        screen.getByTestId("recall-generation-remaining"),
      ).toHaveTextContent("Llegaste al límite de hoy. Vuelve mañana.");
    });

    it("reports an unexpected rejection instead of throwing", async () => {
      const user = userEvent.setup();
      generateRecallQuestionsAction.mockRejectedValue(new Error("network"));
      await renderPanel(false);

      await user.click(screen.getByTestId("generate-recall-questions"));

      expect(
        await screen.findByTestId("recall-generation-error"),
      ).toHaveTextContent(
        "No pudimos generar las preguntas. Intenta de nuevo.",
      );
    });
  });

  // Incremental generation (Phase 6 T5c): an unchanged page is not an
  // error — the card's notice line says there is nothing new and the
  // shared counter stays as it was.
  describe("nothing new to generate", () => {
    it.each([
      [
        "flashcards",
        "FLASHCARDS_NO_NEW_CONTENT",
        "generation-notice",
        "generation-error",
      ],
      [
        "recall",
        "RECALL_NO_NEW_CONTENT",
        "recall-generation-notice",
        "recall-generation-error",
      ],
      [
        "exam",
        "EXAMS_NO_NEW_CONTENT",
        "exam-generation-notice",
        "exam-generation-error",
      ],
    ])("%s: shows the notice, no error, and keeps the counter", async (technique, code, noticeId, errorId) => {
      const user = userEvent.setup();
      const failure = err({ code, message: "nothing new" });
      generateFlashcardsAction.mockResolvedValue(failure);
      generateRecallQuestionsAction.mockResolvedValue(failure);
      generateExamQuestionsAction.mockResolvedValue(failure);
      await renderPanel(false, { initialRemaining: 4 });

      if (technique === "flashcards") {
        await user.click(screen.getByTestId("generate-flashcards"));
      } else if (technique === "recall") {
        await user.click(screen.getByTestId("generate-recall-questions"));
      } else {
        await generateExamViaDialog(user);
      }

      await waitForText(noticeId, "No hay contenido nuevo para generar");
      expect(screen.queryByTestId(errorId)).toBeNull();
      expect(screen.getAllByText("Te quedan 4 generaciones hoy")).toHaveLength(
        3,
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
