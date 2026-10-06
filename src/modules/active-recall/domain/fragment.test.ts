import { describe, expect, it } from "vitest";
import { normalizeTerms, selectRelevantFragment } from "./fragment";

const question = {
  prompt: "¿Qué función cumple la mitocondria?",
  rubric: {
    keyConcepts: ["respiración celular", "ATP"],
    acceptableAnswerSummary: "Produce energía.",
  },
};

function words(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

// tokenCap → maxWords = floor(cap × 0.75), as in ai truncateToTokenCap.
const capFor = (maxWords: number) => Math.ceil(maxWords / 0.75);

const filler = (n: number) =>
  `El párrafo ${n} habla de geografía, ríos y montañas del país.`;
const relevant =
  "La mitocondria realiza la respiración celular y produce ATP para la célula.";

describe("normalizeTerms", () => {
  it("lowercases, strips accents and punctuation, and drops short and stop words", () => {
    expect(
      normalizeTerms("¿Qué FUNCIÓN cumple la Mitocondria, y el ATP?"),
    ).toEqual(["funcion", "cumple", "mitocondria", "atp"]);
  });

  it("is empty for blank or stop-word-only text", () => {
    expect(normalizeTerms("   ")).toEqual([]);
    expect(normalizeTerms("de la que el y the and")).toEqual([]);
  });
});

describe("selectRelevantFragment", () => {
  it("returns an empty fragment for an empty page", () => {
    expect(selectRelevantFragment("", question, 100)).toBe("");
    expect(selectRelevantFragment("  \n ", question, 100)).toBe("");
  });

  it("returns the whole text untouched when it fits the cap", () => {
    const text = `${filler(1)}\n\n${relevant}`;

    expect(selectRelevantFragment(text, question, capFor(words(text)))).toBe(
      text,
    );
  });

  it("returns nothing when the cap allows no word", () => {
    expect(selectRelevantFragment(relevant, question, 1)).toBe("");
  });

  it("picks the paragraph that shares the question's terms", () => {
    const text = [filler(1), filler(2), relevant, filler(3), filler(4)].join(
      "\n\n",
    );

    expect(
      selectRelevantFragment(text, question, capFor(words(relevant))),
    ).toBe(relevant);
  });

  it("matches regardless of case and accents", () => {
    const shouted = "LA MITOCONDRIA HACE RESPIRACION CELULAR.";
    const text = [filler(1), filler(2), shouted, filler(3)].join("\n");

    expect(selectRelevantFragment(text, question, capFor(words(shouted)))).toBe(
      shouted,
    );
  });

  it("does not let stop words decide the match", () => {
    const stopWords = "Que es la que de la que es la de que la.";
    const target = "Mitocondria sin más contexto aquí ahora.";
    const text = [stopWords, stopWords, target, stopWords].join(" ");

    expect(selectRelevantFragment(text, question, capFor(words(target)))).toBe(
      target,
    );
  });

  it("joins neighbouring sentences into one contiguous window", () => {
    const first = "La mitocondria es un organelo.";
    const second = "Allí ocurre la respiración celular.";
    const text = [filler(1), first, second, filler(2), filler(3)].join(" ");
    const cap = capFor(words(first) + words(second));

    expect(selectRelevantFragment(text, question, cap)).toBe(
      `${first} ${second}`,
    );
  });

  it("falls back to the start of the page when nothing matches", () => {
    const text = [filler(1), filler(2), filler(3)].join("\n\n");

    expect(
      selectRelevantFragment(text, question, capFor(words(filler(1)))),
    ).toBe(filler(1));
  });

  it("prefers the earliest window on a tie", () => {
    const a = "Primera mención de la mitocondria aquí.";
    const b = "Segunda mención de la mitocondria allá.";
    const text = [filler(1), a, filler(2), b, filler(3)].join("\n");

    expect(selectRelevantFragment(text, question, capFor(words(a)))).toBe(a);
  });

  it("splits a sentence longer than the cap into word chunks", () => {
    const text =
      `${"palabra ".repeat(30)}mitocondria final ${"otra ".repeat(30)}`.trim();
    const fragment = selectRelevantFragment(text, question, capFor(6));

    expect(words(fragment)).toBeLessThanOrEqual(6);
    expect(fragment).toContain("mitocondria");
  });

  it("never exceeds the word budget of the token cap", () => {
    const text = Array.from({ length: 40 }, (_, i) =>
      i % 7 === 0 ? relevant : filler(i),
    ).join("\n\n");

    for (const maxWords of [5, 13, 27, 60]) {
      const fragment = selectRelevantFragment(text, question, capFor(maxWords));

      expect(words(fragment)).toBeLessThanOrEqual(maxWords);
      expect(words(fragment)).toBeGreaterThan(0);
    }
  });

  it("uses the rubric key concepts, not only the prompt", () => {
    const atp = "El ATP es la moneda energética de la célula.";
    const text = [filler(1), filler(2), atp, filler(3)].join("\n");

    expect(
      selectRelevantFragment(
        text,
        { ...question, prompt: "Explica el tema." },
        capFor(words(atp)),
      ),
    ).toBe(atp);
  });
});
