import mammoth from "mammoth";
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
import { OOXML_LIMITS } from "../domain/ooxml-guard";
import { stripHiddenRuns } from "../domain/ooxml-hidden-text";
import {
  collectEnrichments,
  type OfficeParserNode,
  type ParagraphEnrichment,
} from "./docx-enrichment";
import { type MammothNode, mapDocxModel } from "./docx-model-mapper";
import {
  type MammothZipFile,
  OoxmlLimitError,
  type OoxmlPackage,
  openOoxmlPackage,
} from "./ooxml-package";

// document-import T6: the DOCX adapter for the DocumentExtractor port.
//
// Engine split (T0 spike): mammoth 1.13 reads the block structure —
// headings (Title → 1, Heading 1–6), paragraphs, nested lists, tables with
// header rows and col/row spans, checkboxes, page breaks, images with
// their alt text (the DOCX description) and hyperlinks — but drops run
// colour and shading, the numbering start of ordered lists and every OMML
// equation. officeparser 8.2 reads exactly those.
//
// Merge strategy: both engines read the same checked package, one after
// the other (T9b: never in parallel, so their peak memory never adds up).
// mammoth's document model is captured through its `transformDocument`
// hook (the HTML it then renders is discarded; no HTML parsing) and mapped
// node by node (docx-model-mapper.ts). officeparser's AST is reduced to one
// enrichment per paragraph — colour spans and equation offsets in the
// paragraph's text coordinates, plus the list counter — and paired with
// mammoth's paragraphs in document order by equal text with a short
// lookahead (docx-enrichment.ts). The mapper then cuts mammoth's text runs
// at the colour/equation offsets of the paired enrichment. A paragraph the
// two engines read differently simply gets no enrichment; if officeparser
// fails altogether the document still imports from mammoth alone (no
// colours, starts or equations) — unless the failure is a limit breach,
// which fails the import (T10).
//
// totalPages: a DOCX stores no reliable page count (Word's docProps
// figure is whatever the last writer computed), so it is the number of
// explicit page breaks + 1; pagesWithoutText is always 0.
//
// Limits (T9b, see README "Límites y seguridad"): the bytes are opened as
// an OoxmlPackage (ooxml-package.ts) — directory guard, then capped lazy
// inflation — and neither engine ever inflates a part itself: mammoth
// reads through `pkg.mammothFile()`, officeparser parses `pkg.xmlArchive()`
// (stored, XML only) with its own decompression limits as a second fence.
// A cap breach is err(LIMIT_EXCEEDED); a malformed package UNREADABLE.
//
// mammoth and officeparser may only be imported from
// ingestion/infrastructure (.dependency-cruiser.cjs); officeparser is a
// Next `serverExternalPackages` entry (next.config.ts) because Turbopack
// breaks its ESM wrapper.
const OFFICEPARSER_CONFIG = {
  decompressionLimits: {
    maxUncompressedBytes: OOXML_LIMITS.maxTotalBytes,
    maxZipEntries: OOXML_LIMITS.maxEntries,
    maxXmlElements: OOXML_LIMITS.maxXmlElements,
  },
  extractAttachments: false,
  ignoreNotes: true,
  ignoreComments: true,
  ignoreHeadersAndFooters: true,
  includeBreakNodes: false,
  ocr: false,
  onWarning: () => {},
};

// mammoth's `openZip` takes `{ file }` (a ready zip-file object) besides
// `{ buffer }`; its published typings only declare the latter.
type MammothInput = Parameters<typeof mammoth.convertToHtml>[0];

async function readMammothModel(file: MammothZipFile): Promise<MammothNode> {
  let model: MammothNode | null = null;
  await mammoth.convertToHtml({ file } as unknown as MammothInput, {
    transformDocument: (document: MammothNode) => {
      model = document;
      return document;
    },
    // The HTML is discarded: never read image bytes for it.
    convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
  });
  if (!model) throw new Error("mammoth returned no document");
  return model;
}

