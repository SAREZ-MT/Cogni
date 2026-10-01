import { describe, expect, it } from "vitest";
import {
  getSampleCards,
  getSampleNotebook,
  getSamplePage,
  getSamplePagesWithCards,
  getSampleStudyItemsForPage,
  SAMPLE_CARDS,
  SAMPLE_NOTEBOOKS,
  SAMPLE_PAGES,
} from "./sample";

describe("flashcards sample data", () => {
  it("never has a page without cards: a deck exists only when it has cards", () => {
    for (const page of SAMPLE_PAGES) {
      expect(getSampleCards(page.id).length).toBeGreaterThan(0);
    }
  });

  it("derives each page's card count from the cards it holds", () => {
    for (const notebook of SAMPLE_NOTEBOOKS) {
      for (const page of getSamplePagesWithCards(notebook.id)) {
        expect(page.cardCount).toBe(getSampleCards(page.id).length);
      }
    }
  });

  it("never reports more pending cards than the page holds", () => {
    for (const notebook of SAMPLE_NOTEBOOKS) {
      for (const page of getSamplePagesWithCards(notebook.id)) {
        expect(page.dueCount).toBeLessThanOrEqual(page.cardCount);
      }
    }
  });

  it("gives every page one deck: page ids are unique and every card belongs to a page", () => {
    const ids = SAMPLE_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of SAMPLE_CARDS) {
      expect(ids).toContain(card.pageId);
    }
  });

  it("returns only the pages of the requested notebook", () => {
    const pages = getSamplePagesWithCards("biologia-celular");

    expect(pages.map((page) => page.id)).toEqual([
      "mitocondria",
      "membrana-celular",
    ]);
    expect(pages.every((page) => page.notebookId === "biologia-celular")).toBe(
      true,
    );
  });

  it("returns only the cards of the requested page", () => {
    const cards = getSampleCards("renacimiento");

    expect(cards).toHaveLength(6);
    expect(cards.every((card) => card.pageId === "renacimiento")).toBe(true);
  });

  it("returns nothing for an unknown id", () => {
    expect(getSamplePagesWithCards("no-existe")).toEqual([]);
    expect(getSampleCards("no-existe")).toEqual([]);
    expect(getSampleNotebook("no-existe")).toBeUndefined();
    expect(getSamplePage("biologia-celular", "no-existe")).toBeUndefined();
  });

  it("finds a notebook by id", () => {
    expect(getSampleNotebook("calculo-iii")?.title).toBe("Cálculo III");
  });

  it("finds a page only inside its own notebook, with its derived card count", () => {
    expect(getSamplePage("biologia-celular", "mitocondria")).toMatchObject({
      title: "Mitocondria",
      cardCount: 8,
      dueCount: 5,
    });
    expect(getSamplePage("calculo-iii", "mitocondria")).toBeUndefined();
  });
});

describe("getSampleStudyItemsForPage", () => {
  it("offers exactly one flashcards deck, the one of the sample page, linking to its session", () => {
    const { flashcards } = getSampleStudyItemsForPage();

    expect(flashcards).toEqual([
      {
        href: "/flashcards/biologia-celular/mitocondria",
        label: "Mitocondria",
        detail: "8 tarjetas · 5 pendientes",
        tone: "primary",
      },
    ]);
  });

  it("offers one active recall and one exam sample item", () => {
    const { activeRecall, exam } = getSampleStudyItemsForPage();

    expect(activeRecall).toHaveLength(1);
    expect(exam).toHaveLength(1);
  });
});
