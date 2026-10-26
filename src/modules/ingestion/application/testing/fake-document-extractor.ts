import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../../domain/document-extractor";
import type { DocumentFormat } from "../../domain/document-format";

// Test double for the DocumentExtractor port — `processImportJob` never
// touches a parser library directly, so tests control the extracted
// document (or force a failure) instead of feeding real bytes through one.
export class FakeDocumentExtractor implements DocumentExtractor {
  private result: Result<ExtractedDocument, DomainError> | null = null;

  // Records every call (bytes and the format it was asked for) so tests
  // can assert extraction never happens once an earlier step already
  // failed, and that the detected format reached the port.
  readonly extractCalls: Array<{ bytes: Uint8Array; format: DocumentFormat }> =
    [];

  // The result the next (and every subsequent) extract() call returns.
  // Defaults to an empty document with zero pages, matching "no text".
  setResult(result: Result<ExtractedDocument, DomainError>): void {
    this.result = result;
  }

  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    this.extractCalls.push({ bytes, format });
    return (
      this.result ??
      ok({
        content: { type: "doc", content: [] },
        totalPages: 0,
        pagesWithoutText: 0,
        images: [],
        skippedImages: 0,
      })
    );
  }
}
