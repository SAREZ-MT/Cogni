import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extractPlainText } from "@/modules/notebooks";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import { processImportJob } from "../application/process-import-job";
import { FakeImportTelemetry } from "../application/testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "../application/testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "../application/testing/fake-pdf-storage-gateway";
import { FixedClock } from "../application/testing/fixed-clock";
import { InMemoryImportJobRepository } from "../application/testing/in-memory-import-job-repository";
import type { ExtractedDocument } from "../domain/document-extractor";
import { detectDocumentFormat } from "../domain/document-format";
import { createImportJob } from "../domain/import-job";
import type {
  ImportedBlock,
  ImportedDoc,
  ImportedInline,
} from "../domain/imported-doc";
import { createDocumentExtractor } from "./format-routing-document-extractor";
import { PptxDocumentExtractor } from "./pptx-document-extractor";

// notebooks' public index (for extractPlainText) loads server-only
// modules; the real `server-only` package throws outside a Server
// Component.
vi.mock("server-only", () => ({}));

// document-import T7: golden test of the PPTX adapter against the T1
// fixture (tests/fixtures/documents/expected/all-constructs.pptx.md lists
// every construct and the block it must become). Real officeparser run:
// nothing is mocked.
const FILES = join(process.cwd(), "tests/fixtures/documents/files");
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(FILES, name)));

const FAKE_ASSET_ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

async function extractAllConstructs(): Promise<ExtractedDocument> {
  const result = await new PptxDocumentExtractor().extract(
    fixture("all-constructs.pptx"),
    "pptx",
  );
  if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);
  return result.value;
}

type AnyNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AnyNode[];
};

function textOf(node: AnyNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

function inlines(block: ImportedBlock): ImportedInline[] {
  return ("content" in block ? (block.content ?? []) : []) as ImportedInline[];
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

const notes = (slide: number) => ({
  type: "details",
  attrs: { open: false },
  content: [
    {
      type: "detailsSummary",
      content: [{ type: "text", text: "Notas del orador" }],
    },
    {
      type: "detailsContent",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `Speaker notes for slide ${slide}.` },
          ],
        },
      ],
    },
  ],
});

const slideTitle = (slide: number) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text: `Slide ${slide} title` }],
});

