import { describe, expect, it } from "vitest";
import {
  makeCorruptPdfBytes,
  makeMinimalPdf,
  makeNoTextPdf,
  makeTextPdf,
} from "../../../../tests/fixtures/pdf/make-minimal-pdf";
import { UnpdfTextExtractor } from "./unpdf-text-extractor";

// design.md, "unpdf" (exact pin, 1.9.1): UnpdfTextExtractor wraps getDocumentProxy +
// extractText({ mergePages: false }) from `unpdf`. Real PDF bytes, built by
// tests/fixtures/pdf/make-minimal-pdf.ts, so this proves the adapter
// against the actual parsing library instead of a mock.
describe("UnpdfTextExtractor", () => {
  it("extracts one string per page, in order", async () => {
    const extractor = new UnpdfTextExtractor();

    const result = await extractor.extract(makeMinimalPdf("Hello World"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(1);
    expect(result.value.pages).toEqual(["Hello World"]);
  });

  it("returns an empty string for a real page with no text operators (not an error)", async () => {
    const extractor = new UnpdfTextExtractor();

    const result = await extractor.extract(makeNoTextPdf());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(1);
    expect(result.value.pages).toEqual([""]);
  });

  it("returns err(PDF_FILE_ERROR.UNREADABLE) when the parser cannot open the file", async () => {
    const extractor = new UnpdfTextExtractor();

    const result = await extractor.extract(makeCorruptPdfBytes());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PDF_UNREADABLE");
  });

  it("never throws for garbage bytes unrelated to the PDF format", async () => {
    const extractor = new UnpdfTextExtractor();

    const result = await extractor.extract(new Uint8Array([1, 2, 3, 4]));

    expect(result.ok).toBe(false);
  });

  // T12: makeTextPdf builds a multi-page PDF the same byte-exact way as
  // makeMinimalPdf, reused by tests/e2e/pdf-import.spec.ts for the 30-page
  // happy-path fixture. Asserting `toContain` (not exact equality) on each
  // page's text because pdf.js's own line-break heuristics inside a page
  // are an implementation detail this test does not need to pin down.
  it("extracts multiple pages, each with several lines, in order", async () => {
    const extractor = new UnpdfTextExtractor();
    const pdf = makeTextPdf([
      "CAPITULO 1\nPrimera linea del capitulo uno.\nSegunda linea del capitulo uno.",
      "CAPITULO 2\nPrimera linea del capitulo dos.",
      "CAPITULO 3\nUnica linea del capitulo tres.",
    ]);

    const result = await extractor.extract(pdf);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pages).toHaveLength(3);
    expect(result.value.pages[0]).toContain("CAPITULO 1");
    expect(result.value.pages[0]).toContain("Primera linea del capitulo uno.");
    expect(result.value.pages[0]).toContain("Segunda linea del capitulo uno.");
    expect(result.value.pages[1]).toContain("CAPITULO 2");
    expect(result.value.pages[1]).toContain("Primera linea del capitulo dos.");
    expect(result.value.pages[2]).toContain("CAPITULO 3");
    expect(result.value.pages[2]).toContain("Unica linea del capitulo tres.");
  });

  it("throws when makeTextPdf is given no pages, instead of building an invalid PDF", () => {
    expect(() => makeTextPdf([])).toThrow();
  });
});
