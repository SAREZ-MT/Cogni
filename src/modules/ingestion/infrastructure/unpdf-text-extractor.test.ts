import { describe, expect, it } from "vitest";
import {
  makeCorruptPdfBytes,
  makeMinimalPdf,
  makeNoTextPdf,
} from "../../../../tests/fixtures/pdf/make-minimal-pdf";
import { UnpdfTextExtractor } from "./unpdf-text-extractor";

// design.md, "unpdf 1.8.1": UnpdfTextExtractor wraps getDocumentProxy +
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
});
