import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionSummary } from "./session-summary";

const STATS = { again: 1, hard: 2, good: 3, easy: 4 };

function setup(onRestart = vi.fn()) {
  render(
    <SessionSummary
      deckLabel="Mi mazo"
      reviewedCount={10}
      nextReviewCount={7}
      stats={STATS}
      backHref="/flashcards/nb"
      onRestart={onRestart}
    />,
  );
  return onRestart;
}

describe("SessionSummary", () => {
  it("is a labelled modal dialog", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: "¡Sesión completada!" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("reports the deck and the number of reviewed cards", () => {
    setup();

    expect(
      screen.getByText("Mi mazo — 10 tarjetas revisadas"),
    ).toBeInTheDocument();
  });

  it("shows each rating's count under its label", () => {
    setup();

    const dialog = screen.getByRole("dialog");
    const expected: [string, string][] = [
      ["Otra vez", "1"],
      ["Difícil", "2"],
      ["Bien", "3"],
      ["Fácil", "4"],
    ];
    for (const [label, count] of expected) {
      const tile = within(dialog).getByText(label).parentElement;
      expect(tile).toHaveTextContent(count);
    }
  });

  it("announces the next review count", () => {
    setup();

    expect(
      screen.getByText("Mañana · 7 tarjetas programadas"),
    ).toBeInTheDocument();
  });

  it("links back to the deck list", () => {
    setup();

    expect(
      screen.getByRole("link", { name: "Volver al mazo" }),
    ).toHaveAttribute("href", "/flashcards/nb");
  });

  it("restarts the session on demand", async () => {
    const onRestart = setup();

    await userEvent.click(
      screen.getByRole("button", { name: /Repasar de nuevo/ }),
    );

    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