describe("PptxDocumentExtractor (all-constructs.pptx golden)", () => {
  it("emits every slide in order: its title, its blocks, then its notes", async () => {
    const { content } = await extractAllConstructs();

    expect(content.content.map((block) => block.type)).toEqual([
      "heading", // slide 1
      "bulletList",
      "orderedList",
      "details",
      "heading", // slide 2
      "table",
      "details",
      "heading", // slide 3
      "image",
      "details",
      "heading", // slide 4
      "paragraph",
      "details",
      "heading", // slide 5
      "paragraph",
      "paragraph",
      "details",
    ]);
  });

  it("maps every slide title to a level-2 heading (the page title names the deck)", async () => {
    const { content } = await extractAllConstructs();
    const headings = content.content.filter(
      (block) => block.type === "heading",
    );
    expect(headings).toEqual([1, 2, 3, 4, 5].map(slideTitle));
  });

  it("turns the speaker notes of every slide into a closed details block, without the slide number", async () => {
    const { content } = await extractAllConstructs();
    const details = content.content.filter((block) => block.type === "details");
    expect(details).toEqual([1, 2, 3, 4, 5].map(notes));
  });

  it("rebuilds the three bullet levels as nested lists and the numbered pair as an ordered list", async () => {
    const { content } = await extractAllConstructs();
    const item = (text: string, ...nested: unknown[]) => ({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text }] },
        ...nested,
      ],
    });

    expect(content.content[1]).toEqual({
      type: "bulletList",
      content: [
        item("Level 1 bullet", {
          type: "bulletList",
          content: [
            item("Level 2 bullet", {
              type: "bulletList",
              content: [item("Level 3 bullet")],
            }),
          ],
        }),
      ],
    });
    expect(content.content[2]).toEqual({
      type: "orderedList",
      content: [item("Numbered one"), item("Numbered two")],
    });
  });

  it("maps the table with a header row and the spans from the slide XML, without the covered cells", async () => {
    const { content } = await extractAllConstructs();
    const table = content.content[5];

    expect(table.type).toBe("table");
    if (table.type !== "table") return;
    const rows = table.content.map((row) =>
      row.content.map((cell) => [
        cell.type,
        textOf(cell),
        cell.attrs?.colspan,
        cell.attrs?.rowspan,
        cell.attrs?.colwidth,
      ]),
    );
    expect(rows).toEqual([
      [
        ["tableHeader", "H1", 1, 1, null],
        ["tableHeader", "H2", 1, 1, null],
        ["tableHeader", "H3", 1, 1, null],
      ],
      [
        ["tableCell", "Colspan 2", 2, 1, null],
        ["tableCell", "C3", 1, 1, null],
      ],
      [
        ["tableCell", "Rowspan 2", 1, 2, null],
        ["tableCell", "B2", 1, 1, null],
        ["tableCell", "B3", 1, 1, null],
      ],
      [
        ["tableCell", "C2", 1, 1, null],
        ["tableCell", "C3b", 1, 1, null],
      ],
    ]);
    // The header's bold comes from the source run and is kept.
    const h1 = table.content[0].content[0].content[0];
    expect(h1).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "H1", marks: [{ type: "bold" }] }],
    });
  });

  it("extracts the slide-3 picture once, with its description as alt", async () => {
    const { content, images, skippedImages } = await extractAllConstructs();

    expect(content.content[8]).toEqual({
      type: "image",
      attrs: { assetId: null, pendingId: "image-1", alt: "Blue stripe" },
    });
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      key: "image-1",
      mime: "image/png",
      alt: "Blue stripe",
    });
    expect(images[0].bytes.length).toBeGreaterThan(0);
    expect(skippedImages).toBe(0);
  });

  it("keeps bold, italic, underline, the red colour and the https link; drops the javascript: link, link underlines and black", async () => {
    const { content } = await extractAllConstructs();
    const paragraph = content.content[11];

    expect(inlines(paragraph)).toEqual([
      { type: "text", text: "Bold part", marks: [{ type: "bold" }] },
      { type: "text", text: ", italic", marks: [{ type: "italic" }] },
      { type: "text", text: ", underline", marks: [{ type: "underline" }] },
      {
        type: "text",
        text: ", red",
        marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }],
      },
      {
        type: "text",
        text: ", link",
        marks: [
          { type: "link", attrs: { href: "https://example.com/slides" } },
        ],
      },
      // The underline PowerPoint draws on every hyperlink run is the
      // link's look, not an emphasis: it goes with the link.
      { type: "text", text: ", evil" },
    ]);
  });

  it("keeps the two text-box paragraphs as two paragraphs", async () => {
    const { content } = await extractAllConstructs();
    expect(content.content.slice(14, 16).map(textOf)).toEqual([
      "Body paragraph one.",
      "Body paragraph two on a new line.",
    ]);
  });

  it("counts the slides as pages, none without text", async () => {
    const { totalPages, pagesWithoutText } = await extractAllConstructs();
    expect(totalPages).toBe(5);
    expect(pagesWithoutText).toBe(0);
  });

  it("satisfies the strict content catalogue once pendingId is swapped for an assetId", async () => {
    const { content } = await extractAllConstructs();
    expect(findCatalogueViolations(withAssetIds(content))).toEqual([]);
  });

  it("feeds the speaker notes to the plain text (they are visible once the details block is opened)", async () => {
    const { content } = await extractAllConstructs();
    const plain = extractPlainText(withAssetIds(content) as never);

    expect(plain).toContain("Slide 1 title");
    expect(plain).toContain("Speaker notes for slide 1.");
    expect(plain).toContain("Notas del orador");
    // The image's alt is accessibility text, never AI input.
    expect(plain).not.toContain("Blue stripe");
  });
});

