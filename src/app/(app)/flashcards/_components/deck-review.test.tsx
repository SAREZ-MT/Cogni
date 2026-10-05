import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const actions = vi.hoisted(() => ({
  startFlashcardSessionAction: vi.fn(),
  gradeFlashcardAction: vi.fn(),
  finishFlashcardSessionAction: vi.fn(),
  requestSessionFeedbackAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => actions);

import { DeckReview } from "./deck-review";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const SESSION = "7c1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

const FEEDBACK = {
  summary: "Buena sesión.",
  strengths: ["Pregunta 1"],
  toReinforce: [],
  nextStepSuggestion: "Repasa mañana.",
};

const card = (n: number, days = { again: 1, hard: 1, good: 1, easy: 1 }) => ({
  itemId: `i${n}`,
  flashcardId: `c${n}`,
  front: `Pregunta ${n}`,
  back: `Respuesta ${n}`,
  nextIntervalDays: days,
});

function setup(canReview = true) {
  const user = userEvent.setup();
  render(
    <DeckReview
      notebookId="nb"
      notebookTitle="Biología"
      pageId={PAGE}
      deckLabel="Mitocondria"
      description="2 tarjetas"
      canReview={canReview}
      actions={<button type="button">Nueva tarjeta</button>}
    >
      <p>lista del mazo</p>
    </DeckReview>,
  );
  return user;
}

async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Repasar/ }));
}

