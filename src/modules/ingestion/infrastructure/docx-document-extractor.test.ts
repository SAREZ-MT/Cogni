import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import { processImportJob } from "../application/process-import-job";
import { FakeImportTelemetry } from "../application/testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "../application/testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "../application/testing/fake-pdf-storage-gateway";
import { FixedClock } from "../application/testing/fixed-clock";
import { InMemoryImportJobRepository } from "../application/testing/in-memory-import-job-repository";
import type { ExtractedDocument } from "../domain/document-extractor";
import { createImportJob } from "../domain/import-job";
import type {
  ImportedBlock,
  ImportedDoc,
  ImportedInline,
  ImportedMark,
} from "../domain/imported-doc";
import { DocxDocumentExtractor } from "./docx-document-extractor";
import { createDocumentExtractor } from "./format-routing-document-extractor";

// document-import T6: golden test of the DOCX adapter against the T1
// fixture (tests/fixtures/documents/expected/all-constructs.docx.md lists
// every construct and the block it must become). Real mammoth and
// officeparser runs: nothing is mocked.
const FILES = join(process.cwd(), "tests/fixtures/documents/files");
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(FILES, name)));

const FAKE_ASSET_ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";

async function extractAllConstructs(): Promise<ExtractedDocument> {
  const result = await new DocxDocumentExtractor().extract(
    fixture("all-constructs.docx"),
    "docx",
  );
  if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);
  return result.value;
}

type AnyNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: ImportedMark[];
  content?: AnyNode[];
};

