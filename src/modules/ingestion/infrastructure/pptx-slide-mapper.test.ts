import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "../domain/image-mime";
import {
  mapPptxSlides,
  type OfficeNode,
  type SlideSource,
} from "./pptx-slide-mapper";

// document-import T7: the PPTX mapper on hand-built officeparser nodes,
// for the cases the T1 fixture does not exercise.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const text = (
  value: string,
  formatting: Record<string, unknown> = {},
  metadata?: Record<string, unknown>,
): OfficeNode => ({ type: "text", text: value, formatting, metadata });
const paragraph = (...children: OfficeNode[]): OfficeNode => ({
  type: "paragraph",
  children,
  metadata: {},
});
const title = (value: string): OfficeNode => ({
  type: "heading",
  children: [text(value)],
  metadata: { level: 1 },
});

function slide(
  children: OfficeNode[],
  extra: Partial<SlideSource> = {},
): SlideSource {
  return {
    number: 1,
    titleKind: "title",
    node: { type: "slide", children, metadata: { slideNumber: 1 } },
    tables: [],
    pictures: new Map(),
    ...extra,
  };
}

const noMedia = () => {
  throw new Error("no media");
};

describe("mapPptxSlides", () => {
  it("keeps a list item's soft line break inside the item", () => {
    const { content } = mapPptxSlides(
      [
        slide([
          title("T"),
          {
            type: "list",
            children: [text("First line")],
            metadata: { listType: "unordered", indentation: 0, listId: "1" },
          },
          {
            type: "paragraph",
            children: [text("second line")],
            metadata: { paragraphIndentation: { left: 0 } },
          },
        ]),
      ],
      noMedia,
    );
    expect(content.content[1]).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "First line" },
                { type: "hardBreak" },
                { type: "text", text: "second line" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("turns a line break inside a paragraph into a hard break", () => {
    const { content } = mapPptxSlides(
      [slide([title("T"), paragraph(text("one\ntwo"))])],
      noMedia,
    );
    expect(content.content[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "one" },
        { type: "hardBreak" },
        { type: "text", text: "two" },
      ],
    });
  });

  it("maps equations: inline in a paragraph with text, block when alone, plain text when invalid", () => {
    const math = (latex: string): OfficeNode => ({
      type: "code",
      text: latex,
      metadata: { math: "inline" },
    });
    const { content } = mapPptxSlides(
      [
        slide([
          title("T"),
          paragraph(text("Ratio: "), math("\\frac{a}{b}")),
          paragraph(math("E=mc^{2}")),
          paragraph(text("Bad "), math("\\frac{a")),
        ]),
      ],
      noMedia,
    );
    expect(content.content.slice(1)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Ratio: " },
          { type: "inlineMath", attrs: { latex: "\\frac{a}{b}" } },
        ],
      },
      { type: "blockMath", attrs: { latex: "E=mc^{2}" } },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Bad \\frac{a" }],
      },
    ]);
  });

  it("marks a monospace run as code alone and keeps strike, sub and superscript", () => {
    const { content } = mapPptxSlides(
      [
        slide([
          title("T"),
          paragraph(
            text("x", { font: "Consolas", bold: true }),
            text("y", { strikethrough: true }),
            text("2", { subscript: true }),
            text("3", { superscript: true }),
          ),
        ]),
      ],
      noMedia,
    );
    expect(content.content[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "x", marks: [{ type: "code" }] },
        { type: "text", text: "y", marks: [{ type: "strike" }] },
        { type: "text", text: "2", marks: [{ type: "subscript" }] },
        { type: "text", text: "3", marks: [{ type: "superscript" }] },
      ],
    });
  });

  it("drops the deck's dominant body colour and keeps a minority one; titles never get colour", () => {
    const { content } = mapPptxSlides(
      [
        slide([
          {
            type: "heading",
            children: [text("Coloured title", { color: "#00AA00" })],
          },
          paragraph(
            text("Most of the body text is grey", { color: "#333333" }),
          ),
          paragraph(text("pink", { color: "#FF00AA" })),
        ]),
      ],
      noMedia,
    );
    expect(content.content).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Coloured title" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Most of the body text is grey" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "pink",
            marks: [{ type: "textStyle", attrs: { color: "#ff00aa" } }],
          },
        ],
      },
    ]);
  });

  it("keeps every cell without spans when the XML table does not match officeparser's grid", () => {
    const cell = (value: string): OfficeNode => ({
      type: "cell",
      children: [paragraph(text(value))],
    });
    const { content } = mapPptxSlides(
      [
        slide(
          [
            title("T"),
            {
              type: "table",
              children: [
                { type: "row", children: [cell("a"), cell("b")] },
                { type: "row", children: [cell("c"), cell("")] },
              ],
            },
          ],
          {
            tables: [
              [[{ gridSpan: 2, rowSpan: 1, hMerge: false, vMerge: false }]],
            ],
          },
        ),
      ],
      noMedia,
    );
    const table = content.content[1];
    expect(table.type).toBe("table");
    if (table.type !== "table") return;
    expect(
      table.content.map((row) =>
        row.content.map((c) => [c.type, c.attrs?.colspan, c.content]),
      ),
    ).toEqual([
      [
        [
          "tableHeader",
          1,
          [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
        ],
        [
          "tableHeader",
          1,
          [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
        ],
      ],
      [
        [
          "tableCell",
          1,
          [{ type: "paragraph", content: [{ type: "text", text: "c" }] }],
        ],
        ["tableCell", 1, [{ type: "paragraph" }]],
      ],
    ]);
  });

  it("uploads a picture shown twice once, and skips a picture with no media part", () => {
    const picture = (name: string): OfficeNode => ({
      type: "image",
      text: "",
      metadata: { attachmentName: name, altText: "  Logo  " },
    });
    const reads: string[] = [];
    const pictures = new Map([["logo.png", "ppt/media/logo.png"]]);
    const result = mapPptxSlides(
      [
        slide([title("A"), picture("logo.png")], { pictures }),
        slide([title("B"), picture("logo.png"), picture("missing.png")], {
          number: 2,
          pictures,
        }),
      ],
      (path) => {
        reads.push(path);
        return PNG;
      },
    );
    expect(reads).toEqual(["ppt/media/logo.png"]);
    expect(result.images).toEqual([
      { key: "image-1", bytes: PNG, mime: "image/png", alt: "Logo" },
    ]);
    const images = result.content.content.filter(
      (block) => block.type === "image",
    );
    expect(images).toHaveLength(2);
    expect(result.skippedImages).toBe(1);
  });

  it("stops reading pictures at the count cap and counts the rest as skipped", () => {
    const pictures = new Map([
      ["a.png", "ppt/media/a.png"],
      ["b.png", "ppt/media/b.png"],
    ]);
    const result = mapPptxSlides(
      [
        slide(
          [
            title("T"),
            { type: "image", metadata: { attachmentName: "a.png" } },
            { type: "image", metadata: { attachmentName: "b.png" } },
          ],
          { pictures },
        ),
      ],
      () => PNG,
      { ...IMAGE_LIMITS, maxImages: 1 },
    );
    expect(result.images).toHaveLength(1);
    expect(result.skippedImages).toBe(1);
  });

  it("ignores charts and other nodes officeparser may add", () => {
    const { content } = mapPptxSlides(
      [
        slide([
          title("T"),
          {
            type: "chart",
            text: "",
            metadata: { attachmentName: "chart1.xml" },
          },
          paragraph(text("after")),
        ]),
      ],
      noMedia,
    );
    expect(content.content.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
    ]);
  });
});
