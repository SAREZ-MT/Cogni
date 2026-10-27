import { OfficeParser } from "officeparser";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
  ExtractOptions,
} from "../domain/document-extractor";
import type { DocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR } from "../domain/errors";
import { IMAGE_LIMITS, type ImageLimits } from "../domain/image-mime";
import type { ImportedBlock } from "../domain/imported-doc";
import { textToBlocks } from "../domain/text-to-blocks";
import { officeparserLimitCode } from "./ooxml-package";
import {
  type AttachmentReader,
  hasPdfStructure,
  mapPdfPageImages,
  mapPdfPages,
  type PdfNode,
  pdfPageTextLengths,
  pdfPageTexts,
} from "./pdf-ast-mapper";

// document-import T8: the PDF adapter for the DocumentExtractor port
// (unpdf + textToBlocks until T8).
//
// Engine: officeparser 8.2 alone, page geometry on. It reads a tagged
// PDF's structure tree (headings, lists, tables, footnotes, reading order)
// or, on an untagged page, what the geometry recovers (font-size headings,
// lists, columns, paragraphs), with fonts, links and images;
// pdf-ast-mapper.ts maps that AST to blocks. pdf.js runs in a separate
// process of officeparser's (`separateProcess`): a hostile content stream
// ends that process (PDF_PROCESS_FAILED), not the server, and the abort
// signal ends it at once.
//
// unpdf was removed: it loads its own pdf.js (6.4) into the server
// process and publishes its worker as `globalThis.pdfjsWorker`, which
// officeparser then takes for a caller-preloaded worker — every later PDF
// parse fails ("API version 6.2.108 does not match the Worker version") or
// runs in-process. No other pdf.js may be loaded in the server process
// (.dependency-cruiser.cjs: no-in-process-pdfjs).
//
// Which output is used (the fallback rule):
// 1. officeparser's blocks when its AST holds at least one heading, list
//    or table anywhere (hasPdfStructure). A PDF_STRUCT_TREE_UNRELIABLE
//    warning does not change this: officeparser then rebuilt the structure
//    from geometry, exactly as for an untagged page, and that beats the
//    text heuristics (untagged.pdf golden test).
// 2. Otherwise — a document of plain paragraphs only — textToBlocks over
//    each page's text (a line per baseline, a blank line between
//    officeparser's paragraphs), which still finds uppercase or numbered
//    headings and "- "/"1)" lists in plain text, with the page's images
//    after its text.
//
// Errors and limits: any officeparser failure (corrupt, encrypted,
// truncated, not a PDF) is err(UNREADABLE) — never a document without
// text. officeparser reads at most PDF_LIMITS.maxPages pages
// (`pageRange`) and a document with more is err(LIMIT_EXCEEDED) once its
// page count is known: the parse cannot stop at the count alone, so up to
// maxPages pages are read before the refusal. The per-page and total text
// caps apply to the AST's runs after the parse; officeparser's own content
// limits (maxTextItems, maxOperators, maxTimeMs of CPU in its process,
// processMemoryMb) bound the parse itself, and a
// PDF_CONTENT_LIMIT_EXCEEDED warning (a partly read document) or
// PDF_PROCESS_FAILED (its process ran out of memory) is err(LIMIT_EXCEEDED)
// too. Images go through IMAGE_LIMITS. The signal is checked before and
// after the parse and handed to officeparser (checked between pages).
export const PDF_LIMITS = {
  maxPages: 300,
  // A dense page holds ~5,000 characters.
  maxPageChars: 100_000,
  maxTotalChars: 2_000_000,
};

type PdfLimits = typeof PDF_LIMITS;

