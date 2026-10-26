import { extractText, getDocumentProxy } from "unpdf";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../domain/document-extractor";
import type { DocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR } from "../domain/errors";
import { textToBlocks } from "../domain/text-to-blocks";

// design.md, "unpdf 1.8.1" (version exacta). The PDF adapter for the
// DocumentExtractor port (document-import T5; formerly UnpdfTextExtractor,
// whose page texts processImportJob converted itself). Behaviour is
// unchanged: `getDocumentProxy` + `extractText(pdf, { mergePages: false })`
// return one string per page, in order, and `textToBlocks` turns them into
// blocks and counts the pages without text. A real page with no text is a
// legitimate result, not an error (processImportJob's no-text check owns
// that decision). Any failure to open or parse the file — encrypted,
// corrupted — becomes err(DOCUMENT_FILE_ERROR.UNREADABLE). No images yet.
// This is the *only* place `unpdf` may be imported
// (.dependency-cruiser.cjs's unpdf-only-in-ingestion-infra); T8 replaces
// it with a structure-aware adapter.
export class PdfDocumentExtractor implements DocumentExtractor {
  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    if (format !== "pdf") {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `PdfDocumentExtractor cannot read ${format}`,
        ),
      );
    }
    let pages: string[];
    try {
      const pdf = await getDocumentProxy(bytes);
      ({ text: pages } = await extractText(pdf, { mergePages: false }));
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
