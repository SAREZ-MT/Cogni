import { describe, expect, it } from "vitest";
import {
  alignEnrichments,
  collectEnrichments,
  type ParagraphEnrichment,
} from "./docx-enrichment";
import {
  MAX_TABLE_NESTING,
  type MammothNode,
  mapDocxModel,
} from "./docx-model-mapper";
import { OoxmlLimitError } from "./ooxml-package";

// document-import T6: the mapper on hand-built mammoth models, for the
// cases the all-constructs fixture does not contain (the golden test in
// docx-document-extractor.test.ts covers the fixture end to end).
const text = (value: string): MammothNode => ({ type: "text", value });
const run = (value: string, props: Partial<MammothNode> = {}): MammothNode => ({
  type: "run",
  children: [text(value)],
  ...props,
});
const paragraph = (
  children: MammothNode[],
  props: Partial<MammothNode> = {},
): MammothNode => ({ type: "paragraph", children, ...props });
const doc = (...children: MammothNode[]): MammothNode => ({
  type: "document",
  children,
});
const image = (
  bytes: number[],
  altText: string | null = null,
): MammothNode => ({
  type: "image",
  altText,
  readAsArrayBuffer: async () => new Uint8Array(bytes).buffer,
});
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const EMF = [0x01, 0x00, 0x00, 0x00, 0x6c, 0x00];

const enrichment = (
  value: string,
  extra: Partial<ParagraphEnrichment> = {},
): ParagraphEnrichment => ({
  text: value,
  colors: [],
  math: [],
  list: null,
  ...extra,
});

