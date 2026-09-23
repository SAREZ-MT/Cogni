import { describe, expect, it } from "vitest";
import {
  hasTextContent,
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
});