// officeparser's own decompression-limit errors (`err.officeIssue.code`,
// officeparser/dist/types.js OfficeErrorType).
const OFFICEPARSER_LIMIT_CODES: ReadonlySet<string> = new Set([
  "ZIP_ENTRY_COUNT_LIMIT_EXCEEDED",
  "ZIP_ENTRY_INVALID_SIZE",
  "ZIP_SIZE_LIMIT_EXCEEDED",
  "XML_ELEMENT_LIMIT_EXCEEDED",
  "MAX_NESTING_DEPTH_EXCEEDED",
  "OUTPUT_TOO_LARGE",
]);

function officeparserLimitCode(error: unknown): string | null {
  const code = (error as { officeIssue?: { code?: unknown } } | null)
    ?.officeIssue?.code;
  return typeof code === "string" && OFFICEPARSER_LIMIT_CODES.has(code)
    ? code
    : null;
}

// The enrichment is optional — officeparser failing for any other reason
// degrades to mammoth alone — but a limit breach is not (document-import
// T10, T9b review): the caps are security bounds, so a part only this
// path reads (xmlArchive() reads every XML part) or officeparser's own
// fence tripping fails the import as LIMIT_EXCEEDED.
async function readEnrichments(
  pkg: OoxmlPackage,
): Promise<ParagraphEnrichment[] | null> {
  try {
    const ast = await OfficeParser.parseOffice(
      Buffer.from(pkg.xmlArchive()),
      OFFICEPARSER_CONFIG,
    );
    return collectEnrichments(ast.content as unknown as OfficeParserNode[]);
  } catch (error) {
    if (error instanceof OoxmlLimitError) throw error;
    const code = officeparserLimitCode(error);
    if (code) throw new OoxmlLimitError(`officeparser ${code}`);
    return null;
  }
}

const DOCUMENT_PART = "word/document.xml";
const STYLES_PART = "word/styles.xml";

// T9b (audit: AI-bound invisible text): runs Word hides (w:vanish,
// w:specVanish, directly or through a style) are cut from the main part
// before either engine reads it — mammoth ignores both properties. See
// domain/ooxml-hidden-text.ts for the rules and what is not resolved.
function removeHiddenText(pkg: OoxmlPackage): void {
  if (!pkg.has(DOCUMENT_PART)) return;
  const styles = pkg.has(STYLES_PART) ? pkg.readText(STYLES_PART) : "";
  const documentXml = pkg.readText(DOCUMENT_PART);
  const visible = stripHiddenRuns(documentXml, styles);
  if (visible !== documentXml) pkg.replaceText(DOCUMENT_PART, visible);
}

export class DocxDocumentExtractor implements DocumentExtractor {
  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
    options?: ExtractOptions,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    if (format !== "docx") {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `DocxDocumentExtractor cannot read ${format}`,
        ),
      );
    }
    const opened = openOoxmlPackage(bytes);
    if (!opened.ok) return opened;
    const pkg = opened.value;
    // The time budget (processImportJob) aborts the signal; each engine is
    // synchronous work once started, so it is checked between them.
    const aborted = () => options?.signal?.aborted === true;
    const abortedResult = () =>
      err(new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "aborted"));
    let mapped: Awaited<ReturnType<typeof mapDocxModel>>;
    try {
      if (aborted()) return abortedResult();
      removeHiddenText(pkg);
      const model = await readMammothModel(pkg.mammothFile());
      if (aborted()) return abortedResult();
      const enrichments = await readEnrichments(pkg);
      if (aborted()) return abortedResult();
      // Inside the try too (T6 review follow-up): a mapping bug on an
      // unexpected model shape becomes an error Result
      // (→ `invalid_document`) instead of escaping the port's contract.
      mapped = await mapDocxModel(model, enrichments);
    } catch (error) {
      return err(
        error instanceof OoxmlLimitError
          ? new DomainError(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED, error.message)
          : new DomainError(
              DOCUMENT_FILE_ERROR.UNREADABLE,
              "the DOCX could not be read or mapped",
            ),
      );
    }
    return ok({
      content: mapped.content,
      totalPages: mapped.pageBreaks + 1,
      pagesWithoutText: 0,
      images: mapped.images,
      skippedImages: mapped.skippedImages,
    });
  }
}
