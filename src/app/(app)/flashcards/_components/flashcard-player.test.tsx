import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SampleCard } from "../_data/sample";
import { FlashcardPlayer } from "./flashcard-player";

const CARDS: SampleCard[] = [
  { id: "c1", pageId: "p", front: "Pregunta 1", back: "Respuesta 1" },
  { id: "c2", pageId: "p", front: "Pregunta 2", back: "Respuesta 2" },
  { id: "c3", pageId: "p", front: "Pregunta 3", back: "Respuesta 3" },
];

function setup(cards: SampleCard[] = CARDS) {
  const user = userEvent.setup();
  render(<FlashcardPlayer notebookId="nb" deckLabel="Mi mazo" cards={cards} />);
  return user;
}

const tally = () =>
  within(screen.getByTestId("stat-dots"))
    .getAllByText(/^\d+$/)
    .map((node) => node.textContent);

describe("FlashcardPlayer", () => {
  it("starts on the first card, unflipped, with the deck progress", () => {
    setup();

    expect(screen.getByText("Mi mazo")).toBeInTheDocument();
    expect(screen.getByText("3 tarjetas en esta sesión")).toBeInTheDocument();
    expect(screen.getByText("Tarjeta 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByTestId("flip-card")).toHaveAttribute(
      "data-flipped",
      "false",
    );
    expect(
      screen.getByRole("button", { name: /Mostrar respuesta/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("rate-good")).not.toBeInTheDocument();
  });

  it("flips with the show-answer button and reveals the rating buttons", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: /Mostrar respuesta/ }));

    expect(screen.getByTestId("flip-card")).toHaveAttribute(
      "data-flipped",
      "true",
    );
    for (const tone of ["again", "hard", "good", "easy"]) {
      expect(screen.getByTestId(`rate-${tone}`)).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: /Mostrar respuesta/ }),
    ).not.toBeInTheDocument();
  });

  it("flips by clicking the card and goes back with 'Ver pregunta'", async () => {
    const user = setup();

    await user.click(screen.getByTestId("flip-card"));
    expect(screen.getByTestId("flip-card")).toHaveAttribute(
      "data-flipped",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /Ver pregunta/ }));
    expect(screen.getByTestId("flip-card")).toHaveAttribute(
      "data-flipped",
      "false",
    );
  });

  it("rating a card tallies it, advances, and shows the next card unflipped", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: /Mostrar respuesta/ }));
    await user.click(screen.getByTestId("rate-hard"));

    expect(screen.getByText("Tarjeta 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByTestId("flip-card")).toHaveAttribute(
      "data-flipped",
      "false",
    );
    // again, hard, good, easy
    expect(tally()).toEqual(["0", "1", "0", "0"]);
  });

  it("keeps a separate tally per rating", async () => {
    const user = setup();

    await user.click(screen.getByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-again"));
    await user.click(screen.getByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-easy"));

    expect(tally()).toEqual(["1", "0", "0", "1"]);
  });

  it("shows the end-of-session summary after rating the last card", async () => {
    const user = setup();

    for (const tone of ["good", "good", "easy"]) {
      await user.click(screen.getByTestId("flip-card"));
      await user.click(screen.getByTestId(`rate-${tone}`));
    }

    const summary = screen.getByRole("dialog", { name: /Sesión completada/ });
    expect(summary).toHaveTextContent("Mi mazo — 3 tarjetas revisadas");
    expect(
      within(summary).getByRole("link", { name: "Volver al mazo" }),
    ).toHaveAttribute("href", "/flashcards/nb");
  });

  it("does not show the summary while a card is flipped", async () => {
    const user = setup();

    await user.click(screen.getByTestId("flip-card"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show the summary before the last card", async () => {
    const user = setup();

    await user.click(screen.getByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-good"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ends the session early from 'Terminar' counting only rated cards", async () => {
    const user = setup();

    await user.click(screen.getByTestId("flip-card"));
    await user.click(screen.getByTestId("rate-good"));
    await user.click(screen.getByRole("button", { name: /Terminar/ }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Mi mazo — 1 tarjetas revisadas",
    );
  });

  it("restarts from the first card with a cleared tally", async () => {
    const user = setup();

    for (const tone of ["good", "good", "easy"]) {
      await user.click(screen.getByTestId("flip-card"));
      await user.click(screen.getByTestId(`rate-${tone}`));
    }
    await user.click(screen.getByRole("button", { name: /Repasar de nuevo/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Tarjeta 1 de 3")).toBeInTheDocument();
    expect(tally()).toEqual(["0", "0", "0", "0"]);
  });

  it("links back to the notebook's decks", () => {
    setup();

    expect(
      screen.getByRole("link", { name: /Todos los mazos/ }),
    ).toHaveAttribute("href", "/flashcards/nb");
  });

  it("shows an empty state instead of a session when the deck has no cards", () => {
    setup([]);

    expect(screen.getByText("Sin tarjetas en este mazo")).toBeInTheDocument();
    expect(screen.queryByTestId("flip-card")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al mazo" }),
    ).toHaveAttribute("href", "/flashcards/nb");
  });
});
