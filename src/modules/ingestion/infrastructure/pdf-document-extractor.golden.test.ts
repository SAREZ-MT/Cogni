// @vitest-environment node
// officeparser takes a jsdom window for a browser and runs pdf.js the
// browser way (no DOMMatrix); these tests need its Node path, as on the
// server.
import { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import { processImportJob } from "../application/process-import-job";
import { FakeImportTelemetry } from "../application/testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "../application/testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "../application/testing/fake-pdf-storage-gateway";
import { FixedClock } from "../application/testing/fixed-clock";
import { InMemoryImportJobRepository } from "../application/testing/in-memory-import-job-repository";
import type { ExtractedDocument } from "../domain/document-extractor";
import { createImportJob } from "../domain/import-job";
import type { ImportedBlock, ImportedDoc } from "../domain/imported-doc";
import { createDocumentExtractor } from "./format-routing-document-extractor";
import { PdfDocumentExtractor } from "./pdf-document-extractor";

vi.mock("server-only", () => ({}));

// document-import T8: golden tests of the PDF adapter against the T1
// fixtures (tests/fixtures/documents/expected/tagged.pdf.md lists every
// construct of tagged.pdf and the block it must become). Real officeparser
// runs (pdf.js in its separate process): nothing is mocked.
const FILES = join(process.cwd(), "tests/fixtures/documents/files");
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(FILES, name)));

const FAKE_ASSET_ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";

// The first officeparser PDF parse starts its pdf.js process (about 1 s
// locally); a generous per-test timeout keeps a slow machine from failing
// on start-up instead of on an assertion.
const PARSE_TIMEOUT_MS = 30_000;

async function extract(name: string): Promise<ExtractedDocument> {
  const result = await new PdfDocumentExtractor().extract(fixture(name), "pdf");
  if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);
  return result.value;
}

type AnyNode = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
  content?: AnyNode[];
};

