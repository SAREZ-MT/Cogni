import { describe, expect, it } from "vitest";
import {
  EXAM_MIN_WORDS,
  examCountsForWords,
  flashcardCountForWords,
  MIN_GENERATION_WORDS,
  maxItemsForWords,
  PAGE_TOO_SHORT_CODE,
  PageTooShortError,
  RECALL_MIN_WORDS,
  requiredWordsFor,
  WORDS_PER_ITEM,
} from "./generation-capacity";
import { consumedParagraphs, splitParagraphs } from "./page-paragraphs";

describe("generation capacity (Phase 8 H14, user 2026-10-29)", () => {
  it("needs 100 words and about 15 per item", () => {
    expect(MIN_GENERATION_WORDS).toBe(100);
    expect(WORDS_PER_ITEM).toBe(15);
  });

  it.each([
    [0, 0],
    [14, 0],
    [15, 1],
    [100, 6],
    [149, 9],
    [150, 10],
    [452, 30],
  ])("fits %i words into %i items", (words, items) => {
    expect(maxItemsForWords(words)).toBe(items);
  });

  it("needs the minimum and 15 words per requested item", () => {
    expect(requiredWordsFor(1)).toBe(100);
    expect(requiredWordsFor(6)).toBe(100);
    expect(requiredWordsFor(10)).toBe(150);
    expect(requiredWordsFor(30)).toBe(450);
  });

  it("lets recall's ten questions and the smallest exam need 150 words", () => {
    expect(RECALL_MIN_WORDS).toBe(150);
    expect(EXAM_MIN_WORDS).toBe(150);
  });

  describe("exam counts", () => {
    it.each([
      [99, []],
      [149, []],
      [150, [10]],
      [224, [10]],
      [225, [10, 15]],
      [300, [10, 15, 20]],
      [450, [10, 15, 20, 25, 30]],
      [5000, [10, 15, 20, 25, 30]],
    ])("offers %i words the counts %j", (words, counts) => {
      expect(examCountsForWords(words)).toEqual(counts);
    });
  });

  describe("flashcard count", () => {
    it.each([
      [100, 6],
      [120, 8],
      [150, 10],
      [3000, 10],
    ])("sends %i words for %i cards", (words, count) => {
      expect(flashcardCountForWords(words)).toBe(count);
    });

    it("never goes under 3 cards", () => {
      expect(flashcardCountForWords(20)).toBe(3);
    });
  });

  it("carries the words, the minimum and the capacity in its error", () => {
    const error = new PageTooShortError({ words: 80, minWords: 100 });

    expect(error.code).toBe(PAGE_TOO_SHORT_CODE);
    expect(PAGE_TOO_SHORT_CODE).toBe("AI_PAGE_TOO_SHORT");
    expect(error.words).toBe(80);
    expect(error.minWords).toBe(100);
    expect(error.maxItems).toBe(5);
  });

  describe("consumed paragraphs", () => {
    const sent = splitParagraphs(
      [
        "uno dos tres cuatro cinco seis siete ocho nueve diez",
        "once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte",
        "a b c d e f g h i j",
        "k l m n o p q r s t",
      ].join("\n"),
    );

    it("marks every sent paragraph when every requested item came back", () => {
      expect(consumedParagraphs(sent, 10, 10)).toEqual(sent);
      expect(consumedParagraphs(sent, 12, 10)).toEqual(sent);
    });

    it("marks the share of the paragraphs the accepted items cover", () => {
      // 40 words, half the items: the first 20 words.
      expect(consumedParagraphs(sent, 5, 10)).toEqual(sent.slice(0, 2));
    });

    it("always marks the first paragraph when an item came back", () => {
      expect(consumedParagraphs(sent, 1, 10)).toEqual(sent.slice(0, 1));
    });

    it("marks nothing without accepted items", () => {
      expect(consumedParagraphs(sent, 0, 10)).toEqual([]);
    });
  });
});
