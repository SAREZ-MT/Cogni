import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fingerprintParagraph,
  joinParagraphs,
  normalizeParagraph,
  paragraphsWithinWords,
  selectNewParagraphs,
  splitParagraphs,
} from "./page-paragraphs";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("normalizeParagraph", () => {
  it("collapses inner whitespace, trims and lower-cases", () => {
    expect(normalizeParagraph("  La  Célula\tEucariota  ")).toBe(
      "la célula eucariota",
    );
  });
});

describe("fingerprintParagraph", () => {
  it("is the sha256 hex of the normalized text", () => {
    expect(fingerprintParagraph("La célula")).toBe(sha256("la célula"));
  });

  it("ignores case and whitespace differences", () => {
    expect(fingerprintParagraph("  LA   célula ")).toBe(
      fingerprintParagraph("la célula"),
    );
  });

  it("changes when a word changes", () => {
    expect(fingerprintParagraph("la célula animal")).not.toBe(
      fingerprintParagraph("la célula vegetal"),
    );
  });
});

describe("splitParagraphs", () => {
  it("splits on line breaks and blank lines, in page order", () => {
    const paragraphs = splitParagraphs("Uno dos\n\nTres\r\ncuatro cinco\nSeis");
    expect(paragraphs.map((p) => p.text)).toEqual([
      "Uno dos",
      "Tres",
      "cuatro cinco",
      "Seis",
    ]);
  });

  it("trims each paragraph, ignores blank ones and counts its words", () => {
    const paragraphs = splitParagraphs("  \n  Hola   mundo  \n\t\n");
    expect(paragraphs).toEqual([
      {
        text: "Hola   mundo",
        fingerprint: fingerprintParagraph("hola mundo"),
        words: 2,
      },
    ]);
  });

  it("returns nothing for a blank text", () => {
    expect(splitParagraphs(" \n\n ")).toEqual([]);
  });
});

describe("selectNewParagraphs", () => {
  const text = "Primero\nSegundo\nTercero";

  it("keeps every paragraph when nothing is known (first generation)", () => {
    expect(selectNewParagraphs(text, []).map((p) => p.text)).toEqual([
      "Primero",
      "Segundo",
      "Tercero",
    ]);
  });

  it("drops the paragraphs whose fingerprint is known", () => {
    const known = [
      fingerprintParagraph("primero"),
      fingerprintParagraph("TERCERO"),
    ];
    expect(selectNewParagraphs(text, known).map((p) => p.text)).toEqual([
      "Segundo",
    ]);
  });

  it("treats an edited paragraph as new", () => {
    const known = splitParagraphs(text).map((p) => p.fingerprint);
    expect(
      selectNewParagraphs("Primero\nSegundo editado\nTercero", known).map(
        (p) => p.text,
      ),
    ).toEqual(["Segundo editado"]);
  });

  it("is empty when every paragraph is known", () => {
    const known = new Set(splitParagraphs(text).map((p) => p.fingerprint));
    expect(selectNewParagraphs(`${text}\n\n  primero `, known)).toEqual([]);
  });

  it("keeps a repeated new paragraph only once (its first occurrence)", () => {
    expect(
      selectNewParagraphs("Repetido\nOtro\nrepetido", []).map((p) => p.text),
    ).toEqual(["Repetido", "Otro"]);
  });
});

describe("joinParagraphs", () => {
  it("joins the paragraph texts with line breaks", () => {
    expect(joinParagraphs(splitParagraphs("a b\n\nc"))).toBe("a b\nc");
  });

  it("is empty for no paragraphs", () => {
    expect(joinParagraphs([])).toBe("");
  });
});

describe("paragraphsWithinWords", () => {
  const paragraphs = splitParagraphs("uno dos\ntres cuatro cinco\nseis");

  it("keeps every paragraph when all its words were used", () => {
    expect(paragraphsWithinWords(paragraphs, 6)).toEqual(paragraphs);
  });

  it("keeps only the paragraphs wholly inside the used words", () => {
    expect(paragraphsWithinWords(paragraphs, 5).map((p) => p.text)).toEqual([
      "uno dos",
      "tres cuatro cinco",
    ]);
    expect(paragraphsWithinWords(paragraphs, 4).map((p) => p.text)).toEqual([
      "uno dos",
    ]);
  });

  it("keeps nothing when the first paragraph was cut", () => {
    expect(paragraphsWithinWords(paragraphs, 1)).toEqual([]);
    expect(paragraphsWithinWords(paragraphs, 0)).toEqual([]);
  });
});