const OFFICEPARSER_PDF_CONFIG = {
  fileType: "pdf",
  extractAttachments: true,
  ocr: false,
  // Footnotes of a tagged PDF are kept (mapped after their page).
  ignoreNotes: false,
  // Running headers and footers (page numbers, titles) are page
  // furniture, as textToBlocks' page-number rule already treats them.
  ignoreHeadersAndFooters: true,
  ignoreInternalLinks: true,
  includeBreakNodes: false,
  ignorePageGeometry: false,
  // Never fetch pdf.js or anything else from a CDN.
  allowRemoteAssets: false,
} as const;

const PDF_PARSER_CONFIG = {
  useTags: true,
  headingDetection: "auto",
  detectColumns: true,
  mergeHyphenatedWords: true,
  // Colours are not imported for PDFs.
  extractTextColor: false,
  separateProcess: true,
} as const;

const PDF_LIMIT_WARNINGS = new Set(["PDF_CONTENT_LIMIT_EXCEEDED"]);
const PDF_LIMIT_ERRORS = new Set(["PDF_PROCESS_FAILED"]);

type ParsedPdf = {
  numPages: number;
  pages: PdfNode[];
  readAttachment: AttachmentReader;
};

function limitExceeded(reason: string): Result<never, DomainError> {
  return err(new DomainError(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED, reason));
}

function abortedResult(): Result<never, DomainError> {
  return err(new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "aborted"));
}

function unreadable(): Result<never, DomainError> {
  return err(
    new DomainError(
      DOCUMENT_FILE_ERROR.UNREADABLE,
      "the PDF could not be read or mapped",
    ),
  );
}

function issueCode(error: unknown): string | null {
  const code = (error as { officeIssue?: { code?: unknown } } | null)
    ?.officeIssue?.code;
  return typeof code === "string" ? code : null;
}

// Decodes an officeparser attachment (base64) on demand; one whose
// encoded size already exceeds the per-image cap is never decoded.
function attachmentReader(
  attachments: unknown,
  maxImageBytes: number,
): AttachmentReader {
  const byName = new Map<string, string>();
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const name = (attachment as { name?: unknown })?.name;
    const data = (attachment as { data?: unknown })?.data;
    if (typeof name === "string" && typeof data === "string") {
      if (!byName.has(name)) byName.set(name, data);
    }
  }
  return (name) => {
    const data = byName.get(name);
    if (data === undefined) return null;
    if (Math.floor((data.length * 3) / 4) > maxImageBytes + 2) return null;
    return new Uint8Array(Buffer.from(data, "base64"));
  };
}

let separateProcessWarned = false;

export class PdfDocumentExtractor implements DocumentExtractor {
  private readonly limits: PdfLimits;

  constructor(
    limits: Partial<PdfLimits> = {},
    private readonly imageLimits: ImageLimits = IMAGE_LIMITS,
  ) {
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
    const aborted = () => options?.signal?.aborted === true;
    if (aborted()) return abortedResult();
    try {
      const parsed = await this.parse(bytes, options);
      if (aborted()) return abortedResult();
      if (!parsed.ok) return parsed;
      const pdf = parsed.value;
      if (pdf.numPages > this.limits.maxPages) {
        return limitExceeded(`${pdf.numPages} pages`);
      }
      const capped = this.checkTextCaps(pdfPageTextLengths(pdf.pages));
      if (capped) return capped;
      return ok(
        hasPdfStructure(pdf.pages)
          ? this.fromStructure(pdf)
          : this.fromText(pdf),
      );
    } catch {
      return aborted() ? abortedResult() : unreadable();
    }
  }

