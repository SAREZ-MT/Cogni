import { getDocumentProxy } from "unpdf";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
  ExtractOptions,
} from "../domain/document-extractor";
import type { DocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR } from "../domain/errors";
import { textToBlocks } from "../domain/text-to-blocks";

// design.md, "unpdf" (exact pin, 1.9.1 since the Oct 2026 pdf.js fix). The PDF adapter for the
// DocumentExtractor port (document-import T5; formerly UnpdfTextExtractor,
// whose page texts processImportJob converted itself). Behaviour is
// unchanged: `getDocumentProxy` + one text string per page, in order
// (unpdf's `extractText(pdf, { mergePages: false })` until T9b), and `textToBlocks` turns them into
// blocks and counts the pages without text. A real page with no text is a
// legitimate result, not an error (processImportJob's no-text check owns
// that decision). Any failure to open or parse the file — encrypted,
// corrupted — becomes err(DOCUMENT_FILE_ERROR.UNREADABLE). No images yet.
// This is the *only* place `unpdf` may be imported
// (.dependency-cruiser.cjs's unpdf-only-in-ingestion-infra); T8 replaces
// it with a structure-aware adapter.
//
// T9b (security audit 2026-10-26): `numPages` is checked against
// PDF_LIMITS.maxPages before any page is read, pages are then read one at
// a time (unpdf's extractText reads them all concurrently) with the same
// per-item join as unpdf's own `getPageText`, the signal is checked
// between pages, and the page/total text caps stop a document whose text
// would not fit the editor anyway. Over a cap: err(LIMIT_EXCEEDED).
export const PDF_LIMITS = {
  maxPages: 300,
  // A dense page holds ~5,000 characters.
  maxPageChars: 100_000,
  maxTotalChars: 2_000_000,
};

type PdfLimits = typeof PDF_LIMITS;

type TextContentItem = { str?: string; hasEOL?: boolean };

function limitExceeded(reason: string): Result<never, DomainError> {
  return err(new DomainError(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED, reason));
}

export class PdfDocumentExtractor implements DocumentExtractor {
  private readonly limits: PdfLimits;

  constructor(limits: Partial<PdfLimits> = {}) {
    this.limits = { ...PDF_LIMITS, ...limits };
  }

  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
    options?: ExtractOptions,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    if (format !== "pdf") {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `PdfDocumentExtractor cannot read ${format}`,
        ),
      );
    }
    const pages: string[] = [];
    try {
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > this.limits.maxPages) {
        return limitExceeded(`${pdf.numPages} pages`);
      }
      let totalChars = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        if (options?.signal?.aborted) {
          return err(
            new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "aborted"),
          );
        }
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const text = (content.items as TextContentItem[])
          .filter((item) => item.str != null)
          .map((item) => item.str + (item.hasEOL ? "\n" : ""))
          .join("");
        page.cleanup();
        if (text.length > this.limits.maxPageChars) {
          return limitExceeded(`page ${number} text`);
        }
        totalChars += text.length;
        if (totalChars > this.limits.maxTotalChars) {
          return limitExceeded("total text");
        }
        pages.push(text);
      }
    } catch {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNREADABLE,
          "unpdf could not parse the PDF",
        ),
      );
    }
    const converted = textToBlocks(pages);
    return ok({
      content: converted.doc,
      totalPages: converted.totalPages,
      pagesWithoutText: converted.pagesWithoutText,
      images: [],
      skippedImages: 0,
    });
  }
}
