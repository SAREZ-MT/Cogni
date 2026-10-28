import { describe, expect, it } from "vitest";
import {
  HERO_LINES,
  HERO_SENTENCE,
  HERO_WORDS,
  networkGrowth,
  outroProgress,
  revealedWordCount,
  settleProgress,
  wordProgress,
} from "./hero-timeline";

const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

describe("hero sentence", () => {
  it("splits the fixed sentence into 16 words in reading order", () => {
    expect(HERO_WORDS).toHaveLength(16);
    expect(HERO_WORDS[0]).toBe("Cogni");
    expect(HERO_WORDS.at(-1)).toBe("mano.");
    expect(HERO_WORDS.join(" ")).toBe(HERO_SENTENCE);
  });

  it("wraps the sentence in three lines that keep every word in order", () => {
    expect(HERO_LINES).toHaveLength(3);
    expect(HERO_LINES.flat()).toEqual(HERO_WORDS);
  });
});

describe("scroll progress to revealed words", () => {
  it("reveals nothing at the start and everything at the end", () => {
    expect(revealedWordCount(0)).toBe(0);
    expect(HERO_WORDS.every((_, i) => wordProgress(0, i) === 0)).toBe(true);
    expect(revealedWordCount(1)).toBe(HERO_WORDS.length);
    expect(HERO_WORDS.every((_, i) => wordProgress(1, i) === 1)).toBe(true);
  });

  it("always reveals a prefix of the sentence (reading order)", () => {
    for (const p of STEPS) {
      for (let i = 1; i < HERO_WORDS.length; i++) {
        expect(wordProgress(p, i)).toBeLessThanOrEqual(wordProgress(p, i - 1));
      }
    }
  });

  it("never un-reveals a word while scrolling down", () => {
    for (let i = 0; i < HERO_WORDS.length; i++) {
      let last = 0;
      for (const p of STEPS) {
        const value = wordProgress(p, i);
        expect(value).toBeGreaterThanOrEqual(last);
        last = value;
      }
    }
  });

  it("reveals about half of the words halfway through the reveal", () => {
    const count = revealedWordCount(0.5);
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(10);
  });
});

describe("outro, settle and network", () => {
  it("shows the subtitle and actions only after the last word is sharp", () => {
    for (const p of STEPS) {
      if (outroProgress(p) > 0) expect(revealedWordCount(p)).toBe(16);
    }
    expect(outroProgress(1)).toBe(1);
  });

  it("settles the headline before the first word is revealed", () => {
    expect(settleProgress(0)).toBe(0);
    for (const p of STEPS) {
      if (wordProgress(p, 0) > 0.5) expect(settleProgress(p)).toBe(1);
    }
  });

  it("grows the network monotonically and completes with the sentence", () => {
    let last = 0;
    for (const p of STEPS) {
      expect(networkGrowth(p)).toBeGreaterThanOrEqual(last);
      last = networkGrowth(p);
    }
    expect(networkGrowth(0)).toBe(0);
    expect(networkGrowth(1)).toBe(1);
  });
});