  private async parse(
    bytes: Uint8Array,
    options?: ExtractOptions,
  ): Promise<Result<ParsedPdf, DomainError>> {
    const warnings = new Set<string>();
    let ast: {
      metadata?: { pages?: unknown };
      content?: unknown;
      attachments?: unknown;
    };
    try {
      ast = await OfficeParser.parseOffice(Buffer.from(bytes), {
        ...OFFICEPARSER_PDF_CONFIG,
        pdfParserConfig: {
          ...PDF_PARSER_CONFIG,
          pageRange: `1-${this.limits.maxPages}`,
        },
        abortSignal: options?.signal,
        onWarning: (issue: { code?: unknown }) => {
          if (typeof issue?.code === "string") warnings.add(issue.code);
        },
      });
    } catch (error) {
      if (options?.signal?.aborted) return abortedResult();
      const code = issueCode(error);
      const limit =
        officeparserLimitCode(error) ??
        (code && PDF_LIMIT_ERRORS.has(code) ? code : null);
      return limit ? limitExceeded(limit) : unreadable();
    }
    if (
      warnings.has("PDF_SEPARATE_PROCESS_UNAVAILABLE") &&
      !separateProcessWarned
    ) {
      separateProcessWarned = true;
      console.warn(
        "[ingestion] officeparser could not start its pdf.js process; PDFs are parsed in the server process",
      );
    }
    for (const code of warnings) {
      if (PDF_LIMIT_WARNINGS.has(code)) return limitExceeded(code);
    }
    const pages = (Array.isArray(ast.content) ? ast.content : []).filter(
      (node: PdfNode) => node?.type === "page",
    ) as PdfNode[];
    const declared = ast.metadata?.pages;
    return ok({
      numPages:
        typeof declared === "number" && Number.isInteger(declared)
          ? declared
          : pages.length,
      pages,
      readAttachment: attachmentReader(
        ast.attachments,
        this.imageLimits.maxImageBytes,
      ),
    });
  }

  private checkTextCaps(lengths: Iterable<[number, number]>) {
    let total = 0;
    for (const [number, length] of lengths) {
      if (length > this.limits.maxPageChars) {
        return limitExceeded(`page ${number} text`);
      }
      total += length;
      if (total > this.limits.maxTotalChars) return limitExceeded("total text");
    }
    return null;
  }

  private fromStructure(pdf: ParsedPdf): ExtractedDocument {
    const mapped = mapPdfPages(pdf.pages, pdf.readAttachment, this.imageLimits);
    const withText = new Set(
      mapped.pages
        .filter((page) => page.hasText)
        .map((page) => page.pageNumber),
    );
    return {
      content: {
        type: "doc",
        content: mapped.pages.flatMap((page) => page.blocks),
      },
      totalPages: pdf.numPages,
      pagesWithoutText: Math.max(0, pdf.numPages - withText.size),
      images: mapped.images,
      skippedImages: mapped.skippedImages,
    };
  }

  // textToBlocks over every page's text (a page officeparser emitted no
  // node for is a page without text), each page's images after it.
  private fromText(pdf: ParsedPdf): ExtractedDocument {
    const texts = new Map<number, string>();
    pdfPageTexts(pdf.pages).forEach((text, index) => {
      const number = pageNumber(pdf.pages[index], index);
      texts.set(number, [texts.get(number), text].filter(Boolean).join("\n\n"));
    });
    const images = mapPdfPageImages(
      pdf.pages,
      pdf.readAttachment,
      this.imageLimits,
    );
    const imagesByPage = new Map<number, ImportedBlock[]>();
    for (const page of images.pages) {
      imagesByPage.set(page.pageNumber, [
        ...(imagesByPage.get(page.pageNumber) ?? []),
        ...page.blocks,
      ]);
    }
    const pages = Array.from(
      { length: pdf.numPages },
      (_, index) => texts.get(index + 1) ?? "",
    );
    const converted = textToBlocks(pages);
    const content =
      images.images.length === 0
        ? converted.doc.content
        : pages.flatMap((text, index) => [
            ...textToBlocks([text]).doc.content,
            ...(imagesByPage.get(index + 1) ?? []),
          ]);
    return {
      content: { type: "doc", content },
      totalPages: converted.totalPages,
      pagesWithoutText: converted.pagesWithoutText,
      images: images.images,
      skippedImages: images.skippedImages,
    };
  }
}

function pageNumber(page: PdfNode | undefined, index: number): number {
  const value = page?.metadata?.pageNumber;
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : index + 1;
}
