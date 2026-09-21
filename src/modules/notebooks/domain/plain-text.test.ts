import { describe, expect, it } from "vitest";
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
});
