import { describe, expect, it } from "vitest";
import {
  getSampleCards,
  getSampleDecks,
  getSampleNotebook,
  SAMPLE_DECKS,
  SAMPLE_NOTEBOOKS,
} from "./sample";

describe("flashcards sample data", () => {
  it("never has an empty deck", () => {
    for (const deck of SAMPLE_DECKS) {
      expect(getSampleCards(deck.id).length).toBeGreaterThan(0);
    }
  });

  it("derives each deck's card count from the cards it holds", () => {
    for (const notebook of SAMPLE_NOTEBOOKS) {
      for (const deck of getSampleDecks(notebook.id)) {
        expect(deck.cardCount).toBe(getSampleCards(deck.id).length);
      }
    }
  });

  it("never reports more pending cards than the deck holds", () => {
    for (const notebook of SAMPLE_NOTEBOOKS) {
      for (const deck of getSampleDecks(notebook.id)) {
        expect(deck.dueCount).toBeLessThanOrEqual(deck.cardCount);
      }
    }
  });

  it("returns only the decks of the requested notebook", () => {
    const decks = getSampleDecks("biologia-celular");

    expect(decks.map((deck) => deck.id)).toEqual([
      "mitocondria-semana-3",
      "membrana-celular",
    ]);
    expect(decks.every((deck) => deck.notebookId === "biologia-celular")).toBe(
      true,
    );
  });

  it("returns only the cards of the requested deck", () => {
    const cards = getSampleCards("renacimiento");

    expect(cards).toHaveLength(6);
    expect(cards.every((card) => card.deckId === "renacimiento")).toBe(true);
  });

  it("returns no decks or cards for an unknown id", () => {
    expect(getSampleDecks("no-existe")).toEqual([]);
    expect(getSampleCards("no-existe")).toEqual([]);
    expect(getSampleNotebook("no-existe")).toBeUndefined();
  });

  it("finds a notebook by id", () => {
    expect(getSampleNotebook("calculo-iii")?.title).toBe("Cálculo III");
  });
});
