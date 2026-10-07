import { describe, expect, it } from "vitest";
import {
  joinParagraphs,
  paragraphsWithinWords,
  splitParagraphs,
} from "@/shared/kernel/page-paragraphs";
import { truncateToTokenCap } from "./truncate";

// Incremental generation (Phase 6 T5c) stores the fingerprints of the
// paragraphs a truncation sent, counting words per paragraph; the count
// must agree with truncateToTokenCap's count of the joined text whatever
// the whitespace, punctuation or accents.
const TOKENS = [
  "célula",
  "ATP.",
  "¿qué?",
  "a",
  "—",
  "x y",
  "célula",
  "1,5",
  "«cita»",
  "\t",
  "  ",
  "",
  " ",
];
const SEPARATORS = [" ", "  ", "\t", "   ", "\n", "\n\n", " \n ", "\r\n"];

// Deterministic pseudo-random texts (mulberry32).
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function text(next: () => number): string {
  const parts: string[] = [];
  const length = Math.floor(next() * 40);
  for (let i = 0; i < length; i += 1) {
    parts.push(TOKENS[Math.floor(next() * TOKENS.length)]);
    parts.push(SEPARATORS[Math.floor(next() * SEPARATORS.length)]);
  }
  return parts.join("");
}

describe("paragraph word counts agree with truncateToTokenCap", () => {
  it("for 300 varied texts and every cap", () => {
    const next = random(20261007);
    for (let n = 0; n < 300; n += 1) {
      const paragraphs = splitParagraphs(text(next));
      const joined = joinParagraphs(paragraphs);
      const total = paragraphs.reduce((sum, p) => sum + p.words, 0);
      expect(truncateToTokenCap(joined, 1_000_000).wordsTotal).toBe(total);
      for (let cap = 0; cap <= 40; cap += 1) {
        const truncation = truncateToTokenCap(joined, cap);
        const kept = paragraphsWithinWords(paragraphs, truncation.wordsUsed);
        const keptWords = kept.reduce((sum, p) => sum + p.words, 0);
        if (keptWords <= truncation.wordsUsed) {
          // Whole paragraphs: their text is exactly what was sent first.
          expect(truncation.text.startsWith(joinParagraphs(kept))).toBe(true);
          const following = paragraphs[kept.length];
          if (following) {
            expect(keptWords + following.words).toBeGreaterThan(
              truncation.wordsUsed,
            );
          }
        } else {
          // An oversized first paragraph whose start was sent.
          expect(kept).toEqual([paragraphs[0]]);
          expect(truncation.wordsUsed).toBeGreaterThan(0);
          expect(paragraphs[0].text.startsWith(truncation.text)).toBe(true);
        }
      }
    }
  });
});
