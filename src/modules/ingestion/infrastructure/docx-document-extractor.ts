import mammoth from "mammoth";
import { OfficeParser } from "officeparser";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../domain/document-extractor";
import type { DocumentFormat } from "../domain/document-format";
import { DOCUMENT_FILE_ERROR } from "../domain/errors";
import {
  collectEnrichments,
  type OfficeParserNode,
  type ParagraphEnrichment,
} from "./docx-enrichment";
import { type MammothNode, mapDocxModel } from "./docx-model-mapper";

// document-import T6: the DOCX adapter for the DocumentExtractor port.
//
// Engine split (T0 spike): mammoth 1.13 reads the block structure —
// headings (Title → 1, Heading 1–6), paragraphs, nested lists, tables with
// header rows and col/row spans, checkboxes, page breaks, images with
// their alt text (the DOCX description) and hyperlinks — but drops run
// colour and shading, the numbering start of ordered lists and every OMML
// equation. officeparser 8.2 reads exactly those.
//
// Merge strategy: both engines run in parallel on the same bytes.
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
// colours, starts or equations).
//
// totalPages: a DOCX stores no reliable page count (Word's docProps
// figure is whatever the last writer computed), so it is the number of
// explicit page breaks + 1; pagesWithoutText is always 0.
//
// mammoth and officeparser may only be imported from
// ingestion/infrastructure (.dependency-cruiser.cjs); officeparser is a
// Next `serverExternalPackages` entry (next.config.ts) because Turbopack
// breaks its ESM wrapper.
const OFFICEPARSER_CONFIG = {
  extractAttachments: false,
  ignoreNotes: true,
  ignoreComments: true,
  ignoreHeadersAndFooters: true,
  includeBreakNodes: false,
  ocr: false,
  onWarning: () => {},
};

async function readMammothModel(buffer: Buffer): Promise<MammothNode> {
  let model: MammothNode | null = null;
  await mammoth.convertToHtml(
    { buffer },
    {
      transformDocument: (document: MammothNode) => {
        model = document;
        return document;
      },
      // The HTML is discarded: never read image bytes for it.
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  if (!model) throw new Error("mammoth returned no document");
  return model;
}

async function readEnrichments(
  buffer: Buffer,
): Promise<ParagraphEnrichment[] | null> {
  try {
    const ast = await OfficeParser.parseOffice(buffer, OFFICEPARSER_CONFIG);
    return collectEnrichments(ast.content as unknown as OfficeParserNode[]);
  } catch {
    return null;
  }
}

export class DocxDocumentExtractor implements DocumentExtractor {
  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    if (format !== "docx") {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `DocxDocumentExtractor cannot read ${format}`,
        ),
      );
    }
    const buffer = Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    let model: MammothNode;
    let enrichments: ParagraphEnrichment[] | null;
    try {
      [model, enrichments] = await Promise.all([
        readMammothModel(buffer),
        readEnrichments(buffer),
      ]);
    } catch {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNREADABLE,
          "mammoth could not read the DOCX",
        ),
      );
    }
    const mapped = await mapDocxModel(model, enrichments);
    return ok({
      content: mapped.content,
      totalPages: mapped.pageBreaks + 1,
      pagesWithoutText: 0,
      images: mapped.images,
      skippedImages: mapped.skippedImages,
    });
  }
}
