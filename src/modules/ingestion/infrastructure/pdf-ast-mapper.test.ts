import { describe, expect, it } from "vitest";
import type { ImportedBlock } from "../domain/imported-doc";
import {
  hasPdfStructure,
  mapPdfPageImages,
  mapPdfPages,
  type PdfNode,
  pdfPageTextLengths,
} from "./pdf-ast-mapper";

// document-import T8: unit tests of the PDF AST mapper on hand-built
// officeparser 8.2 nodes (the shapes the T0 spike recorded for tagged.pdf
// and untagged.pdf). The golden tests against the real fixtures live in
// pdf-document-extractor.golden.test.ts.

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

type RunOptions = {
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  x?: number;
  y?: number;
  width?: number;
  link?: string;
  linkType?: string;
  color?: string;
};

function run(text: string, options: RunOptions = {}): PdfNode {
  const size = options.size ?? 12;
  const formatting: Record<string, unknown> = {
    font: options.font ?? "Helvetica",
    size: `${size}pt`,
  };
  if (options.bold) formatting.bold = true;
  if (options.italic) formatting.italic = true;
  if (options.color) formatting.color = options.color;
  const node: PdfNode = {
    type: "text",
    text,
    formatting,
    bounds: {
      x: options.x ?? 0,
      y: options.y ?? 100,
      width: options.width ?? text.length * 6,
      height: size,
    },
  };
  if (options.link) {
    node.metadata = {
      link: options.link,
      linkType: options.linkType ?? "external",
    };
  }
  return node;
}

const paragraph = (...children: PdfNode[]): PdfNode => ({
  type: "paragraph",
  children,
});

const page = (pageNumber: number, ...children: PdfNode[]): PdfNode => ({
  type: "page",
  metadata: { pageNumber },
  children,
});

function list(
  text: string,
  listType: "ordered" | "unordered",
  indentation: number,
  itemIndex: number,
  listId: string,
): PdfNode {
  return {
    type: "list",
    metadata: { listType, indentation, itemIndex, listId },
    children: [paragraph(run(text))],
  };
}

const noImages = () => null;

function blocksOf(...children: PdfNode[]): ImportedBlock[] {
  return mapPdfPages([page(1, ...children)], noImages).pages[0].blocks;
}

