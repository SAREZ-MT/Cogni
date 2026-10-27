import { describe, expect, it } from "vitest";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import {
  hasTextContent,
  type ImportedBlock,
  type ImportedDoc,
  importedBulletList,
  importedHeading,
  importedListItem,
  importedOrderedList,
  importedParagraph,
  importedText,
} from "./imported-doc";

describe("importedText", () => {
  it("wraps a string in a Tiptap text node", () => {
    expect(importedText("hola")).toEqual({ type: "text", text: "hola" });
  });
});

describe("importedParagraph", () => {
  it("wraps a string in a paragraph node with one text child", () => {
    expect(importedParagraph("hola")).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "hola" }],
    });
  });
});

describe("importedHeading", () => {
  it.each<1 | 2 | 3>([1, 2, 3])("builds a level-%s heading node", (level) => {
    expect(importedHeading(level, "Título")).toEqual({
      type: "heading",
      attrs: { level },
      content: [{ type: "text", text: "Título" }],
    });
  });
});

describe("importedListItem", () => {
  it("wraps a string in a listItem node holding one paragraph", () => {
    expect(importedListItem("ítem")).toEqual({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "ítem" }] },
      ],
    });
  });
});

describe("importedBulletList", () => {
  it("builds a bulletList node with one listItem per string", () => {
    expect(importedBulletList(["uno", "dos"])).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "uno" }] },
          ],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "dos" }] },
          ],
        },
      ],
    });
  });
});

describe("importedOrderedList", () => {
  it("omits attrs.start when the first item number is 1 (spec rule 4)", () => {
    expect(importedOrderedList(["uno", "dos"], 1)).toEqual({
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "uno" }] },
          ],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "dos" }] },
          ],
        },
      ],
    });
  });

  it("omits attrs.start when no start is given", () => {
    expect(importedOrderedList(["uno"])).toEqual({
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "uno" }] },
          ],
        },
      ],
    });
  });

  it("sets attrs.start when the first item number is not 1 (spec rule 4)", () => {
    expect(importedOrderedList(["tres", "cuatro"], 3)).toEqual({
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "tres" }] },
          ],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "cuatro" }] },
          ],
        },
      ],
    });
  });
});