describe("PptxDocumentExtractor errors", () => {
  it("returns DOCUMENT_UNREADABLE for a truncated PPTX", async () => {
    const bytes = fixture("all-constructs.pptx");
    const result = await new PptxDocumentExtractor().extract(
      bytes.subarray(0, Math.floor(bytes.length / 2)),
      "pptx",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  // The e2e corrupt-deck case (tests/e2e/pptx-import.spec.ts) uploads this
  // cut: it must still be detected as pptx (from its local file headers)
  // so the extractor, not detection, rejects it as invalid_document.
  it("detects the 60 % cut of all-constructs.pptx as pptx and fails it as DOCUMENT_UNREADABLE", async () => {
    const bytes = fixture("all-constructs.pptx");
    const cut = bytes.subarray(0, Math.floor(bytes.length * 0.6));

    expect(
      detectDocumentFormat(cut),
      "the e2e corrupt deck would be refused as unsupported, not invalid",
    ).toBe("pptx");
    const result = await new PptxDocumentExtractor().extract(cut, "pptx");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("returns DOCUMENT_UNREADABLE for bytes that are not a ZIP at all", async () => {
    const result = await new PptxDocumentExtractor().extract(
      fixture("garbage.bin"),
      "pptx",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("returns DOCUMENT_UNREADABLE for a Word package handed over as pptx", async () => {
    const result = await new PptxDocumentExtractor().extract(
      fixture("all-constructs.docx"),
      "pptx",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("refuses a format other than pptx with DOCUMENT_UNSUPPORTED_FORMAT", async () => {
    const result = await new PptxDocumentExtractor().extract(
      fixture("all-constructs.pptx"),
      "docx",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
    }
  });

  it("stops with DOCUMENT_UNREADABLE when the budget signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await new PptxDocumentExtractor().extract(
      fixture("all-constructs.pptx"),
      "pptx",
      { signal: controller.signal },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("is registered for pptx in createDocumentExtractor()", async () => {
    const result = await createDocumentExtractor().extract(
      fixture("all-constructs.pptx"),
      "pptx",
    );
    expect(result.ok).toBe(true);
  });

  async function processPptx(bytes: Uint8Array) {
    const ownerId = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
    const storagePath = `${ownerId}/upload-1.pptx`;
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
        fileName: "clase.pptx",
        sizeBytes: bytes.length,
      },
      clock,
    );
    await deps.jobs.create(job);
    deps.storage.put(storagePath, {
      sizeBytes: bytes.length,
      mime: PPTX_MIME,
      bytes,
    });
    const result = await processImportJob(
      { importJobId: job.id },
      deps,
      ownerId,
    );
    return { result, deps };
  }

  it("makes processImportJob fail a truncated PPTX as invalid_document", async () => {
    const bytes = fixture("all-constructs.pptx");
    const { result, deps } = await processPptx(
      bytes.subarray(0, Math.floor(bytes.length * 0.6)),
    );

    expect(result.ok && result.value.status).toBe("failed");
    expect(deps.telemetry.finishedCalls.at(-1)).toMatchObject({
      failure: { kind: "invalid_document" },
    });
  });

  it("makes processImportJob import all-constructs.pptx with its picture stored", async () => {
    const { result, deps } = await processPptx(fixture("all-constructs.pptx"));

    expect(result.ok && result.value.status).toBe("done");
    expect(deps.telemetry.finishedCalls.at(-1)?.failure).toBeUndefined();
    expect(deps.telemetry.finishedCalls.at(-1)?.job).toMatchObject({
      format: "pptx",
      skippedImages: 0,
    });
    expect(deps.notebookPages.storedAssetIds()).toHaveLength(1);
  });
});

// Acceptance budget: a 40-slide deck must finish well inside the 100 s
// processing budget (T0 measured officeparser alone at 48 ms).
describe("PptxDocumentExtractor budget", () => {
  it("extracts large-40s.pptx in well under the processing budget", async () => {
    const bytes = fixture("large-40s.pptx");
    const started = performance.now();

    const result = await new PptxDocumentExtractor().extract(bytes, "pptx");

    const elapsed = performance.now() - started;
    console.info(`large-40s.pptx extracted in ${Math.round(elapsed)} ms`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(40);
    expect(result.value.pagesWithoutText).toBe(0);
    expect(
      result.value.content.content.filter((block) => block.type === "heading"),
    ).toHaveLength(40);
    expect(
      result.value.content.content.filter((block) => block.type === "details"),
    ).toHaveLength(40);
    expect(result.value.images).toHaveLength(8);
    expect(findCatalogueViolations(withAssetIds(result.value.content))).toEqual(
      [],
    );
    // A generous safety net only; the assertions above are the contract.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