describe("mapPdfPages: headings and paragraphs", () => {
  it("maps a heading with its level and without the bold every heading run carries", () => {
    expect(
      blocksOf({
        type: "heading",
        metadata: { level: 2, levelSource: "tags" },
        children: [run("Heading Two", { bold: true, size: 18 })],
      }),
    ).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading Two" }],
      },
    ]);
  });

  it("clamps a heading level outside 1–6", () => {
    const [block] = blocksOf({
      type: "heading",
      metadata: { level: 9 },
      children: [run("Deep")],
    });
    expect(block).toMatchObject({ type: "heading", attrs: { level: 6 } });
  });

  it("keeps bold, italic, a monospace run as code, and only safe links", () => {
    const [block] = blocksOf(
      paragraph(
        run("Plain, ", { x: 0 }),
        run("bold", { bold: true, x: 40 }),
        run(", ", { x: 64 }),
        run("italic", { font: "Helvetica-Oblique", italic: true, x: 71 }),
        run(", ", { x: 95 }),
        run("inlineMono", { font: "Courier", x: 100 }),
        run(" ", { x: 170, color: "#0000ee" }),
        run("safe link", { x: 175, link: "https://example.com/docs" }),
        run(" and ", { x: 220 }),
        run("evil link", { x: 250, link: "javascript:alert(1)" }),
        run(".", { x: 300 }),
      ),
    );

    expect(block).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Plain, " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: ", " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
        { type: "text", text: ", " },
        { type: "text", text: "inlineMono", marks: [{ type: "code" }] },
        { type: "text", text: " " },
        {
          type: "text",
          text: "safe link",
          marks: [
            { type: "link", attrs: { href: "https://example.com/docs" } },
          ],
        },
        { type: "text", text: " and evil link." },
      ],
    });
  });

  it("recognises subset-prefixed and styled monospace font names", () => {
    const [block] = blocksOf(
      paragraph(
        run("a ", { x: 0 }),
        run("x", { font: "ABCDEF+CourierNewPS-BoldMT", x: 10 }),
        run(" b", { x: 20 }),
      ),
    );
    expect(block).toMatchObject({
      content: [
        { text: "a " },
        { text: "x", marks: [{ type: "code" }] },
        { text: " b" },
      ],
    });
  });

  it("drops a smaller-size run that officeparser placed out of reading order (a raised superscript)", () => {
    // tagged.pdf: the "2" of "x²" is read first, before the line it sits on.
    const [block] = blocksOf(
      paragraph(
        run("2 ", { size: 10, x: 229, y: 61.3 }),
        run("Plain, x", { x: 6, y: 64.5 }),
        run(", red.", { x: 60, y: 64.5 }),
      ),
    );
    expect(block).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Plain, x, red." }],
    });
  });

  it("keeps an in-order smaller run (a subscript) as plain text", () => {
    const [block] = blocksOf(
      paragraph(
        run("strike, H", { x: 95, y: 64.5, width: 107 }),
        run("2", { size: 10, x: 202, y: 69.2, width: 5.5 }),
        run("O, x", { x: 207.6, y: 64.3 }),
      ),
    );
    expect(block).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "strike, H2O, x" }],
    });
  });

  it("drops a stray paragraph that only holds a short smaller-size run", () => {
    // untagged.pdf: the misplaced superscript becomes a paragraph of its own.
    const blocks = blocksOf(
      paragraph(run("2", { size: 10 })),
      paragraph(run("Body text of normal size.")),
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Body text of normal size." }],
      },
    ]);
  });

  it("drops empty and whitespace-only paragraphs", () => {
    expect(blocksOf(paragraph(run("   ")), paragraph())).toEqual([]);
  });
});

describe("mapPdfPages: code blocks", () => {
  it("turns an all-monospace paragraph into a code block, one line per baseline, trailing spaces trimmed", () => {
    const blocks = blocksOf(
      paragraph(
        run("function add(a, b) { ", { font: "Courier", y: 386 }),
        run("return a + b; ", { font: "Courier", y: 399.5 }),
        run("}", { font: "Courier", y: 413 }),
      ),
    );
    expect(blocks).toEqual([
      {
        type: "codeBlock",
        attrs: { language: null },
        content: [
          { type: "text", text: "function add(a, b) {\nreturn a + b;\n}" },
        ],
      },
    ]);
  });

  it("groups consecutive monospace paragraphs into one code block", () => {
    const blocks = blocksOf(
      paragraph(
        run("function add(a, b) { ", { font: "Courier", y: 386 }),
        run("return a + b;", { font: "Courier", y: 399.5 }),
      ),
      paragraph(run("}", { font: "Courier", y: 413 })),
      paragraph(run("After the code.", { y: 440 })),
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "codeBlock",
      "paragraph",
    ]);
    expect(blocks[0]).toMatchObject({
      content: [{ text: "function add(a, b) {\nreturn a + b;\n}" }],
    });
  });
});