function walk(node: AnyNode, visit: (node: AnyNode) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

function textOf(node: AnyNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

function inlines(block: ImportedBlock): ImportedInline[] {
  return ("content" in block ? (block.content ?? []) : []) as ImportedInline[];
}

function textNode(block: ImportedBlock, text: string) {
  const node = inlines(block).find(
    (inline) => inline.type === "text" && inline.text === text,
  );
  if (!node || node.type !== "text") {
    throw new Error(`no text node "${text}" in ${JSON.stringify(block)}`);
  }
  return node;
}

// Replaces each image's pendingId with an asset id, as T9 will before the
// write.
function withAssetIds(doc: ImportedDoc): unknown {
  return JSON.parse(JSON.stringify(doc), (_key, value) => {
    if (value && typeof value === "object" && value.type === "image") {
      const { pendingId: _pendingId, ...attrs } = value.attrs;
      return { ...value, attrs: { ...attrs, assetId: FAKE_ASSET_ID } };
    }
    return value;
  });
}

describe("DocxDocumentExtractor (all-constructs.docx golden)", () => {
  it("emits the blocks of expected/all-constructs.docx.md in order", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content.map((block) => block.type)).toEqual([
      "heading", // 1 Title
      "heading", // 2 Heading 1..6
      "heading",
      "heading",
      "heading",
      "heading",
      "heading",
      "paragraph", // 3 inline marks
      "paragraph", // 4 links
      "bulletList", // 5
      "orderedList", // 6
      "taskList", // 7-10
      "table", // 11
      "codeBlock", // 12
      "blockquote", // 13
      "paragraph", // 14 "Equation: " + inlineMath
      "blockMath", // 15
      "blockMath", // 16
      "blockMath", // 17
      "image", // 18 PNG
      "image", // 19 SVG through its PNG fallback
      "horizontalRule", // 20 page break
      "paragraph", // 21
    ]);
  });

  it("maps Title to heading 1 and Heading 1-6 to their levels", async () => {
    const { content } = await extractAllConstructs();
    const headings = content.content.slice(0, 7);

    expect(
      headings.map((block) => [
        block.type === "heading" && block.attrs.level,
        textOf(block),
      ]),
    ).toEqual([
      [1, "Fixture Title"],
      [1, "Heading level 1"],
      [2, "Heading level 2"],
      [3, "Heading level 3"],
      [4, "Heading level 4"],
      [5, "Heading level 5"],
      [6, "Heading level 6"],
    ]);
    // Style colours (Word's blue headings) are not imported as marks.
    for (const heading of headings) {
      for (const inline of inlines(heading)) {
        expect(inline.type === "text" && inline.marks).toBeFalsy();
      }
    }
  });

  it("keeps every inline mark of the formatting paragraph", async () => {
    const { content } = await extractAllConstructs();
    const paragraph = content.content[7];

    expect(textOf(paragraph)).toBe(
      "Plain, bold, italic, underline, strike, H2O, x2, red, highlight, shading, inlineMono.",
    );
    expect(textNode(paragraph, "Plain, ").marks).toBeUndefined();
    expect(textNode(paragraph, "bold").marks).toEqual([{ type: "bold" }]);
    expect(textNode(paragraph, "italic").marks).toEqual([{ type: "italic" }]);
    expect(textNode(paragraph, "underline").marks).toEqual([
      { type: "underline" },
    ]);
    expect(textNode(paragraph, "strike").marks).toEqual([{ type: "strike" }]);
    const twos = inlines(paragraph).filter(
      (inline) => inline.type === "text" && inline.text === "2",
    );
    expect(twos.map((two) => two.type === "text" && two.marks)).toEqual([
      [{ type: "subscript" }],
      [{ type: "superscript" }],
    ]);
    expect(textNode(paragraph, "red").marks).toEqual([
      { type: "textStyle", attrs: { color: "#ff0000" } },
    ]);
    expect(textNode(paragraph, "highlight").marks).toEqual([
      { type: "highlight", attrs: { color: "yellow" } },
    ]);
    expect(textNode(paragraph, "shading").marks).toEqual([
      { type: "textStyle", attrs: { backgroundColor: "#c6efce" } },
    ]);
    expect(textNode(paragraph, "inlineMono").marks).toEqual([{ type: "code" }]);
  });

  it("keeps the https link and drops the javascript: link mark but not its text", async () => {
    const { content } = await extractAllConstructs();
    const paragraph = content.content[8];

    expect(textOf(paragraph)).toBe("Link: safe link and evil link.");
    expect(textNode(paragraph, "safe link").marks).toEqual([
      { type: "link", attrs: { href: "https://example.com/docs" } },
    ]);
    expect(JSON.stringify(paragraph)).not.toContain("javascript");
    expect(JSON.stringify(paragraph)).toContain("evil link");
  });

  it("nests the bullet list three levels deep", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content[9]).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bullet A" }],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Bullet A.1" }],
                    },
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Bullet A.1.a" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bullet B" }],
            },
          ],
        },
      ],
    });
  });

  it("keeps the ordered list start (3) and nests it three levels with default inner starts", async () => {
    const { content } = await extractAllConstructs();
    const list = content.content[10];

    expect(list.type).toBe("orderedList");
    if (list.type !== "orderedList") return;
    expect(list.attrs).toEqual({ start: 3 });
    expect(list.content.map(textOf)).toEqual([
      "Number threeNumber sub aNumber sub i",
      "Number four",
    ]);
    const inner = list.content[0].content[1];
    expect(inner.type).toBe("orderedList");
    if (inner.type !== "orderedList") return;
    expect(inner.attrs).toBeUndefined();
    const innermost = inner.content[0].content[1];
    expect(innermost.type).toBe("orderedList");
    if (innermost.type !== "orderedList") return;
    expect(innermost.attrs).toBeUndefined();
    expect(textOf(innermost)).toBe("Number sub i");
  });

  it("groups SDT and glyph checkboxes into one task list with their checked state", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content[11]).toEqual({
      type: "taskList",
      content: [
        ["Done task (sdt)", true],
        ["Open task (sdt)", false],
        ["Open task (glyph)", false],
        ["Done task (glyph)", true],
      ].map(([text, checked]) => ({
        type: "taskItem",
        attrs: { checked },
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      })),
    });
  });

  it("maps the table with header cells, colspan 2, rowspan 2 and null colwidths", async () => {
    const { content } = await extractAllConstructs();
    const table = content.content[12];

    expect(table.type).toBe("table");
    if (table.type !== "table") return;
    const rows = table.content.map((row) =>
      row.content.map((cell) => [
        cell.type,
        textOf(cell),
        cell.attrs?.colspan,
        cell.attrs?.rowspan,
      ]),
    );
    expect(rows).toEqual([
      [
        ["tableHeader", "H1", 1, 1],
        ["tableHeader", "H2", 1, 1],
        ["tableHeader", "H3", 1, 1],
      ],
      [
        ["tableCell", "Colspan 2", 2, 1],
        ["tableCell", "C3", 1, 1],
      ],
      [
        ["tableCell", "Rowspan 2", 1, 2],
        ["tableCell", "B2", 1, 1],
        ["tableCell", "B3", 1, 1],
      ],
      [
        ["tableCell", "C2", 1, 1],
        ["tableCell", "C3b", 1, 1],
      ],
    ]);
    const header = table.content[0].content[0];
    expect(header.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "H1", marks: [{ type: "bold" }] }],
      },
    ]);
    walk(table as AnyNode, (node) => {
      if (node.type === "tableCell" || node.type === "tableHeader") {
        expect(node.attrs?.colwidth).toBeNull();
      }
    });
  });

  it("joins the Code-style paragraphs into one code block keeping newlines and indentation", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content[13]).toEqual({
      type: "codeBlock",
      attrs: { language: null },
      content: [
        { type: "text", text: "function add(a, b) {\n  return a + b;\n}" },
      ],
    });
  });

  it("maps the Quote-style paragraph to a blockquote without its style colour", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content[14]).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "A quoted sentence from someone wise." },
          ],
        },
      ],
    });
  });

  it("emits inline math with repaired LaTeX and block math for equation-only paragraphs", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content[15]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Equation: " },
        {
          type: "inlineMath",
          attrs: { latex: "\\frac{a}{b} + x^{2} + \\sqrt{y}" },
        },
      ],
    });
    expect(content.content.slice(16, 19)).toEqual([
      { type: "blockMath", attrs: { latex: "\\frac{a+1}{2b}" } },
      { type: "blockMath", attrs: { latex: "\\sqrt{x+y}=\\sum_{i=1}^{n} i" } },
      { type: "blockMath", attrs: { latex: "e^{2x}" } },
    ]);
  });

  it("extracts both images: the PNG with its description as alt, the SVG through its PNG fallback", async () => {
    const { content, images, skippedImages } = await extractAllConstructs();

    expect(content.content.slice(19, 21)).toEqual([
      {
        type: "image",
        attrs: { assetId: null, pendingId: "image-1", alt: "A blue PNG" },
      },
      {
        type: "image",
        attrs: {
          assetId: null,
          pendingId: "image-2",
          alt: "An SVG with PNG fallback",
        },
      },
    ]);
    expect(
      images.map(({ key, mime, alt, bytes }) => ({
        key,
        mime,
        alt,
        size: bytes.length,
      })),
    ).toEqual([
      { key: "image-1", mime: "image/png", alt: "A blue PNG", size: 235 },
      {
        key: "image-2",
        mime: "image/png",
        alt: "An SVG with PNG fallback",
        size: 235,
      },
    ]);
    expect(images[0].bytes.slice(0, 4)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
    expect(skippedImages).toBe(0);
  });

  it("maps the page break to a horizontal rule and keeps the paragraph after it", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content.slice(21)).toEqual([
      { type: "horizontalRule" },
      {
        type: "paragraph",
        content: [{ type: "text", text: "After page break." }],
      },
    ]);
  });

  it("estimates pages as page breaks + 1 and reports no page without text", async () => {
    const extracted = await extractAllConstructs();

    expect(extracted.totalPages).toBe(2);
    expect(extracted.pagesWithoutText).toBe(0);
  });

  it("satisfies the strict content catalogue once pendingId is swapped for an assetId", async () => {
    const { content } = await extractAllConstructs();

    expect(findCatalogueViolations(withAssetIds(content))).toEqual([]);
  });

  it("never emits empty text nodes or a trailing empty paragraph", async () => {
    const { content } = await extractAllConstructs();

    walk(content as AnyNode, (node) => {
      if (node.type === "text") expect(node.text?.length).toBeGreaterThan(0);
    });
    const last = content.content.at(-1);
    expect(last && textOf(last as AnyNode).length).toBeGreaterThan(0);
  });

  it("matches the full JSON snapshot", async () => {
    const { content } = await extractAllConstructs();

    expect(content).toMatchSnapshot();
  });
});

