import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";

// design.md, "Interfaces / Contracts" — the port `processImportJob` (T6)
// depends on instead of calling `unpdf` directly (`domain-is-pure`/
// `application-no-infra-or-ui` in .dependency-cruiser.cjs).
// `UnpdfTextExtractor` (T7) implements it with `getDocumentProxy` +
// `extractText({ mergePages: false })`; `FakePdfTextExtractor`
// (application/testing) implements it in memory for unit tests.
export interface PdfTextExtractor {
  // One string per PDF page, in order. err(PDF_FILE_ERROR.UNREADABLE) for
  // an encrypted or broken file; `processImportJob` maps any error here to
  // `failed(invalid_pdf)` regardless of the code.
  extract(
    bytes: Uint8Array,
  ): Promise<Result<{ totalPages: number; pages: string[] }, DomainError>>;
}
