import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import type { ExtractedDocument } from "../../domain/document-extractor";
import { FakeDocumentExtractor } from "./fake-document-extractor";

const EXTRACTED: ExtractedDocument = {
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
  },
  totalPages: 2,
  pagesWithoutText: 1,
  images: [],
};

describe("FakeDocumentExtractor", () => {
  it("defaults to an empty document with zero pages when no result was set", async () => {
    const extractor = new FakeDocumentExtractor();
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await extractor.extract(bytes, "pdf");

    expect(result).toEqual(
      ok({
        content: { type: "doc", content: [] },
        totalPages: 0,
        pagesWithoutText: 0,
        images: [],
      }),
    );
    expect(extractor.extractCalls).toEqual([{ bytes, format: "pdf" }]);
  });

  it("returns the configured success result and records every call with its format", async () => {
    const extractor = new FakeDocumentExtractor();
    extractor.setResult(ok(EXTRACTED));

    const first = await extractor.extract(new Uint8Array([1]), "docx");
    const second = await extractor.extract(new Uint8Array([2]), "pptx");

    expect(first).toEqual(ok(EXTRACTED));
    expect(second).toEqual(ok(EXTRACTED));
    expect(extractor.extractCalls.map((call) => call.format)).toEqual([
      "docx",
      "pptx",
    ]);
  });

  it("returns the configured failure result", async () => {
    const extractor = new FakeDocumentExtractor();
    const failure = new DomainError("DOCUMENT_UNREADABLE", "encrypted");
    extractor.setResult(err(failure));

    const result = await extractor.extract(new Uint8Array([1]), "pdf");

    expect(result).toEqual(err(failure));
  });
});
