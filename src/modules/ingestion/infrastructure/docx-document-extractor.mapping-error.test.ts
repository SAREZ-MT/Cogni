import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DocxDocumentExtractor } from "./docx-document-extractor";

// T6 review follow-up: a mapping bug (mapDocxModel throwing on a model
// shape it does not expect) must come back as an error Result, which
// processImportJob turns into `invalid_document`, instead of escaping the
// port's Result contract. A separate file because the stub replaces the
// real mapper for every test in it.
vi.mock("./docx-model-mapper", () => ({
  mapDocxModel: vi.fn(async () => {
    throw new TypeError("unexpected mammoth node");
  }),
}));

describe("DocxDocumentExtractor mapping errors", () => {
  it("returns DOCUMENT_UNREADABLE when mapping the mammoth model throws", async () => {
    const bytes = new Uint8Array(
      readFileSync(
        join(
          process.cwd(),
          "tests/fixtures/documents/files/all-constructs.docx",
        ),
      ),
    );

    const result = await new DocxDocumentExtractor().extract(bytes, "docx");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
  });
});