describe("DocxDocumentExtractor errors and wiring", () => {
  it("returns DOCUMENT_UNREADABLE for a truncated DOCX (corrupt.docx)", async () => {
    const result = await new DocxDocumentExtractor().extract(
      fixture("corrupt.docx"),
      "docx",
    );

    expect(!result.ok && result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("returns DOCUMENT_UNREADABLE for bytes that are not a ZIP at all", async () => {
    const result = await new DocxDocumentExtractor().extract(
      fixture("garbage.bin"),
      "docx",
    );

    expect(!result.ok && result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("refuses a format other than docx with DOCUMENT_UNSUPPORTED_FORMAT", async () => {
    const result = await new DocxDocumentExtractor().extract(
      fixture("all-constructs.docx"),
      "pdf",
    );

    expect(!result.ok && result.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
  });

  it("is registered for docx in createDocumentExtractor()", async () => {
    const result = await createDocumentExtractor().extract(
      fixture("all-constructs.docx"),
      "docx",
    );

    expect(result.ok).toBe(true);
  });

  it("makes processImportJob fail corrupt.docx as invalid_document", async () => {
    const ownerId = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
    const storagePath = `${ownerId}/upload-1.docx`;
    const bytes = fixture("corrupt.docx");
    const clock = new FixedClock(new Date("2026-10-26T10:00:00.000Z"));
    const deps = {
      jobs: new InMemoryImportJobRepository(),
      storage: new FakePdfStorageGateway(),
      extractor: createDocumentExtractor(),
      notebookPages: new FakeNotebookPagesPort(),
      telemetry: new FakeImportTelemetry(),
      clock,
    };
    const page = await deps.notebookPages.createPage(ownerId, {
      notebookId: "nb-1",
    });
    if (!page.ok) throw new Error("setup failed");
    const job = createImportJob(
      {
        id: "job-1",
        ownerId,
        pageId: page.value.id,
        storagePath,
        fileName: "notas.docx",
        sizeBytes: bytes.length,
      },
      clock,
    );
    await deps.jobs.create(job);
    deps.storage.put(storagePath, {
      sizeBytes: bytes.length,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes,
    });

    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      ownerId,
    );

    expect(result.ok && result.value.status).toBe("failed");
    expect(deps.telemetry.finishedCalls.at(-1)).toMatchObject({
      failure: { kind: "invalid_document" },
    });
  });
});

// Acceptance budget: a 30-page DOCX must finish well inside the 100 s
// processing budget (T0 measured officeparser alone at 84 ms).
describe("DocxDocumentExtractor budget", () => {
  it("extracts large-30p.docx in well under the processing budget", async () => {
    const bytes = fixture("large-30p.docx");
    const started = performance.now();

    const result = await new DocxDocumentExtractor().extract(bytes, "docx");

    const elapsed = performance.now() - started;
    console.info(`large-30p.docx extracted in ${Math.round(elapsed)} ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(15_000);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(31);
    expect(findCatalogueViolations(withAssetIds(result.value.content))).toEqual(
      [],
    );
  });
});
