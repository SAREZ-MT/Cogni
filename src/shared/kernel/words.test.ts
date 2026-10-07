import { describe, expect, it } from "vitest";
import { countWords } from "./words";

describe("countWords", () => {
  it("counts runs of non-whitespace, whatever the separators", () => {
    expect(countWords("  la\tcélula,\n\nATP. x ")).toBe(4);
  });

  it("is zero for a blank text", () => {
    expect(countWords(" \n\t ")).toBe(0);
  });
});