// T4 follow-up (R3-empty-invariant-shallow): `hasTextContent` is what T6's
// `processImportJob` calls before `writeImportedContent`.
describe("hasTextContent", () => {
  it("returns false for a document with no blocks", () => {
    expect(hasTextContent({ type: "doc", content: [] })).toBe(false);
  });

  it("returns true when a paragraph has non-whitespace text", () => {
    expect(
      hasTextContent({ type: "doc", content: [importedParagraph("hola")] }),
    ).toBe(true);
  });

  it("returns false when every paragraph is only whitespace", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedParagraph("   "), importedParagraph("\t\n")],
      }),
    ).toBe(false);
  });

  it("returns true when a heading has non-whitespace text", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedHeading(1, "Título")],
      }),
    ).toBe(true);
  });

  it("returns true when a bullet list item has non-whitespace text", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedBulletList(["  ", "algo"])],
      }),
    ).toBe(true);
  });

  it("returns false when every bullet list item is only whitespace", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedBulletList(["  ", " \t"])],
      }),
    ).toBe(false);
  });

  it("returns true when an ordered list item has non-whitespace text", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedOrderedList(["  ", "algo"])],
      }),
    ).toBe(true);
  });

  it("returns false when every ordered list item is only whitespace", () => {
    expect(
      hasTextContent({
        type: "doc",
        content: [importedOrderedList(["  ", " \t"])],
      }),
    ).toBe(false);
  });

  describe("recursive (every catalogue block)", () => {
    const blank = importedParagraph("  ");
    const cases: Array<[string, ImportedBlock, boolean]> = [
      [
        "a table cell with text",
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [blank] },
                { type: "tableCell", content: [importedParagraph("celda")] },
              ],
            },
          ],
        },
        true,
      ],
      [
        "a table of blank cells",
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [blank] }],
            },
          ],
        },
        false,
      ],
      [
        "speaker notes inside details",
        {
          type: "details",
          content: [
            { type: "detailsSummary" },
            { type: "detailsContent", content: [importedParagraph("notas")] },
          ],
        },
        true,
      ],
      [
        "a callout with text",
        {
          type: "callout",
          attrs: { kind: "note" },
          content: [importedParagraph("ojo")],
        },
        true,
      ],
      [
        "a blockquote of blanks",
        { type: "blockquote", content: [blank] },
        false,
      ],
      [
        "a block equation",
        { type: "blockMath", attrs: { latex: "E=mc^2" } },
        true,
      ],
      [
        "an empty block equation",
        { type: "blockMath", attrs: { latex: " " } },
        false,
      ],
      [
        "an inline equation",
        {
          type: "paragraph",
          content: [{ type: "inlineMath", attrs: { latex: "x^2" } }],
        },
        true,
      ],
      [
        "a code block",
        {
          type: "codeBlock",
          attrs: { language: "python" },
          content: [importedText("x = 1")],
        },
        true,
      ],
      [
        "a nested list",
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [blank, importedOrderedList(["anidado"])],
            },
          ],
        },
        true,
      ],
      [
        "a checked task",
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [importedParagraph("hecho")],
            },
          ],
        },
        true,
      ],
      [
        "an image alone",
        { type: "image", attrs: { assetId: null, caption: null } },
        false,
      ],
      ["a horizontal rule alone", { type: "horizontalRule" }, false],
      ["an empty paragraph", { type: "paragraph" }, false],
    ];

    it.each(cases)("%s → %s", (_label, block, expected) => {
      expect(hasTextContent({ type: "doc", content: [block] })).toBe(expected);
    });
  });
});

// T2: the widened ImportedDoc type is the catalogue seen from ingestion; a
// doc using every block variant must pass the same check
// writeImportedContent applies.
describe("ImportedDoc", () => {
  it("covers only catalogue nodes, marks and attrs", () => {
    const item = (text: string) => importedParagraph(text);
    const doc: ImportedDoc = {
      type: "doc",
      content: [
        importedHeading(1, "Tema"),
        {
          type: "heading",
          attrs: { level: 5, textAlign: "right" },
          content: [importedText("Sub")],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "center", nodeBackground: "mint" },
          content: [
            { type: "text", text: "negrita", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: "enlace",
              marks: [
                { type: "link", attrs: { href: "https://example.com" } },
                { type: "highlight", attrs: { color: "blue" } },
                { type: "textStyle", attrs: { color: "#336699" } },
              ],
            },
            { type: "hardBreak" },
            { type: "inlineMath", attrs: { latex: "a^2" } },
            { type: "emoji", attrs: { name: "star" } },
            { type: "mention", attrs: { id: "page-1", label: "Otra" } },
          ],
        },
        { type: "blockquote", content: [item("cita")] },
        { type: "callout", attrs: { kind: "idea" }, content: [item("idea")] },
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [importedText("x = 1")],
        },
        { type: "horizontalRule" },
        importedBulletList(["uno"]),
        importedOrderedList(["dos"], 2),
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [item("t")],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: { colspan: 2 },
                  content: [item("h")],
                },
              ],
            },
          ],
        },
        {
          type: "image",
          attrs: {
            assetId: "6f1c2b9e-3d4a-4f5b-8c7d-9e0a1b2c3d4e",
            alt: "diagrama",
          },
        },
        {
          type: "details",
          content: [
            {
              type: "detailsSummary",
              content: [importedText("Notas del orador")],
            },
            { type: "detailsContent", content: [item("nota")] },
          ],
        },
        { type: "blockMath", attrs: { latex: "\\int x\\,dx" } },
        { type: "tocBlock" },
        {
          type: "youtube",
          attrs: { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        },
      ],
    };

    expect(findCatalogueViolations(doc)).toEqual([]);
  });
});
