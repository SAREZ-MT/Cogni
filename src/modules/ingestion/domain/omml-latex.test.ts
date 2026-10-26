import { describe, expect, it } from "vitest";
import { importableLatex, repairOmmlLatex } from "./omml-latex";

// officeparser 8.2 converts OMML to LaTeX but writes a one-character
// argument without braces right after the command (`\frac` + `a` + `b`
// → `\fracab`), which no LaTeX renderer reads as a fraction (T0 spike).
// Since officeparser escapes every document character, each `\name` in its
// output is one of its own commands, so the lost braces can be put back
// deterministically.
describe("repairOmmlLatex", () => {
  it("restores the braces of one-character fraction and radical arguments", () => {
    expect(repairOmmlLatex("\\fracab + x^2 + \\sqrty")).toBe(
      "\\frac{a}{b} + x^{2} + \\sqrt{y}",
    );
  });

  it("keeps an already braced argument and only braces the bare one", () => {
    expect(repairOmmlLatex("\\fraca{bc}")).toBe("\\frac{a}{bc}");
    expect(repairOmmlLatex("\\frac{ab}c")).toBe("\\frac{ab}{c}");
  });

  it("separates a bare sub/superscript or operator from the operand that follows", () => {
    expect(repairOmmlLatex("\\sqrt{x+y}=\\sum_{i=1}^ni")).toBe(
      "\\sqrt{x+y}=\\sum_{i=1}^{n} i",
    );
    expect(repairOmmlLatex("\\intx")).toBe("\\int x");
    expect(repairOmmlLatex("\\mathbbR")).toBe("\\mathbb{R}");
  });

  it("leaves well-formed LaTeX and escaped characters untouched", () => {
    expect(repairOmmlLatex("\\frac{a+1}{2b}")).toBe("\\frac{a+1}{2b}");
    expect(repairOmmlLatex("e^{2x}")).toBe("e^{2x}");
    expect(repairOmmlLatex("a\\_b")).toBe("a\\_b");
  });
});

describe("importableLatex", () => {
  it("returns the repaired LaTeX when it validates", () => {
    expect(importableLatex("\\fracab")).toBe("\\frac{a}{b}");
    expect(importableLatex("\\begin{matrix}a & b\\end{matrix}")).toBe(
      "\\begin{matrix}a & b\\end{matrix}",
    );
  });

  it("returns null for unbalanced braces", () => {
    expect(importableLatex("\\frac{a+1}{2b")).toBeNull();
    expect(importableLatex("a}{b")).toBeNull();
  });

  it("returns null for a command officeparser never writes (cannot be repaired reliably)", () => {
    expect(importableLatex("\\unknowncommand{x}")).toBeNull();
    expect(importableLatex("\\begin{matrix}a")).toBeNull();
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(importableLatex("")).toBeNull();
    expect(importableLatex("   ")).toBeNull();
  });
});
