import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import {
  makeCorruptPdfBytes,
  makeMinimalPdf,
  makeNoTextPdf,
  makeTextPdf,
} from "../../../../tests/fixtures/pdf/make-minimal-pdf";
import { textToBlocks } from "../domain/text-to-blocks";
import { PdfDocumentExtractor } from "./pdf-document-extractor";

// Vitest runs this file under jsdom (vitest.config.ts), where officeparser
// takes itself for a browser (`window.document` exists) and runs pdf.js
// the browser way, which fails without DOMMatrix. The server is plain
// Node: tell officeparser so, as it would detect it there. It reads the
// flag at call time.
beforeAll(() => {
  const officeparserRequire = createRequire(require.resolve("officeparser"));
  officeparserRequire("./utils/envUtils.js").isBrowser = false;
});

// PdfDocumentExtractor on PDFs built by tests/fixtures/pdf/make-minimal-pdf.ts
// (real bytes, real officeparser run, nothing mocked). These PDFs hold
// plain paragraphs only, so they take the textToBlocks fallback
// (document-import T8): their output must stay what the unpdf + textToBlocks
// pipeline produced before T8. The structured path and the T1 fixtures are
// covered by pdf-document-extractor.golden.test.ts.
describe("PdfDocumentExtractor", () => {
  it("converts a plain-text page with textToBlocks (behaviour-identical to the pre-T8 pipeline)", async () => {
    const extractor = new PdfDocumentExtractor();

    const result = await extractor.extract(
      makeMinimalPdf("Hello World"),
      "pdf",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = textToBlocks(["Hello World"]);
    expect(result.value).toEqual({
      content: expected.doc,
      totalPages: 1,
      pagesWithoutText: 0,
      images: [],
      skippedImages: 0,
    });
  });

  it("reports a real page with no text operators as a page without text (not an error)", async () => {
    const extractor = new PdfDocumentExtractor();

    const result = await extractor.extract(makeNoTextPdf(), "pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(1);
    expect(result.value.pagesWithoutText).toBe(1);
    expect(result.value.content).toEqual({ type: "doc", content: [] });
  });

  it("returns err(DOCUMENT_FILE_ERROR.UNREADABLE) when the parser cannot open the file", async () => {
    const extractor = new PdfDocumentExtractor();

    const result = await extractor.extract(makeCorruptPdfBytes(), "pdf");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });

  it("never throws for garbage bytes unrelated to the PDF format", async () => {
    const extractor = new PdfDocumentExtractor();

    const result = await extractor.extract(new Uint8Array([1, 2, 3, 4]), "pdf");

    expect(result.ok).toBe(false);
  });

  it("refuses a format other than pdf with DOCUMENT_UNSUPPORTED_FORMAT", async () => {
    const extractor = new PdfDocumentExtractor();

    const result = await extractor.extract(makeMinimalPdf("Hola"), "docx");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
  });

  // T12: makeTextPdf builds a multi-page PDF the same byte-exact way as
  // makeMinimalPdf, reused by tests/e2e/pdf-import.spec.ts for the 30-page
  // happy-path fixture. Asserting `toContain` (not exact equality) on each
  // page's text because pdf.js's own line-break heuristics inside a page
  // are an implementation detail this test does not need to pin down.
  it("extracts multiple pages, each with several lines, in order", async () => {
    const extractor = new PdfDocumentExtractor();
    const pdf = makeTextPdf([
      "CAPITULO 1\nPrimera linea del capitulo uno.\nSegunda linea del capitulo uno.",
      "CAPITULO 2\nPrimera linea del capitulo dos.",
      "CAPITULO 3\nUnica linea del capitulo tres.",
    ]);

    const result = await extractor.extract(pdf, "pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pagesWithoutText).toBe(0);
    const text = JSON.stringify(result.value.content);
    const order = [
      "CAPITULO 1",
      "Primera linea del capitulo uno.",
      "Segunda linea del capitulo uno.",
      "CAPITULO 2",
      "Primera linea del capitulo dos.",
      "CAPITULO 3",
      "Unica linea del capitulo tres.",
    ].map((line) => text.indexOf(line));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("throws when makeTextPdf is given no pages, instead of building an invalid PDF", () => {
    expect(() => makeTextPdf([])).toThrow();
  });

  // document-import T9b (audit: no page cap, parsing outside the budget);
  // T8 moved the caps onto officeparser's AST.
  describe("limits", () => {
    it("refuses a PDF over the page cap (officeparser reads at most the cap)", async () => {
      const result = await new PdfDocumentExtractor({ maxPages: 3 }).extract(
        makeTextPdf(["uno", "dos", "tres", "cuatro"]),
        "pdf",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    });

    it("caps real documents at 300 pages by default", async () => {
      const pages = Array.from({ length: 301 }, (_, i) => `Pagina ${i + 1}`);
      const result = await new PdfDocumentExtractor().extract(
        makeTextPdf(pages),
        "pdf",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    });

    it("accepts a document exactly at the page cap", async () => {
      const result = await new PdfDocumentExtractor({ maxPages: 3 }).extract(
        makeTextPdf(["uno", "dos", "tres"]),
        "pdf",
      );

      expect(result.ok && result.value.totalPages).toBe(3);
    });

    it("refuses a page with more text than the per-page cap", async () => {
      const result = await new PdfDocumentExtractor({
        maxPageChars: 10,
      }).extract(makeTextPdf(["corto", "una linea demasiado larga"]), "pdf");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    });

    it("refuses a document whose pages together exceed the total text cap", async () => {
      const result = await new PdfDocumentExtractor({
        maxTotalChars: 12,
      }).extract(makeTextPdf(["seis 6", "seis 6", "seis 6"]), "pdf");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    });

    it("stops between pages once the signal is aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await new PdfDocumentExtractor().extract(
        makeTextPdf(["uno", "dos"]),
        "pdf",
        { signal: controller.signal },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
    });
  });
});