describe("mapPdfPages: lists", () => {
  it("rebuilds nested bullet lists from the flat indentation", () => {
    const blocks = blocksOf(
      list("Bullet A", "unordered", 0, 0, "pdf-list-1"),
      list("Bullet A.1", "unordered", 1, 0, "pdf-list-2"),
      list("Bullet A.1.a", "unordered", 2, 0, "pdf-list-3"),
      list("Bullet B", "unordered", 0, 1, "pdf-list-1"),
    );
    const item = (text: string, ...nested: unknown[]) => ({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text }] },
        ...nested,
      ],
    });
    expect(blocks).toEqual([
      {
        type: "bulletList",
        content: [
          item("Bullet A", {
            type: "bulletList",
            content: [
              item("Bullet A.1", {
                type: "bulletList",
                content: [item("Bullet A.1.a")],
              }),
            ],
          }),
          item("Bullet B"),
        ],
      },
    ]);
  });

  it("starts an ordered list at its first item's itemIndex + 1", () => {
    const blocks = blocksOf(
      list("Number three", "ordered", 0, 2, "pdf-list-4"),
      list("Number sub a", "ordered", 1, 0, "pdf-list-5"),
      list("Number four", "ordered", 0, 3, "pdf-list-4"),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          content: [
            { content: [{ text: "Number three" }] },
            {
              type: "orderedList",
              content: [{ content: [{ content: [{ text: "Number sub a" }] }] }],
            },
          ],
        },
        { content: [{ content: [{ text: "Number four" }] }] },
      ],
    });
    expect(
      (blocks[0] as { content: { content: { attrs?: unknown }[] }[] })
        .content[0].content[1].attrs,
    ).toBeUndefined();
  });

  it("separates a bullet list from a following ordered list", () => {
    const blocks = blocksOf(
      list("Bullet B", "unordered", 0, 1, "pdf-list-1"),
      list("Number three", "ordered", 0, 2, "pdf-list-4"),
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "bulletList",
      "orderedList",
    ]);
  });

  it("reads a geometric list item whose runs sit directly under the list node", () => {
    const blocks = blocksOf({
      type: "list",
      metadata: { listType: "ordered", indentation: 0, itemIndex: 0 },
      children: [run("First")],
    });
    expect(blocks).toEqual([
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "First" }] },
            ],
          },
        ],
      },
    ]);
  });
});

describe("mapPdfPages: tables", () => {
  const cell = (
    text: string,
    row: number,
    col: number,
    header = false,
  ): PdfNode => ({
    type: "cell",
    metadata: header ? { row, col, style: "header" } : { row, col },
    children: text ? [paragraph(run(text))] : [],
  });

  it("maps header cells to tableHeader and pads ragged rows (spans are lost)", () => {
    const [table] = blocksOf({
      type: "table",
      children: [
        {
          type: "row",
          children: [
            cell("H1", 0, 0, true),
            cell("H2", 0, 1, true),
            cell("H3", 0, 2, true),
          ],
        },
        { type: "row", children: [cell("Colspan 2", 1, 0), cell("", 1, 1)] },
      ],
    });
    const attrs = { colspan: 1, rowspan: 1, colwidth: null };
    const text = (value: string) => [
      { type: "paragraph", content: [{ type: "text", text: value }] },
    ];
    expect(table).toEqual({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: ["H1", "H2", "H3"].map((value) => ({
            type: "tableHeader",
            attrs,
            content: text(value),
          })),
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", attrs, content: text("Colspan 2") },
            { type: "tableCell", attrs, content: [{ type: "paragraph" }] },
            { type: "tableCell", attrs, content: [{ type: "paragraph" }] },
          ],
        },
      ],
    });
  });

  it("drops a table without rows", () => {
    expect(blocksOf({ type: "table", children: [] })).toEqual([]);
  });
});

