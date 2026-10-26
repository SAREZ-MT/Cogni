import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { DocumentFormat } from "./document-format";
import type { ImportedDoc } from "./imported-doc";

// An image found in the source document, not uploaded yet. Its image node
// in `content` points at it with `attrs.pendingId === key`; T9 uploads the
// bytes as a page asset and swaps `pendingId` for the resulting
// `assetId` before the content is written.
export type ExtractedImage = {
  key: string;
  bytes: Uint8Array;
  mime: string;
  alt: string | null;
};

export type ExtractedDocument = {
  content: ImportedDoc;
  // Pages (PDF), slides (PPTX) or the writer's page estimate (DOCX).
  totalPages: number;
  pagesWithoutText: number;
  images: ExtractedImage[];
  // document-import T6: images found in the source but not kept, because
  // their format is not one the page assets accept (EMF, WMF, TIFF, SVG
  // without a PNG fallback, …). T9 reports the count in the job result.
  skippedImages: number;
};

// document-import T5 (replaces `PdfTextExtractor`): the port
// `processImportJob` depends on instead of calling a parser library
// directly (`domain-is-pure`/`application-no-infra-or-ui`). `format` is
// the one `detectDocumentFormat` found in the real bytes (and already
// checked against the upload's declared format). Adapters live in
// `infrastructure/`: `FormatRoutingDocumentExtractor` dispatches to one
// adapter per format (`PdfDocumentExtractor` today; DOCX/PPTX in T6/T7);
// `FakeDocumentExtractor` (application/testing) implements it in memory.
export interface DocumentExtractor {
  // err(DOCUMENT_FILE_ERROR.UNREADABLE) for an encrypted, corrupt or
  // truncated file; err(DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT) when no
  // adapter handles `format`. `processImportJob` maps UNSUPPORTED_FORMAT to
  // `failed(unsupported_format)` and every other error to
  // `failed(invalid_document)`. A readable document with no text is a
  // success: `processImportJob` owns the "no text" decision.
  extract(
    bytes: Uint8Array,
    format: DocumentFormat,
  ): Promise<Result<ExtractedDocument, DomainError>>;
}
