import { describe, expect, it } from "vitest";
import { deletionSummary } from "./deletion-summary";

const pages = (count: number) => ({ count, one: "página", many: "páginas" });
const decks = (count: number) => ({ count, one: "mazo", many: "mazos" });
const exams = (count: number) => ({ count, one: "examen", many: "exámenes" });

describe("deletionSummary (Phase 8 H19)", () => {
  it("lists every non-empty part with its count, joined with commas and «y»", () => {
    expect(deletionSummary([pages(4), decks(2), exams(1)])).toBe(
      "Se eliminarán 4 páginas, 2 mazos y 1 examen.",
    );
  });

  it("joins two parts with «y» only", () => {
    expect(deletionSummary([pages(1), decks(3)])).toBe(
      "Se eliminarán 1 página y 3 mazos.",
    );
  });

  it("uses the singular verb for one single item", () => {
    expect(deletionSummary([pages(1), decks(0)])).toBe(
      "Se eliminará 1 página.",
    );
  });

  it("skips empty parts and returns null when nothing is left", () => {
    expect(deletionSummary([pages(0), decks(2)])).toBe(
      "Se eliminarán 2 mazos.",
    );
    expect(deletionSummary([pages(0), decks(0)])).toBeNull();
  });
});
