import { describe, expect, it } from "vitest";
import { ok } from "@/shared/kernel/result";
import { FakeDocumentExtractor } from "../application/testing/fake-document-extractor";
import type { ExtractedDocument } from "../domain/document-extractor";
import {
  createDocumentExtractor,
  FormatRoutingDocumentExtractor,
} from "./format-routing-document-extractor";

const EXTRACTED: ExtractedDocument = {
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
  },
  totalPages: 1,
  pagesWithoutText: 0,
  images: [],
};

// T5 (document-import): the composite every Server Action composes. It
// dispatches by the detected format; a format with no registered adapter
// (docx/pptx until T6/T7) is refused as unsupported instead of throwing.
describe("FormatRoutingDocumentExtractor", () => {
  it("dispatches to the adapter registered for the format, passing bytes and format through", async () => {
    const pdf = new FakeDocumentExtractor();
    pdf.setResult(ok(EXTRACTED));
    const docx = new FakeDocumentExtractor();
    const extractor = new FormatRoutingDocumentExtractor({ pdf, docx });
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await extractor.extract(bytes, "pdf");

    expect(result).toEqual(ok(EXTRACTED));
    expect(pdf.extractCalls).toEqual([{ bytes, format: "pdf" }]);
    expect(docx.extractCalls).toHaveLength(0);
  });

  it("refuses a format with no registered adapter with DOCUMENT_UNSUPPORTED_FORMAT", async () => {
    const pdf = new FakeDocumentExtractor();
    const extractor = new FormatRoutingDocumentExtractor({ pdf });

    const result = await extractor.extract(new Uint8Array([1]), "pptx");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
    expect(pdf.extractCalls).toHaveLength(0);
  });

  it("createDocumentExtractor wires the PDF adapter and leaves docx/pptx unsupported until T6/T7", async () => {
    const extractor = createDocumentExtractor();

    const docx = await extractor.extract(new Uint8Array([1]), "docx");
    const pptx = await extractor.extract(new Uint8Array([1]), "pptx");
    // Real unpdf call: garbage bytes reach the PDF adapter and fail as
    // unreadable, proving the pdf route is wired (not refused).
    const pdf = await extractor.extract(new Uint8Array([1, 2, 3, 4]), "pdf");

    expect(!docx.ok && docx.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
    expect(!pptx.ok && pptx.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
    expect(!pdf.ok && pdf.error.code).toBe("DOCUMENT_UNREADABLE");
  });
});