describe("mapPdfPages: images", () => {
  const image = (name: string): PdfNode => ({
    type: "image",
    metadata: { attachmentName: name },
  });

  it("emits an image block with a pendingId and no alt, and its ExtractedImage", () => {
    const mapped = mapPdfPages(
      [page(1, image("pdf_image_p1_1.png"))],
      (name) => (name === "pdf_image_p1_1.png" ? PNG : null),
    );
    expect(mapped.pages[0].blocks).toEqual([
      {
        type: "image",
        attrs: { assetId: null, pendingId: "image-1", alt: null },
      },
    ]);
    expect(mapped.images).toEqual([
      { key: "image-1", bytes: PNG, mime: "image/png", alt: null },
    ]);
    expect(mapped.skippedImages).toBe(0);
  });

  it("skips and counts a missing attachment or bytes that are no importable image", () => {
    const mapped = mapPdfPages(
      [page(1, image("missing.png"), image("weird.bin"))],
      (name) => (name === "weird.bin" ? new Uint8Array([1, 2, 3]) : null),
    );
    expect(mapped.pages[0].blocks).toEqual([]);
    expect(mapped.images).toEqual([]);
    expect(mapped.skippedImages).toBe(2);
  });

  it("applies the image count, per-image and total caps", () => {
    const big = new Uint8Array(32);
    big.set(PNG);
    const mapped = mapPdfPages(
      [page(1, image("a"), image("b"), image("c"), image("d"))],
      (name) => (name === "b" ? big : PNG),
      { maxImages: 2, maxImageBytes: 16, maxTotalBytes: 1000 },
    );
    // a kept, b over the per-image cap, c kept, d over the count cap.
    expect(mapped.images.map((entry) => entry.key)).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(mapped.skippedImages).toBe(2);

    const total = mapPdfPages([page(1, image("a"), image("b"))], () => PNG, {
      maxImages: 10,
      maxImageBytes: 16,
      maxTotalBytes: 20,
    });
    expect(total.images).toHaveLength(1);
    expect(total.skippedImages).toBe(1);
  });

  it("mapPdfPageImages keeps only each page's images, for the text fallback", () => {
    const mapped = mapPdfPageImages(
      [
        page(1, paragraph(run("Text")), image("p1")),
        page(2, paragraph(run("More"))),
      ],
      () => PNG,
    );
    expect(
      mapped.pages.map((entry) => entry.blocks.map((b) => b.type)),
    ).toEqual([["image"], []]);
    expect(mapped.images).toHaveLength(1);
  });
});

describe("mapPdfPages: pages and notes", () => {
  it("returns one entry per page node, in order, telling whether it holds text", () => {
    const mapped = mapPdfPages(
      [
        page(1, paragraph(run("Uno"))),
        page(2, { type: "image", metadata: { attachmentName: "x" } }),
      ],
      () => PNG,
    );
    expect(
      mapped.pages.map((entry) => [entry.pageNumber, entry.hasText]),
    ).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it("emits footnotes (a note node or a run's notes) as paragraphs at the end of their page", () => {
    const anchor = run("Body with a note.");
    anchor.notes = [{ type: "note", children: [paragraph(run("Run note."))] }];
    const blocks = blocksOf(
      paragraph(anchor),
      { type: "note", children: [paragraph(run("Block note."))] },
      paragraph(run("Closing paragraph.")),
    );
    expect(
      blocks.map((block) =>
        "content" in block
          ? (block.content as { text?: string }[])[0]?.text
          : null,
      ),
    ).toEqual([
      "Body with a note.",
      "Closing paragraph.",
      "Run note.",
      "Block note.",
    ]);
  });

  it("ignores node types it does not know, but maps the blocks inside a container", () => {
    const blocks = blocksOf(
      { type: "chart", text: "ignored" },
      { type: "section", children: [paragraph(run("Inside"))] },
    );
    expect(blocks).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Inside" }] },
    ]);
  });
});

describe("hasPdfStructure", () => {
  it("is true when any page holds a heading, a list or a table", () => {
    expect(
      hasPdfStructure([
        page(1, paragraph(run("x"))),
        page(2, list("a", "unordered", 0, 0, "l")),
      ]),
    ).toBe(true);
    expect(hasPdfStructure([page(1, { type: "table", children: [] })])).toBe(
      true,
    );
  });

  it("is false for pages of paragraphs and images only", () => {
    expect(
      hasPdfStructure([
        page(1, paragraph(run("x")), { type: "image", metadata: {} }),
      ]),
    ).toBe(false);
  });
});

describe("pdfPageTextLengths", () => {
  it("counts the characters of every text run per page, notes included", () => {
    const anchor = run("abc");
    anchor.notes = [{ type: "note", children: [paragraph(run("de"))] }];
    expect(
      pdfPageTextLengths([
        page(1, paragraph(anchor), list("fgh", "ordered", 0, 0, "l")),
        page(3, paragraph(run("ij"))),
      ]),
    ).toEqual(
      new Map([
        [1, 8],
        [3, 2],
      ]),
    );
  });
});
