import { describe, expect, it } from "vitest";
import {
  getExamPage,
  getExamPagesWithQuestions,
  getExamQuestions,
  getExamVariantQuestions,
  MITOCONDRIA_RETAKE_CONCEPTS,
  SAMPLE_NOTEBOOKS,
} from "./sample";

const ALL_PAGES = SAMPLE_NOTEBOOKS.flatMap((notebook) =>
  getExamPagesWithQuestions(notebook.id),
);

describe("exam sample data", () => {
  it("has at least one page with questions", () => {
    expect(ALL_PAGES.length).toBeGreaterThan(0);
  });

  it.each(
    ALL_PAGES.map((page) => [page.id, page] as const),
  )("derives the question count of %s from its questions", (_id, page) => {
    expect(page.questionCount).toBe(getExamQuestions(page.id).length);
    expect(page.questionCount).toBeGreaterThan(0);
  });

  it("gives every question exactly four distinct options and one valid correct index", () => {
    for (const page of ALL_PAGES) {
      for (const question of getExamQuestions(page.id)) {
        expect(question.options, question.id).toHaveLength(4);
        expect(new Set(question.options).size, question.id).toBe(4);
        expect([0, 1, 2, 3], question.id).toContain(question.correctIndex);
        expect(question.pageId).toBe(page.id);
        expect(question.concept.length, question.id).toBeGreaterThan(0);
      }
    }
  });

  it("keeps question ids unique across every page and variant", () => {
    const ids = [
      ...ALL_PAGES.flatMap((page) => getExamQuestions(page.id)),
      ...getExamVariantQuestions("mitocondria"),
    ].map((question) => question.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps page state consistent with the 70 percent rule", () => {
    for (const page of ALL_PAGES) {
      if (page.lastScore === null) {
        expect(page.attempts).toBe(0);
        expect(page.passed).toBe(false);
        expect(page.retakePending).toBe(false);
      } else {
        expect(page.attempts).toBeGreaterThan(0);
        expect(page.passed).toBe(page.lastScore >= 70);
        expect(page.retakePending).toBe(page.lastScore < 70);
      }
    }
  });

  it("lists a never-attempted page that has questions", () => {
    const derivadas = getExamPage("calculo-iii", "derivadas-parciales");

    expect(derivadas).toMatchObject({ attempts: 0, lastScore: null });
  });

  it("scopes pages to their notebook", () => {
    expect(
      getExamPagesWithQuestions("biologia-celular").map((p) => p.id),
    ).toEqual(["mitocondria", "membrana-celular"]);
    expect(getExamPagesWithQuestions("no-such-notebook")).toEqual([]);
  });

  it("finds a page only under its own notebook", () => {
    expect(getExamPage("biologia-celular", "mitocondria")).toBeDefined();
    expect(getExamPage("calculo-iii", "mitocondria")).toBeUndefined();
    expect(getExamPage("biologia-celular", "nope")).toBeUndefined();
  });
});

describe("exam retake variants", () => {
  it("only the retake-pending page has a variant set", () => {
    const pending = ALL_PAGES.filter((page) => page.retakePending);

    expect(pending.map((page) => page.id)).toEqual(["mitocondria"]);
    for (const page of ALL_PAGES) {
      expect(getExamVariantQuestions(page.id).length > 0).toBe(
        page.retakePending,
      );
    }
  });

  it("serves the variants on a retake and the originals otherwise", () => {
    const original = getExamQuestions("mitocondria");
    const retake = getExamQuestions("mitocondria", { retake: true });

    expect(retake).toEqual(getExamVariantQuestions("mitocondria"));
    expect(retake).not.toEqual(original);
    expect(getExamQuestions("mitocondria", { retake: false })).toEqual(
      original,
    );
  });

  it("never repeats an original stem or id in the retake (master doc 7.5)", () => {
    const original = getExamQuestions("mitocondria");
    const retake = getExamQuestions("mitocondria", { retake: true });

    const originalStems = new Set(original.map((question) => question.stem));
    const originalIds = new Set(original.map((question) => question.id));
    for (const question of retake) {
      expect(originalStems.has(question.stem), question.id).toBe(false);
      expect(originalIds.has(question.id), question.id).toBe(false);
    }
  });

  it("covers the failed concepts announced by the retake banner", () => {
    const retakeConcepts = new Set(
      getExamQuestions("mitocondria", { retake: true }).map((q) => q.concept),
    );

    for (const concept of MITOCONDRIA_RETAKE_CONCEPTS) {
      expect(retakeConcepts.has(concept), concept).toBe(true);
    }
  });

  it("falls back to the original questions when the page has no variants", () => {
    expect(getExamQuestions("renacimiento", { retake: true })).toEqual(
      getExamQuestions("renacimiento"),
    );
  });
});