function textOf(node: AnyNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

function texts(node: AnyNode): AnyNode[] {
  if (node.type === "text") return [node];
  return (node.content ?? []).flatMap(texts);
}

function withAssetIds(doc: ImportedDoc): unknown {
  return JSON.parse(JSON.stringify(doc), (_key, value) => {
    if (value && typeof value === "object" && value.type === "image") {
      const { pendingId: _pendingId, ...attrs } = value.attrs;
      return { ...value, attrs: { ...attrs, assetId: FAKE_ASSET_ID } };
    }
    return value;
  });
}

const item = (text: string, ...nested: unknown[]) => ({
  type: "listItem",
  content: [
    { type: "paragraph", content: [{ type: "text", text }] },
    ...nested,
  ],
});

describe("PdfDocumentExtractor (tagged.pdf golden)", () => {
  // These tests must exercise the server's real path: pdf.js in its
  // separate process, never the degraded in-process parse (T8b).
  it(
    "parses with pdf.js in its separate process, never in-process",
    async () => {
      const reporter = vi.fn();

      const result = await new PdfDocumentExtractor(
        {},
        undefined,
        reporter,
      ).extract(fixture("tagged.pdf"), "pdf");

      expect(result.ok).toBe(true);
      expect(reporter).not.toHaveBeenCalled();
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "emits the blocks of expected/tagged.pdf.md in order",
    async () => {
      const { content } = await extract("tagged.pdf");

      expect(content.content.map((block) => block.type)).toEqual([
        "heading", // 1
        "paragraph", // 2
        "heading", // 3
        "bulletList", // 4
        "orderedList", // 5
        "heading", // 6
        "table", // 7
        "codeBlock", // 8
        "paragraph", // 9 (blockquote)
        "image", // 10
        "paragraph", // 11 LEFTCOL
        "paragraph", // 11 LEFTCOL
        "paragraph", // 11 RIGHTCOL
        "paragraph", // 11 RIGHTCOL
        "paragraph", // 13
      ]);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "rows 1, 3, 6: headings 1–3 from the tags, without bold marks",
    async () => {
      const blocks = (await extract("tagged.pdf")).content.content;
      const headings = blocks.filter((block) => block.type === "heading");
      expect(headings).toEqual([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Fixture Heading One" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading Two" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Heading Three" }],
        },
      ]);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "row 2: bold, italic, code and the safe link survive; the evil link and the misplaced superscript do not",
    async () => {
      const paragraph = (await extract("tagged.pdf")).content
        .content[1] as AnyNode;
      const runs = texts(paragraph);
      const markOf = (text: string) =>
        runs.find((run) => run.text === text)?.marks;

      expect(markOf("bold")).toEqual([{ type: "bold" }]);
      expect(markOf("italic")).toEqual([{ type: "italic" }]);
      expect(markOf("inlineMono")).toEqual([{ type: "code" }]);
      expect(markOf("safe link")).toEqual([
        { type: "link", attrs: { href: "https://example.com/docs" } },
      ]);
      const plain = textOf(paragraph);
      expect(plain.startsWith("Plain, ")).toBe(true);
      expect(plain).toContain("H2O");
      expect(plain).toContain("evil link");
      expect(JSON.stringify(paragraph)).not.toContain("javascript:");
      // Underline, strike, colour, highlight, sub and sup are lost.
      const markTypes = new Set(
        runs.flatMap((run) => (run.marks ?? []).map((mark) => mark.type)),
      );
      expect([...markTypes].sort()).toEqual(["bold", "code", "italic", "link"]);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "row 4: the nested bullet list is rebuilt from the flat indentation",
    async () => {
      const blocks = (await extract("tagged.pdf")).content.content;
      expect(blocks[3]).toEqual({
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
      });
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "row 5: the ordered list starts at 3 and nests its sub-list",
    async () => {
      const blocks = (await extract("tagged.pdf")).content.content;
      expect(blocks[4]).toEqual({
        type: "orderedList",
        attrs: { start: 3 },
        content: [
          item("Number three", {
            type: "orderedList",
            content: [item("Number sub a")],
          }),
          item("Number four"),
        ],
      });
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "row 7: the table keeps its header row; spans are lost and short rows padded",
    async () => {
      const table = (await extract("tagged.pdf")).content.content[6] as AnyNode;
      const rows = (table.content ?? []).map((row) =>
        (row.content ?? []).map((cell) => [cell.type, textOf(cell)]),
      );
      expect(rows).toEqual([
        [
          ["tableHeader", "H1"],
          ["tableHeader", "H2"],
          ["tableHeader", "H3"],
        ],
        [
          ["tableCell", "Colspan 2"],
          ["tableCell", "C3"],
          ["tableCell", ""],
        ],
        [
          ["tableCell", "Rowspan 2"],
          ["tableCell", "B2"],
          ["tableCell", "B3"],
        ],
        [
          ["tableCell", "C2"],
          ["tableCell", "C3b"],
          ["tableCell", ""],
        ],
      ]);
      const spans = (table.content ?? []).flatMap((row) =>
        (row.content ?? []).map((cell) => cell.attrs),
      );
      expect(
        spans.every(
          (attrs) =>
            attrs?.colspan === 1 &&
            attrs?.rowspan === 1 &&
            attrs?.colwidth === null,
        ),
      ).toBe(true);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "row 8: the Courier lines become one code block (indentation lost)",
    async () => {
      const blocks = (await extract("tagged.pdf")).content.content;
      expect(blocks[7]).toEqual({
        type: "codeBlock",
        attrs: { language: null },
        content: [
          { type: "text", text: "function add(a, b) {\nreturn a + b;\n}" },
        ],
      });
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "rows 9, 10: the quote is a plain paragraph and the image an ExtractedImage without alt",
    async () => {
      const { content, images, skippedImages } = await extract("tagged.pdf");
      expect(content.content[8]).toEqual({
        type: "paragraph",
        content: [
          { type: "text", text: "A quoted sentence from someone wise." },
        ],
      });
      expect(content.content[9]).toEqual({
        type: "image",
        attrs: { assetId: null, pendingId: "image-1", alt: null },
      });
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        key: "image-1",
        mime: "image/png",
        alt: null,
      });
      expect(images[0].bytes.length).toBeGreaterThan(0);
      expect(skippedImages).toBe(0);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "rows 11–13: the two columns read left then right, the rule leaves nothing, the closing paragraph follows",
    async () => {
      const blocks = (await extract("tagged.pdf")).content.content;
      const tail = blocks.slice(10).map((block) => textOf(block as AnyNode));
      expect(tail[0]).toMatch(/^LEFTCOL first paragraph/);
      expect(tail[1]).toMatch(/^LEFTCOL second paragraph/);
      expect(tail[2]).toMatch(/^RIGHTCOL first paragraph/);
      expect(tail[3]).toMatch(/^RIGHTCOL second paragraph/);
      // officeparser's mergeHyphenatedWords joins the "two-" / "column"
      // line break (documented loss).
      expect(tail[3]).toContain("twocolumn");
      expect(tail[4]).toBe("After horizontal rule.");
      expect(blocks.some((block) => block.type === "horizontalRule")).toBe(
        false,
      );
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "reports one page with text and passes the catalogue once the image has an asset",
    async () => {
      const result = await extract("tagged.pdf");
      expect(result.totalPages).toBe(1);
      expect(result.pagesWithoutText).toBe(0);
      expect(findCatalogueViolations(withAssetIds(result.content))).toEqual([]);
    },
    PARSE_TIMEOUT_MS,
  );
});

describe("PdfDocumentExtractor (untagged.pdf: officeparser's geometric structure)", () => {
  it(
    "keeps what geometry recovers: the font-size headings, the ordered list, marks, the image and the column order",
    async () => {
      const result = await extract("untagged.pdf");
      const blocks = result.content.content;
      const plain = blocks.map((block) => textOf(block as AnyNode));

      expect(blocks[0]).toEqual({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Fixture Heading One" }],
      });
      expect(
        blocks.some(
          (block) =>
            block.type === "heading" &&
            textOf(block as AnyNode) === "Heading Two",
        ),
      ).toBe(true);
      // The stray superscript paragraph officeparser emits is dropped.
      expect(plain[1]).toMatch(/^Plain, bold, italic/);
      const ordered = blocks.find((block) => block.type === "orderedList");
      expect(ordered).toMatchObject({ attrs: { start: 3 } });
      expect(textOf(ordered as AnyNode)).toContain("Number four");
      expect(blocks.filter((block) => block.type === "image")).toHaveLength(1);
      expect(result.images).toHaveLength(1);

      const all = plain.join("\n");
      const order = [
        "Fixture Heading One",
        "Plain, bold",
        "Heading Two",
        "Bullet A",
        "Number three",
        "Heading Three",
        "Colspan 2",
        "function add(a, b) {",
        "A quoted sentence",
        "LEFTCOL first",
        "LEFTCOL second",
        "RIGHTCOL first",
        "RIGHTCOL second",
      ].map((line) => all.indexOf(line));
      expect(order.every((index) => index >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(all).toContain("After horizontal rule.");
      expect(JSON.stringify(result.content)).not.toContain("javascript:");
      expect(findCatalogueViolations(withAssetIds(result.content))).toEqual([]);
    },
    PARSE_TIMEOUT_MS,
  );
});

describe("PdfDocumentExtractor errors on the fixtures", () => {
  async function processPdf(bytes: Uint8Array) {
    const ownerId = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
    const storagePath = `${ownerId}/upload-1.pdf`;
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
        fileName: "apuntes.pdf",
        sizeBytes: bytes.length,
      },
      clock,
    );
    await deps.jobs.create(job);
    deps.storage.put(storagePath, {
      sizeBytes: bytes.length,
      mime: "application/pdf",
      bytes,
    });
    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      ownerId,
    );
    return { result, deps };
  }

  it(
    "corrupt.pdf fails as invalid_document, not no_text_layer (T1 review follow-up)",
    async () => {
      const direct = await new PdfDocumentExtractor().extract(
        fixture("corrupt.pdf"),
        "pdf",
      );
      expect(direct.ok).toBe(false);
      if (!direct.ok) expect(direct.error.code).toBe("DOCUMENT_UNREADABLE");

      const { result, deps } = await processPdf(fixture("corrupt.pdf"));
      expect(result.ok && result.value.status).toBe("failed");
      expect(deps.telemetry.finishedCalls.at(-1)).toMatchObject({
        failure: { kind: "invalid_document" },
      });
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "scanned.pdf fails as no_text_layer (no OCR) and uploads no image",
    async () => {
      const { result, deps } = await processPdf(fixture("scanned.pdf"));
      expect(result.ok && result.value.status).toBe("failed");
      expect(deps.telemetry.finishedCalls.at(-1)).toMatchObject({
        failure: { kind: "no_text_layer" },
      });
      expect(deps.notebookPages.storedAssetIds()).toHaveLength(0);
    },
    PARSE_TIMEOUT_MS,
  );

  it(
    "imports tagged.pdf end to end with its image stored",
    async () => {
      const { result, deps } = await processPdf(fixture("tagged.pdf"));
      expect(result.ok && result.value.status).toBe("done");
      expect(deps.telemetry.finishedCalls.at(-1)?.failure).toBeUndefined();
      expect(deps.telemetry.finishedCalls.at(-1)?.job).toMatchObject({
        format: "pdf",
        skippedImages: 0,
      });
      expect(deps.notebookPages.storedAssetIds()).toHaveLength(1);
    },
    PARSE_TIMEOUT_MS,
  );
});

// Acceptance budget: a 30-page PDF must finish well inside the 100 s
// processing budget (T0 measured officeparser alone at 0.4 s).
describe("PdfDocumentExtractor budget", () => {
  it("extracts large-30p.pdf in well under the processing budget", async () => {
    const started = performance.now();

    const result = await new PdfDocumentExtractor().extract(
      fixture("large-30p.pdf"),
      "pdf",
    );

    const elapsed = performance.now() - started;
    console.info(`large-30p.pdf extracted in ${Math.round(elapsed)} ms`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const blocks: ImportedBlock[] = result.value.content.content;
    const count = (type: string) =>
      blocks.filter((block) => block.type === type).length;
    expect(result.value.totalPages).toBe(30);
    expect(result.value.pagesWithoutText).toBe(0);
    expect(count("heading")).toBe(90);
    expect(count("table")).toBe(30);
    expect(count("codeBlock")).toBe(30);
    expect(count("bulletList")).toBe(30);
    expect(count("orderedList")).toBe(30);
    expect(result.value.images).toHaveLength(30);
    expect(findCatalogueViolations(withAssetIds(result.value.content))).toEqual(
      [],
    );
    // A generous safety net only; the assertions above are the contract.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);

  // T8b: the abort must stop the parse itself, not only its result. A warm
  // full parse of large-30p.pdf is timed first (after one more to start
  // the pooled pdf.js process); the parse under test is aborted at a
  // quarter of that time. It must end aborted, well before a full parse
  // would, with its pdf.js process killed mid-stream — officeparser ends a
  // process only when the abort finds it reading.
  it("stops the parse mid-stream with DOCUMENT_UNREADABLE when the budget signal fires", async () => {
    const extractor = new PdfDocumentExtractor();
    await extractor.extract(fixture("large-30p.pdf"), "pdf");
    const fullStarted = performance.now();
    const full = await extractor.extract(fixture("large-30p.pdf"), "pdf");
    const fullMs = performance.now() - fullStarted;
    expect(full.ok).toBe(true);

    const kill = vi.spyOn(ChildProcess.prototype, "kill");
    try {
      const controller = new AbortController();
      const started = performance.now();
      const pending = extractor.extract(fixture("large-30p.pdf"), "pdf", {
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), fullMs / 4);

      const result = await pending;
      const elapsed = performance.now() - started;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
        expect(result.error.message).toBe("aborted");
      }
      expect(kill).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(fullMs * 0.75);
    } finally {
      kill.mockRestore();
    }
  }, 30_000);

  it("parses the next PDF normally after an aborted one (the pdf.js process is replaced)", async () => {
    const controller = new AbortController();
    const aborted = new PdfDocumentExtractor().extract(
      fixture("large-30p.pdf"),
      "pdf",
      { signal: controller.signal },
    );
    controller.abort();
    await aborted;

    const result = await new PdfDocumentExtractor().extract(
      fixture("tagged.pdf"),
      "pdf",
    );
    expect(result.ok && result.value.content.content[0].type).toBe("heading");
  }, 30_000);
});
