import { DomainError } from "@/shared/kernel/domain-error";
import { err, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
  ExtractOptions,
} from "../domain/document-extractor";
import type { DocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR } from "../domain/errors";
import { DocxDocumentExtractor } from "./docx-document-extractor";
import { PdfDocumentExtractor } from "./pdf-document-extractor";
import { PptxDocumentExtractor } from "./pptx-document-extractor";

// document-import T5: the DocumentExtractor the composition root
// (actions.ts) uses. It dispatches to one adapter per format and refuses a
// format with no adapter as UNSUPPORTED_FORMAT (processImportJob turns that
// into `failed(unsupported_format)`), so adding a format is registering
// one adapter here — T6 added docx, T7 pptx.
export class FormatRoutingDocumentExtractor implements DocumentExtractor {
  constructor(
    private readonly adapters: Partial<
      Record<DocumentFormat, DocumentExtractor>
    >,
  ) {}

  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
    options?: ExtractOptions,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    const adapter = this.adapters[format];
    if (!adapter) {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `no extractor registered for ${format}`,
        ),
      );
    }
    return adapter.extract(bytes, format, options);
  }
}

export function createDocumentExtractor(): DocumentExtractor {
  return new FormatRoutingDocumentExtractor({
    pdf: new PdfDocumentExtractor(),
    docx: new DocxDocumentExtractor(),
    pptx: new PptxDocumentExtractor(),
  });
}