describe("mapDocxModel", () => {
  it("imports from mammoth alone when officeparser gave nothing", async () => {
    const mapped = await mapDocxModel(
      doc(paragraph([run("Hola", { isBold: true })])),
      null,
    );

    expect(mapped.content).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hola", marks: [{ type: "bold" }] }],
        },
      ],
    });
  });

  it("drops empty paragraphs and whitespace-only ones", async () => {
    const mapped = await mapDocxModel(
      doc(paragraph([]), paragraph([run("Texto")]), paragraph([run("   ")])),
      null,
    );

    expect(mapped.content.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto" }] },
    ]);
  });

  it("keeps the text of links with unsafe or internal targets but drops their mark", async () => {
    const link = (href: string | null, value: string): MammothNode => ({
      type: "hyperlink",
      href,
      children: [run(value)],
    });
    const mapped = await mapDocxModel(
      doc(
        paragraph([
          link("data:text/html,x", "a"),
          link(null, "b"),
          link("mailto:ana@example.com", "c"),
        ]),
      ),
      null,
    );

    expect(mapped.content.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "ab" },
        {
          type: "text",
          text: "c",
          marks: [{ type: "link", attrs: { href: "mailto:ana@example.com" } }],
        },
      ],
    });
  });

  it("gives a monospace run only the code mark (Tiptap's code excludes the others)", async () => {
    const mapped = await mapDocxModel(
      doc(
        paragraph([
          run("ver "),
          run("x()", { font: "Consolas", isBold: true }),
        ]),
      ),
      null,
    );

    expect(mapped.content.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "ver " },
        { type: "text", text: "x()", marks: [{ type: "code" }] },
      ],
    });
  });

  it("turns a paragraph whose every run is monospace into a code block", async () => {
    const mapped = await mapDocxModel(
      doc(
        paragraph([run("let a = 1;", { font: "Courier New" })]),
        paragraph([run("let b = 2;", { font: "Courier New" })]),
      ),
      null,
    );

    expect(mapped.content.content).toEqual([
      {
        type: "codeBlock",
        attrs: { language: null },
        content: [{ type: "text", text: "let a = 1;\nlet b = 2;" }],
      },
    ]);
  });

  it("does not import a colour that most of the body text carries (the Normal style colour) nor pure black", async () => {
    const model = doc(
      paragraph([run("Cuerpo gris "), run("rojo")]),
      paragraph([run("Más cuerpo gris "), run("negro")]),
    );
    const enrichments = [
      enrichment("Cuerpo gris rojo", {
        colors: [
          { start: 0, end: 12, color: "#333333", backgroundColor: null },
          { start: 12, end: 16, color: "#FF0000", backgroundColor: null },
        ],
      }),
      enrichment("Más cuerpo gris negro", {
        colors: [
          { start: 0, end: 16, color: "#333333", backgroundColor: null },
          { start: 16, end: 21, color: "#000000", backgroundColor: null },
        ],
      }),
    ];

    const mapped = await mapDocxModel(model, enrichments);

    expect(mapped.content.content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Cuerpo gris " },
          {
            type: "text",
            text: "rojo",
            marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }],
          },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Más cuerpo gris negro" }],
      },
    ]);
  });

  it("falls back to the equation text when its LaTeX does not validate", async () => {
    const mapped = await mapDocxModel(
      doc(paragraph([run("Ver ")]), paragraph([])),
      [
        enrichment("Ver ", { math: [{ offset: 4, latex: "\\weird{x" }] }),
        enrichment("", { math: [{ offset: 0, latex: "\\frac{a}{b" }] }),
      ],
    );

    expect(mapped.content.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Ver \\weird{x" }] },
      { type: "paragraph", content: [{ type: "text", text: "\\frac{a}{b" }] },
    ]);
  });

  it("splits a paragraph around an inline image and counts unsupported images as skipped", async () => {
    const mapped = await mapDocxModel(
      doc(
        paragraph([
          run("antes"),
          { type: "run", children: [image(PNG, "  Un diagrama  ")] },
          run("después"),
          { type: "run", children: [image(EMF, "metafile")] },
        ]),
      ),
      null,
    );

    expect(mapped.content.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "antes" }] },
      {
        type: "image",
        attrs: { assetId: null, pendingId: "image-1", alt: "Un diagrama" },
      },
      { type: "paragraph", content: [{ type: "text", text: "después" }] },
    ]);
    expect(mapped.images.map((i) => [i.key, i.mime, i.alt])).toEqual([
      ["image-1", "image/png", "Un diagrama"],
    ]);
    expect(mapped.skippedImages).toBe(1);
  });

  it("starts a list item with a paragraph even when it holds only an image", async () => {
    const mapped = await mapDocxModel(
      doc(
        paragraph([{ type: "run", children: [image(PNG)] }], {
          numbering: { level: "0", isOrdered: false },
        }),
      ),
      null,
    );

    expect(mapped.content.content).toEqual([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph" },
              {
                type: "image",
                attrs: { assetId: null, pendingId: "image-1", alt: null },
              },
            ],
          },
        ],
      },
    ]);
  });

  it("maps Heading 7-9 to heading 6 and keeps line breaks as hardBreak", async () => {
    const mapped = await mapDocxModel(
      doc(
        paragraph(
          [
            {
              type: "run",
              children: [
                text("uno"),
                { type: "break", breakType: "line" },
                text("dos"),
              ],
            },
          ],
          { styleId: "Heading8", styleName: "heading 8" },
        ),
      ),
      null,
    );

    expect(mapped.content.content).toEqual([
      {
        type: "heading",
        attrs: { level: 6 },
        content: [
          { type: "text", text: "uno" },
          { type: "hardBreak" },
          { type: "text", text: "dos" },
        ],
      },
    ]);
  });

  it("gives an empty table cell an empty paragraph", async () => {
    const mapped = await mapDocxModel(
      doc({
        type: "table",
        children: [
          {
            type: "tableRow",
            children: [
              { type: "tableCell", colSpan: 1, rowSpan: 1, children: [] },
            ],
          },
        ],
      }),
      null,
    );

    expect(mapped.content.content).toEqual([
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1, colwidth: null },
                content: [{ type: "paragraph" }],
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe("docx enrichment alignment", () => {
  it("collects colour spans, equations and list counters per paragraph, in document order", () => {
    const enrichments = collectEnrichments([
      {
        type: "list",
        metadata: { listId: "3", indentation: 0, itemIndex: 2 },
        children: [
          { type: "text", text: "Item ", formatting: {} },
          { type: "text", text: "rojo", formatting: { color: "#FF0000" } },
          { type: "code", text: "x^2", metadata: { math: "inline" } },
        ],
      },
      {
        type: "table",
        children: [
          {
            type: "row",
            children: [
              {
                type: "cell",
                children: [
                  {
                    type: "paragraph",
                    children: [{ type: "text", text: "C1" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(enrichments).toEqual([
      {
        text: "Item rojo",
        colors: [{ start: 5, end: 9, color: "#FF0000", backgroundColor: null }],
        math: [{ offset: 9, latex: "x^2" }],
        list: { listId: "3", level: 0, itemIndex: 2 },
      },
      { text: "C1", colors: [], math: [], list: null },
    ]);
  });

  it("skips an extra officeparser paragraph and leaves a paragraph read differently unpaired", () => {
    const a = enrichment("A");
    const junk = enrichment("");
    const b = enrichment("B");
    const c = enrichment("C distinto");

    expect(alignEnrichments(["A", "B", "C", "D"], [a, junk, b, c])).toEqual([
      a,
      b,
      null,
      null,
    ]);
  });

  // document-import T9b: nesting is bounded so a crafted document cannot
  // drive the recursive mapping (and every recursive reader of the
  // imported content after it) arbitrarily deep.
  it("refuses tables nested deeper than the cap with a limit error", async () => {
    const nest = (depth: number): MammothNode => {
      let node: MammothNode = paragraph([run("fondo")]);
      for (let level = 0; level < depth; level++) {
        node = {
          type: "table",
          children: [
            {
              type: "tableRow",
              children: [{ type: "tableCell", children: [node] }],
            },
          ],
        };
      }
      return node;
    };

    await expect(
      mapDocxModel(doc(nest(MAX_TABLE_NESTING)), null),
    ).resolves.toBeDefined();
    await expect(
      mapDocxModel(doc(nest(MAX_TABLE_NESTING + 1)), null),
    ).rejects.toBeInstanceOf(OoxmlLimitError);
  });
});
