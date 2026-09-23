import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { FakePdfTextExtractor } from "./fake-pdf-text-extractor";

describe("FakePdfTextExtractor", () => {
  it("defaults to zero pages when no result was set", async () => {
    const extractor = new FakePdfTextExtractor();
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await extractor.extract(bytes);

    expect(result).toEqual(ok({ totalPages: 0, pages: [] }));
    expect(extractor.extractCalls).toEqual([bytes]);
  });

  it("returns the configured success result and records every call", async () => {
    const extractor = new FakePdfTextExtractor();
    extractor.setResult(ok({ totalPages: 2, pages: ["a", "b"] }));

    const first = await extractor.extract(new Uint8Array([1]));
    const second = await extractor.extract(new Uint8Array([2]));

    expect(first).toEqual(ok({ totalPages: 2, pages: ["a", "b"] }));
    expect(second).toEqual(ok({ totalPages: 2, pages: ["a", "b"] }));
    expect(extractor.extractCalls).toHaveLength(2);
  });

  it("returns the configured failure result", async () => {
    const extractor = new FakePdfTextExtractor();
    const failure = new DomainError("PDF_UNREADABLE", "encrypted");
    extractor.setResult(err(failure));

    const result = await extractor.extract(new Uint8Array([1]));

    expect(result).toEqual(err(failure));
  });
});
