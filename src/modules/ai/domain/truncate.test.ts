import { describe, expect, it } from "vitest";
import { truncateToTokenCap } from "./truncate";

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("truncateToTokenCap", () => {
  it("leaves text under the cap untouched", () => {
    const text = "one two\nthree";
    expect(truncateToTokenCap(text, 100)).toEqual({
      text,
      truncated: false,
      wordsUsed: 3,
      wordsTotal: 3,
    });
  });

  it("keeps text exactly at the cap (cap 12 tokens = 9 words)", () => {
    const result = truncateToTokenCap(words(9), 12);
    expect(result.truncated).toBe(false);
    expect(result.wordsUsed).toBe(9);
  });

  it("keeps only the leading words that fit over the cap", () => {
    const result = truncateToTokenCap(words(20), 12);
    expect(result).toEqual({
      text: words(9),
      truncated: true,
      wordsUsed: 9,
      wordsTotal: 20,
    });
  });

  it("preserves original whitespace inside the kept prefix", () => {
    const result = truncateToTokenCap("a b\n\nc d e f", 3);
    expect(result.text).toBe("a b");
    expect(result.wordsUsed).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("returns empty output for blank input", () => {
    const empty = { text: "", truncated: false, wordsUsed: 0, wordsTotal: 0 };
    expect(truncateToTokenCap("", 100)).toEqual(empty);
    expect(truncateToTokenCap("  \n\t ", 100)).toEqual(empty);
  });

  it("estimates tokens as ceil(words / 0.75)", () => {
    // 12000 tokens -> 9000 words.
    expect(truncateToTokenCap(words(9000), 12000).truncated).toBe(false);
    expect(truncateToTokenCap(words(9001), 12000).wordsUsed).toBe(9000);
  });
});