describe("DeckReview", () => {
  beforeEach(() => {
    refresh.mockClear();
    for (const action of Object.values(actions)) action.mockReset();
    actions.gradeFlashcardAction.mockResolvedValue({
      ok: true,
      value: { reviewedCount: 1, againCount: 0, masteryLevel: "Aprendiendo" },
    });
    actions.finishFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { reviewedCount: 1, againCount: 0 },
    });
    actions.requestSessionFeedbackAction.mockResolvedValue({
      ok: true,
      value: { status: "done", content: FEEDBACK },
    });
  });

  it("shows the deck header, its actions, a Repasar button and the deck", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Mitocondria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 tarjetas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Repasar/ })).toBeInTheDocument();
    expect(screen.getByText("lista del mazo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Biología/ })).toHaveAttribute(
      "href",
      "/flashcards/nb",
    );
  });

  it("offers no review for a page without cards", () => {
    setup(false);

    expect(
      screen.queryByRole("button", { name: /Repasar/ }),
    ).not.toBeInTheDocument();
  });

  it("starts a session on the page and plays its due cards with SM-2 hints", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: {
        sessionId: SESSION,
        cards: [card(1, { again: 1, hard: 6, good: 6, easy: 6 }), card(2)],
      },
    });
    const user = setup();

    await start(user);

    expect(actions.startFlashcardSessionAction).toHaveBeenCalledWith({
      pageId: PAGE,
    });
    expect(await screen.findByTestId("flashcard-player")).toBeInTheDocument();
    expect(screen.queryByText("lista del mazo")).not.toBeInTheDocument();
    expect(screen.getByText("Pregunta 1")).toBeInTheDocument();
    await user.click(screen.getByTestId("flip-card"));
    expect(screen.getByTestId("rate-again")).toHaveTextContent("1 día");
    expect(screen.getByTestId("rate-good")).toHaveTextContent("6 días");
  });

  it("says the deck is up to date when nothing is due", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: false,
      error: { code: "STUDY_ENGINE_NOTHING_DUE", message: "x" },
    });
    const user = setup();

    await start(user);

    expect(await screen.findByText("Estás al día")).toBeInTheDocument();
    expect(screen.getByText("lista del mazo")).toBeInTheDocument();
    expect(screen.queryByTestId("flashcard-player")).not.toBeInTheDocument();
  });

  it("reports any other start failure", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARDS_UNEXPECTED", message: "x" },
    });
    const user = setup();

    await start(user);

    expect(
      await screen.findByText("No pudimos iniciar el repaso"),
    ).toBeInTheDocument();
  });

  it("grades each card, finishes the session and returns to a refreshed deck", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { sessionId: SESSION, cards: [card(1)] },
    });
    const user = setup();
    await start(user);

    await user.click(await screen.findByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-easy"));

    expect(actions.gradeFlashcardAction).toHaveBeenCalledWith({
      sessionId: SESSION,
      itemId: "i1",
      rating: "easy",
    });
    const summary = await screen.findByRole("dialog", {
      name: /Sesión completada/,
    });
    expect(actions.finishFlashcardSessionAction).toHaveBeenCalledWith({
      sessionId: SESSION,
    });
    expect(summary).toHaveTextContent("Aprendiendo");

    await user.click(
      within(summary).getByRole("button", { name: "Volver al mazo" }),
    );

    expect(screen.queryByTestId("flashcard-player")).not.toBeInTheDocument();
    expect(screen.getByText("lista del mazo")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("moves on when the card was already graded (a double submit)", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { sessionId: SESSION, cards: [card(1), card(2)] },
    });
    actions.gradeFlashcardAction.mockResolvedValue({
      ok: false,
      error: { code: "STUDY_ENGINE_ITEM_NOT_DUE", message: "x" },
    });
    const user = setup();
    await start(user);

    await user.click(await screen.findByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-good"));

    expect(await screen.findByText("Tarjeta 2 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the card usable when grading rejects", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { sessionId: SESSION, cards: [card(1), card(2)] },
    });
    actions.gradeFlashcardAction.mockRejectedValue(new Error("network"));
    const user = setup();
    await start(user);

    await user.click(await screen.findByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-good"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar tu respuesta. Intenta de nuevo.",
    );
    expect(screen.getByText("Tarjeta 1 de 2")).toBeInTheDocument();
    expect(screen.getByTestId("rate-good")).toBeEnabled();
    expect(screen.getByRole("button", { name: /Terminar/ })).toBeEnabled();
  });

  it("grades once and skips no card on a double click", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { sessionId: SESSION, cards: [card(1), card(2), card(3)] },
    });
    actions.gradeFlashcardAction
      .mockResolvedValueOnce({
        ok: true,
        value: { reviewedCount: 1, againCount: 0, masteryLevel: "Aprendiendo" },
      })
      .mockResolvedValue({
        ok: false,
        error: { code: "STUDY_ENGINE_ITEM_NOT_DUE", message: "x" },
      });
    const user = setup();
    await start(user);
    await user.click(await screen.findByTestId("flip-card"));

    const good = screen.getByTestId("rate-good");
    await act(async () => {
      good.click();
      good.click();
    });

    expect(await screen.findByText("Tarjeta 2 de 3")).toBeInTheDocument();
    expect(actions.gradeFlashcardAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pregunta 2")).toBeInTheDocument();
  });

  it("reports a start that rejects", async () => {
    actions.startFlashcardSessionAction.mockRejectedValue(new Error("network"));
    const user = setup();

    await start(user);

    expect(
      await screen.findByText("No pudimos iniciar el repaso"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Repasar/ })).toBeEnabled();
  });

  it("keeps the card and explains when a grade cannot be saved", async () => {
    actions.startFlashcardSessionAction.mockResolvedValue({
      ok: true,
      value: { sessionId: SESSION, cards: [card(1)] },
    });
    actions.gradeFlashcardAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARDS_UNEXPECTED", message: "x" },
    });
    const user = setup();
    await start(user);

    await user.click(await screen.findByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-good"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar tu respuesta. Intenta de nuevo.",
    );
    expect(screen.getByText("Tarjeta 1 de 1")).toBeInTheDocument();
  });

  describe("session feedback", () => {
    async function finishOneCard(user: ReturnType<typeof userEvent.setup>) {
      actions.startFlashcardSessionAction.mockResolvedValue({
        ok: true,
        value: { sessionId: SESSION, cards: [card(1)] },
      });
      await start(user);
      await user.click(await screen.findByTestId("flip-card"));
      await user.click(screen.getByTestId("rate-good"));
      return screen.findByRole("dialog", { name: /Sesión completada/ });
    }

    it("asks for the finished session's feedback and shows it in the summary", async () => {
      const user = setup();

      const summary = await finishOneCard(user);

      expect(
        await within(summary).findByText("Buena sesión."),
      ).toBeInTheDocument();
      expect(actions.requestSessionFeedbackAction).toHaveBeenCalledTimes(1);
      expect(actions.requestSessionFeedbackAction).toHaveBeenCalledWith({
        sessionId: SESSION,
      });
      expect(
        actions.finishFlashcardSessionAction.mock.invocationCallOrder[0],
      ).toBeLessThan(
        actions.requestSessionFeedbackAction.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("shows a calm note and keeps the summary usable when the AI failed", async () => {
      actions.requestSessionFeedbackAction.mockResolvedValue({
        ok: true,
        value: { status: "failed", content: null },
      });
      const user = setup();

      const summary = await finishOneCard(user);

      expect(
        await within(summary).findByText(
          /no pudimos preparar la retroalimentación/,
        ),
      ).toBeInTheDocument();
      await user.click(
        within(summary).getByRole("button", { name: "Volver al mazo" }),
      );
      expect(screen.getByText("lista del mazo")).toBeInTheDocument();
    });

    it.each([
      ["refused", { ok: false, error: { code: "X", message: "x" } }],
      ["rejected", null],
    ])("shows the calm note when the feedback request is %s", async (_l, value) => {
      if (value) actions.requestSessionFeedbackAction.mockResolvedValue(value);
      else actions.requestSessionFeedbackAction.mockRejectedValue(new Error());
      const user = setup();

      const summary = await finishOneCard(user);

      expect(
        await within(summary).findByText(
          /no pudimos preparar la retroalimentación/,
        ),
      ).toBeInTheDocument();
    });

    it("does not ask for feedback when the session could not be closed", async () => {
      actions.finishFlashcardSessionAction.mockResolvedValue({
        ok: false,
        error: { code: "STUDY_ENGINE_SESSION_NOT_FOUND", message: "x" },
      });
      const user = setup();

      const summary = await finishOneCard(user);

      expect(
        await within(summary).findByText(
          /no pudimos preparar la retroalimentación/,
        ),
      ).toBeInTheDocument();
      expect(actions.requestSessionFeedbackAction).not.toHaveBeenCalled();
    });

    it("shows no feedback panel when no card was graded", async () => {
      actions.startFlashcardSessionAction.mockResolvedValue({
        ok: true,
        value: { sessionId: SESSION, cards: [card(1)] },
      });
      actions.finishFlashcardSessionAction.mockResolvedValue({
        ok: true,
        value: { reviewedCount: 0, againCount: 0 },
      });
      const user = setup();
      await start(user);

      await user.click(await screen.findByRole("button", { name: /Terminar/ }));

      const summary = await screen.findByRole("dialog", {
        name: /Sesión completada/,
      });
      await act(async () => {});
      expect(
        within(summary).queryByTestId("session-feedback"),
      ).not.toBeInTheDocument();
      expect(actions.requestSessionFeedbackAction).not.toHaveBeenCalled();
    });
  });
});
