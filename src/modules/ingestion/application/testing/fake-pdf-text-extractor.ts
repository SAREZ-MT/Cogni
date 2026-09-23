import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { PdfTextExtractor } from "../../domain/pdf-text-extractor";

// Test double for the PdfTextExtractor port — `processImportJob` (T6)
// never touches `unpdf` directly, so tests control extraction output (or
// force a failure) instead of feeding real PDF bytes through a parser.
export class FakePdfTextExtractor implements PdfTextExtractor {
  private result: Result<
    { totalPages: number; pages: string[] },
    DomainError
  > | null = null;

  // Records every call so tests can assert extraction never happens once
  // an earlier step already failed (e.g. an invalid download).
  readonly extractCalls: Uint8Array[] = [];

  // The result the next (and every subsequent) extract() call returns.
  // Defaults to zero pages when never set, matching "no text layer".
  setResult(
    result: Result<{ totalPages: number; pages: string[] }, DomainError>,
  ): void {
    this.result = result;
  }

  async extract(
    bytes: Uint8Array,
  ): Promise<Result<{ totalPages: number; pages: string[] }, DomainError>> {
    this.extractCalls.push(bytes);
    return this.result ?? ok({ totalPages: 0, pages: [] });
  }
}
