import { describe, expect, it } from "vitest";
import { splitParagraphs } from "@/shared/kernel/page-paragraphs";
import { CATALOGUE_SAMPLE_DOC } from "@/shared/kernel/testing/catalogue-sample-doc";
import {
  extractPlainText,
  type TiptapDoc,
  type TiptapNode,
} from "./plain-text";

function text(value: string): TiptapNode {
  return { type: "text", text: value };
}

describe("extractPlainText", () => {
  it("returns an empty string for a document without content", () => {
    expect(extractPlainText({ type: "doc" })).toBe("");
  });

  it("returns an empty string for a document with empty content", () => {
    expect(extractPlainText({ type: "doc", content: [] })).toBe("");
  });

  it("returns an empty string for null/undefined input", () => {
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
  });

  it(
    "joins heading, paragraph and list blocks with newlines, ignoring marks " +
      "(Scenario: Documento con varios bloques)",
    () => {
      const doc: TiptapDoc = {
        type: "doc",
        content: [
          { type: "heading", content: [text("Tema")] },
          {
            type: "paragraph",
            content: [
              text("Hola "),
              { ...text("mundo"), marks: [{ type: "bold" }] },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [text("item 1")] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [text("item 2")] }],
              },
            ],
          },
        ],
      };

      expect(extractPlainText(doc)).toBe("Tema\nHola mundo\nitem 1\nitem 2");
    },
  );

  it("hardBreak contributes a newline inside the same block", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("linea 1"), { type: "hardBreak" }, text("linea 2")],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("linea 1\nlinea 2");
  });

  it("separates table cells with a tab and rows with a newline", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [text("a")] },
                { type: "tableCell", content: [text("b")] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [text("c")] },
                { type: "tableCell", content: [text("d")] },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("a\tb\nc\td");
  });

  it("images and horizontal rules contribute nothing (Scenario: Imagenes y divisores sin aporte)", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        { type: "image", attrs: { storagePath: "x" } },
        { type: "horizontalRule" },
      ],
    };

    expect(extractPlainText(doc)).toBe("");
  });

  it("descends into an unknown node type without throwing (Scenario: Nodo desconocido)", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [{ type: "mysteryNode", content: [text("hola")] }],
    };

    expect(() => extractPlainText(doc)).not.toThrow();
    expect(extractPlainText(doc)).toBe("hola");
  });

  it("keeps blockquote and codeBlock text", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [text("cita")] }],
        },
        { type: "codeBlock", content: [text("const x = 1;")] },
      ],
    };

    expect(extractPlainText(doc)).toBe("cita\nconst x = 1;");
  });

  it("treats a text node without a text field as an empty string", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text" }] }],
    };

    expect(extractPlainText(doc)).toBe("");
  });

  it("returns an empty string for a node with no content", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };

    expect(extractPlainText(doc)).toBe("");
  });

  // specs/editor/spec.md, "Conjunto completo de bloques de §3.2": a
  // callout is a plain block node here (no special-cased type), so its
  // paragraph content contributes the same way blockquote's does.
  it("descends into a callout node's content", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { kind: "warning" },
          content: [{ type: "paragraph", content: [text("cuidado")] }],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("cuidado");
  });

  // specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts": marks
  // (including highlight) never affect the extracted text.
  it("ignores the highlight mark's color attribute", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              ...text("importante"),
              marks: [{ type: "highlight", attrs: { color: "purple" } }],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("importante");
  });

  // H7: the "Texto" menu's font family and size live in a textStyle mark;
  // the AI reads only the words.
  it("ignores textStyle font family and size", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              ...text("Bitter grande"),
              marks: [
                {
                  type: "textStyle",
                  attrs: { fontFamily: "Bitter, serif", fontSize: "22px" },
                },
              ],
            },
            text(" y normal"),
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("Bitter grande y normal");
  });

  // Fingerprint stability (shared/kernel/page-paragraphs.ts): a page that
  // only uses the nodes extractPlainText handled before the catalogue
  // (paragraphs, headings, lists, tables, code, quotes, hard breaks) must
  // keep byte-identical plain text, or incremental generation would treat
  // every paragraph as new. This literal was captured from the previous
  // implementation; do not update it to make a change pass.
  it("keeps the pre-catalogue output byte-identical for classic blocks", () => {
    const p = (...content: TiptapNode[]): TiptapNode => ({
      type: "paragraph",
      content,
    });
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Célula")] },
        p(
          text("La "),
          { ...text("membrana"), marks: [{ type: "bold" }] },
          text(" separa."),
          { type: "hardBreak" },
          text("Segunda línea"),
        ),
        p(),
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                p(text("Núcleo")),
                {
                  type: "orderedList",
                  content: [{ type: "listItem", content: [p(text("ADN"))] }],
                },
              ],
            },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [p(text("Repasar"))],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [p(text("Parte"))] },
                { type: "tableHeader", content: [p(text("Función"))] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [p(text("Ribosoma"))] },
                { type: "tableCell", content: [p()] },
              ],
            },
          ],
        },
        { type: "codeBlock", content: [text("a = 1\n  b = 2")] },
        { type: "blockquote", content: [p(text("Cita")), p(text("Fin"))] },
        { type: "horizontalRule" },
        { type: "image", attrs: { assetId: "x" } },
        p(text("  espacios  ")),
      ],
    };

    expect(extractPlainText(doc)).toBe(
      "Célula\nLa membrana separa.\nSegunda línea\nNúcleo\nADN\nRepasar\n" +
        "Parte\tFunción\nRibosoma\t\na = 1\n  b = 2\nCita\nFin\n  espacios  ",
    );
  });

  describe("catalogue nodes", () => {
    const doc = (...content: TiptapNode[]): TiptapDoc => ({
      type: "doc",
      content,
    });
    const p = (...content: TiptapNode[]): TiptapNode => ({
      type: "paragraph",
      content,
    });

    it("keeps a paragraph with inline atoms on one line", () => {
      expect(
        extractPlainText(
          doc(
            p(
              text("Ver "),
              {
                type: "mention",
                attrs: { id: "m1", label: "Tema", mentionSuggestionChar: "@" },
              },
              text(", "),
              { type: "emoji", attrs: { name: "brain" } },
              text(" y "),
              { type: "inlineMath", attrs: { latex: "x^2" } },
              text("."),
            ),
          ),
        ),
      ).toBe("Ver @Tema, :brain: y x^2.");
    });

    it("prefixes a mention with @ when it has no suggestion char", () => {
      expect(
        extractPlainText(
          doc(p({ type: "mention", attrs: { id: "m1", label: "Tema" } })),
        ),
      ).toBe("@Tema");
    });

    it("drops a mention without a label (its id is not text)", () => {
      expect(
        extractPlainText(
          doc(
            p(
              text("a "),
              { type: "mention", attrs: { id: "m1", label: null } },
              text("b"),
            ),
          ),
        ),
      ).toBe("a b");
    });

    it("writes block math as its LaTeX on its own line", () => {
      expect(
        extractPlainText(
          doc(
            p(text("Antes")),
            { type: "blockMath", attrs: { latex: "\\int_0^1 x\\,dx" } },
            p(text("Después")),
          ),
        ),
      ).toBe("Antes\n\\int_0^1 x\\,dx\nDespués");
    });

    // document-import T9b (security audit): alt text is never shown on the
    // page, so it must not reach search or the AI — only a visible caption
    // does. The alt stays on the node for accessibility.
    it("writes an image's caption only, never its alt", () => {
      expect(
        extractPlainText(
          doc(
            { type: "image", attrs: { caption: "Pie", alt: "Alt" } },
            { type: "image", attrs: { caption: null, alt: "Solo alt" } },
            { type: "image", attrs: { caption: "", alt: "" } },
            { type: "image", attrs: { assetId: "x" } },
          ),
        ),
      ).toBe("Pie");
    });

    it("writes nothing for youtube, horizontalRule and tocBlock", () => {
      expect(
        extractPlainText(
          doc(
            { type: "tocBlock" },
            {
              type: "youtube",
              attrs: { src: "https://www.youtube.com/watch?v=abc" },
            },
            { type: "horizontalRule" },
          ),
        ),
      ).toBe("");
    });

    it("writes details as its summary line then its content lines", () => {
      expect(
        extractPlainText(
          doc({
            type: "details",
            content: [
              { type: "detailsSummary", content: [text("Notas")] },
              {
                type: "detailsContent",
                content: [p(text("Uno")), p(text("Dos"))],
              },
            ],
          }),
        ),
      ).toBe("Notas\nUno\nDos");
    });

    it("writes a task item's text without a checkbox glyph", () => {
      expect(
        extractPlainText(
          doc({
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [p(text("Hecho"))],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [p(text("Pendiente"))],
              },
            ],
          }),
        ),
      ).toBe("Hecho\nPendiente");
    });

    // document-import T5 (T4 review follow-up): an unknown node among
    // inline siblings is treated as inline too, so a future inline node
    // never splits its paragraph into several AI paragraphs.
    it("keeps an unknown node that sits among inline nodes on the same line", () => {
      expect(
        extractPlainText(
          doc(
            p(
              text("a"),
              { type: "futureInline", content: [text("b")] },
              text("c"),
            ),
          ),
        ),
      ).toBe("abc");
    });

    it("still separates sibling blocks when an unknown node sits among known blocks", () => {
      expect(
        extractPlainText(
          doc({
            type: "blockquote",
            content: [
              p(text("uno")),
              { type: "futureBlock", content: [p(text("dos"))] },
            ],
          }),
        ),
      ).toBe("uno\ndos");
    });

    // T4 review follow-up: atom text comes from attrs, so a newline inside
    // it would split a line (and an AI paragraph) where the editor shows
    // one; each run of line breaks becomes a single space instead.
    it("replaces line breaks inside inline atom text with a single space", () => {
      expect(
        extractPlainText(
          doc(
            p(
              text("Ver "),
              { type: "inlineMath", attrs: { latex: "a\\\nb" } },
              text(" y "),
              {
                type: "mention",
                attrs: { id: "m1", label: "Tema\r\nlargo" },
              },
            ),
          ),
        ),
      ).toBe("Ver a\\ b y @Tema largo");
    });

    it("keeps block math and an image caption on a single line, without the alt", () => {
      expect(
        extractPlainText(
          doc(
            {
              type: "blockMath",
              attrs: { latex: "\\begin{aligned}\na &= b\n\\end{aligned}" },
            },
            { type: "image", attrs: { caption: "Figura 1:\n\nderivada" } },
            {
              type: "image",
              attrs: { caption: null, alt: "Gráfico\nde barras" },
            },
          ),
        ),
      ).toBe("\\begin{aligned} a &= b \\end{aligned}\nFigura 1: derivada");
    });

    it("splits the catalogue sample into the expected AI paragraphs", () => {
      const paragraphs = splitParagraphs(
        extractPlainText(CATALOGUE_SAMPLE_DOC),
      );

      expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
        "Derivadas",
        "La derivada mide el cambio instantáneo; no la pendiente media. " +
          "Usa f'(x), H2O, x2",
        "Ver Khan Academy o escribe. Clave y estilo: \\frac{dy}{dx} " +
          ":brain: @Límites",
        "Nivel 6",
        "Todo cambio tiene una tasa.",
        "def f(x):",
        "return x ** 2",
        "Reglas",
        "Constante",
        "Cadena",
        "Producto",
        "f·g' + f'·g",
        "Repasar límites",
        "Practicar derivadas",
        "Regla de la cadena",
        "Función y derivada\tNota",
        "x²\t2x\tPotencias",
        "sen x\tcos x",
        "Recta tangente",
        "La derivada no siempre existe.",
        "Notas del orador",
        "Empieza con un ejemplo.",
        "f'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}",
        "Fin del resumen.",
      ]);
    });
  });
});
