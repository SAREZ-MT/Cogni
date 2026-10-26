import { describe, expect, it } from "vitest";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import {
  importedHeading as H,
  type ImportedBlock,
  importedOrderedList,
  importedParagraph as P,
  importedBulletList as UL,
} from "./imported-doc";
import { textToBlocks } from "./text-to-blocks";

// Local fixture aliases matching design.md's own notation for the E1-E20
// table ("P("x")" = paragraph, "H(n,"x")" = heading level n, "UL([...])" =
// bulletList, "OL([...])" / "OL(start,[...])" = orderedList without/with
// attrs.start) — thin wrappers over the already-tested imported-doc.ts
// builders, so the fixtures below assert against production code, not a
// second hand-rolled implementation.
function OL(items: string[]): ImportedBlock;
function OL(start: number, items: string[]): ImportedBlock;
function OL(a: string[] | number, b?: string[]): ImportedBlock {
  return typeof a === "number"
    ? importedOrderedList(b ?? [], a)
    : importedOrderedList(a);
}

interface Example {
  id: string;
  pages: string[];
  expected: ImportedBlock[];
  totalPages: number;
  pagesWithText: number;
  pagesWithoutText: number;
}

// design.md, "Decision: Algoritmo textToBlocks" — the E1-E20 fixture table,
// transcribed verbatim (inputs, outputs and total/conTexto/sinTexto
// counters).
const EXAMPLES: Example[] = [
  {
    id: "E1",
    pages: [
      "INTRODUCCIÓN\nLa memoria de trabajo es limitada.\n\nPor eso conviene repasar.",
    ],
    expected: [
      H(1, "INTRODUCCIÓN"),
      P("La memoria de trabajo es limitada."),
      P("Por eso conviene repasar."),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E2",
    pages: [
      "La mitocondria produce ener-\ngía para la célula y\nparticipa en la apoptosis.",
    ],
    expected: [
      P(
        "La mitocondria produce energía para la célula y participa en la apoptosis.",
      ),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E3",
    pages: ["1. Introducción\n1.1 Contexto histórico\n1.1.1 Antecedentes"],
    expected: [
      H(1, "1. Introducción"),
      H(2, "1.1 Contexto histórico"),
      H(3, "1.1.1 Antecedentes"),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E4",
    pages: ["II. Marco teórico\nCAPÍTULO 2"],
    expected: [H(1, "II. Marco teórico"), H(1, "CAPÍTULO 2")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E5",
    pages: ["Introducción"],
    expected: [P("Introducción")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E6",
    pages: ["1. La célula es la unidad básica."],
    expected: [P("1. La célula es la unidad básica.")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E7",
    pages: [
      "1. Preparar el material\n2. Leer el capítulo\n3. Resumir\n\n1. Conclusiones",
    ],
    expected: [
      OL(["Preparar el material", "Leer el capítulo", "Resumir"]),
      H(1, "1. Conclusiones"),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E8",
    pages: ["3) Tercer paso\n4) Cuarto paso"],
    expected: [OL(3, ["Tercer paso", "Cuarto paso"])],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E9",
    pages: ["- Primera idea\n• Segunda idea\n* Tercera idea"],
    expected: [UL(["Primera idea", "Segunda idea", "Tercera idea"])],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E10",
    pages: ["- Un ítem que continúa\nen la línea siguiente\n\nPárrafo aparte"],
    expected: [
      UL(["Un ítem que continúa en la línea siguiente"]),
      P("Párrafo aparte"),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E11",
    pages: ["Primer párrafo\n\n\n12\nSegundo párrafo"],
    expected: [P("Primer párrafo"), P("Segundo párrafo")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E12",
    pages: ["  Texto\tcon   espacios raros  \r\n"],
    expected: [P("Texto con espacios raros")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E13",
    pages: ["- Viñeta\n1) Ordenado"],
    expected: [UL(["Viñeta"]), OL(["Ordenado"])],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E14",
    pages: ["termina aquí", "y sigue acá"],
    expected: [P("termina aquí"), P("y sigue acá")],
    totalPages: 2,
    pagesWithText: 2,
    pagesWithoutText: 0,
  },
  {
    id: "E15",
    pages: ["Página uno.", "   \n\n", "Página tres."],
    expected: [P("Página uno."), P("Página tres.")],
    totalPages: 3,
    pagesWithText: 2,
    pagesWithoutText: 1,
  },
  {
    id: "E16",
    pages: ["", " \n\t", "   "],
    expected: [],
    totalPages: 3,
    pagesWithText: 0,
    pagesWithoutText: 3,
  },
  {
    id: "E17",
    pages: ["", "12"],
    expected: [],
    totalPages: 2,
    pagesWithText: 1,
    pagesWithoutText: 1,
  },
  {
    id: "E18",
    pages: ["Objetivos:\nADN Y ARN.\nUNESCO"],
    expected: [P("Objetivos: ADN Y ARN."), H(1, "UNESCO")],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E19",
    pages: [
      "1. Primer punto largo que\nsigue en otra línea.\n2. Segundo punto",
    ],
    expected: [
      H(1, "1. Primer punto largo que"),
      P("sigue en otra línea."),
      H(1, "2. Segundo punto"),
    ],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
  {
    id: "E20",
    pages: ["1. Uno\n\n2. Dos"],
    expected: [OL(["Uno"]), OL(2, ["Dos"])],
    totalPages: 1,
    pagesWithText: 1,
    pagesWithoutText: 0,
  },
];

describe("textToBlocks", () => {
  it.each(EXAMPLES)("$id: matches the design.md fixture table", ({
    pages,
    expected,
    totalPages,
    pagesWithText,
    pagesWithoutText,
  }) => {
    const result = textToBlocks(pages);

    expect(result.doc).toEqual({ type: "doc", content: expected });
    expect(result.totalPages).toBe(totalPages);
    expect(result.pagesWithText).toBe(pagesWithText);
    expect(result.pagesWithoutText).toBe(pagesWithoutText);
    expect(result.pagesWithText + result.pagesWithoutText).toBe(
      result.totalPages,
    );
  });

  // T2 (odd/tasks/document-import.md): every document textToBlocks emits
  // must be one the strict import schema (and so the editor) accepts.
  it.each(EXAMPLES)("$id: produces a document inside the content catalogue", ({
    pages,
  }) => {
    const { doc } = textToBlocks(pages);
    if (doc.content.length === 0) return;
    expect(findCatalogueViolations(doc)).toEqual([]);
  });

  describe("rule branches not exercised by the E1-E20 table", () => {
    it("returns an empty document for an empty pages array", () => {
      const result = textToBlocks([]);

      expect(result.doc).toEqual({ type: "doc", content: [] });
      expect(result.totalPages).toBe(0);
      expect(result.pagesWithText).toBe(0);
      expect(result.pagesWithoutText).toBe(0);
    });

    it("keeps the space and the hyphen (R7) when the next line does not start lowercase", () => {
      const result = textToBlocks(["Vive en Espa-\nÑa"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("Vive en Espa- Ña")],
      });
    });

    it("rejects a heading-shaped line longer than 80 characters (R5)", () => {
      const longUppercase = "TEXTO ".repeat(15).trim();
      expect(longUppercase.length).toBeGreaterThan(80);

      const result = textToBlocks([longUppercase]);

      expect(result.doc).toEqual({ type: "doc", content: [P(longUppercase)] });
    });

    it("treats a line with no letters as paragraph text, never a heading (R5)", () => {
      const result = textToBlocks(["10. 20"]);

      expect(result.doc).toEqual({ type: "doc", content: [P("10. 20")] });
    });

    it("closes an open paragraph when a bullet item follows without a blank line (R9)", () => {
      const result = textToBlocks(["Texto normal\n- Item"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("Texto normal"), UL(["Item"])],
      });
    });

    it("closes an open paragraph when an ordered item follows without a blank line (R9)", () => {
      const result = textToBlocks(["Texto normal\n1) Item"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("Texto normal"), OL(["Item"])],
      });
    });

    it("appends a continuation line to an open ordered list item (R8)", () => {
      const result = textToBlocks(["1) Primer punto\ncontinúa aquí"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [OL(["Primer punto continúa aquí"])],
      });
    });

    it("removes the soft hyphen (U+00AD), an invisible formatting character (R1)", () => {
      const result = textToBlocks(["pala­bra completa"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("palabra completa")],
      });
    });

    it("uses the numeric prefix level even when the rest of the line is uppercase (R6: prefix decides)", () => {
      const result = textToBlocks(["1.1 SECCIÓN DOS"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [H(2, "1.1 SECCIÓN DOS")],
      });
    });

    // T3 follow-up (R3-bare-number-heading): a bare integer followed by
    // text is ordinary prose, not a heading — only "N." (with the dot)
    // is a single-level numeric heading prefix.
    it("treats a bare integer followed by text as a paragraph, not a heading (R3-bare-number-heading)", () => {
      const result = textToBlocks(["3 manzanas rojas"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("3 manzanas rojas")],
      });
    });

    it("treats a 4-digit number followed by text as a paragraph, not a heading (R3-bare-number-heading)", () => {
      const result = textToBlocks(["2020 fue un año difícil"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [P("2020 fue un año difícil")],
      });
    });

    it("still reads a single-level numeric prefix as a heading when the dot is present", () => {
      const result = textToBlocks(["3. Manzanas rojas"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [H(1, "3. Manzanas rojas")],
      });
    });

    it("reads a multi-level numeric prefix as a heading even without a trailing dot (R3-bare-number-heading)", () => {
      const result = textToBlocks(["1.2.3 Subsección"]);

      expect(result.doc).toEqual({
        type: "doc",
        content: [H(3, "1.2.3 Subsección")],
      });
    });
  });
});
