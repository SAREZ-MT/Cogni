import { extractText, getDocumentProxy } from "unpdf";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PDF_FILE_ERROR } from "../domain/errors";
import type { PdfTextExtractor } from "../domain/pdf-text-extractor";

// design.md, "unpdf" (exact pin, 1.9.1 since the Oct 2026 pdf.js fix): the only adapter for
// PdfTextExtractor (domain/pdf-text-extractor.ts). `getDocumentProxy` +
// `extractText(pdf, { mergePages: false })` return one string per page, in
// order — an empty string for a real page with no text is a legitimate
// result, not an error (processImportJob's no_text_layer check owns that
// decision). Any failure to open or parse the file — encrypted, corrupted,
// not actually a PDF despite passing looksLikePdf() — becomes
// err(PDF_FILE_ERROR.UNREADABLE); this is the *only* place `unpdf` may be
// imported (.dependency-cruiser.cjs's unpdf-only-in-ingestion-infra).
export class UnpdfTextExtractor implements PdfTextExtractor {
  async extract(
    bytes: Uint8Array,
  ): Promise<Result<{ totalPages: number; pages: string[] }, DomainError>> {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { totalPages, text } = await extractText(pdf, {
        mergePages: false,
      });
      return ok({ totalPages, pages: text });
    } catch {
      return err(
        new DomainError(
          PDF_FILE_ERROR.UNREADABLE,
          "unpdf could not parse the PDF",
        ),
      );
    }
  }
}
