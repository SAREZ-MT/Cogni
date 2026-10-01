import { describe, expect, it } from "vitest";
import {
  getRecallPage,
  getRecallPagesWithSessions,
  getRecallQuestions,
  SAMPLE_NOTEBOOKS,
} from "./sample";

describe("active recall sample data", () => {
  it("only lists pages of the asked notebook", () => {
    const pages = getRecallPagesWithSessions("biologia-celular");

    expect(pages.map((page) => page.id)).toEqual([
      "mitocondria",
      "membrana-celular",
    ]);
  });

  it("returns nothing for an unknown notebook", () => {
    expect(getRecallPagesWithSessions("nope")).toEqual([]);
  });

  it("every listed page has at least one session and its own questions", () => {
    for (const notebook of SAMPLE_NOTEBOOKS) {
      for (const page of getRecallPagesWithSessions(notebook.id)) {
        expect(page.sessions.length).toBeGreaterThan(0);
        expect(getRecallQuestions(page.id).length).toBeGreaterThan(0);
      }
    }
  });

  it("finds a page by notebook and id", () => {
    expect(getRecallPage("biologia-celular", "mitocondria")?.title).toBe(
      "Mitocondria",
    );
  });

  it("does not find a page under another notebook or with an unknown id", () => {
    expect(getRecallPage("calculo-iii", "mitocondria")).toBeUndefined();
    expect(getRecallPage("biologia-celular", "nope")).toBeUndefined();
  });

  it("returns only the questions of the asked page", () => {
    const questions = getRecallQuestions("membrana-celular");

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.pageId === "membrana-celular")).toBe(true);
    expect(getRecallQuestions("nope")).toEqual([]);
  });
});
