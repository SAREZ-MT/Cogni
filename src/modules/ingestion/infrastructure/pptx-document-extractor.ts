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
import {
  type BulletKind,
  isHiddenSlide,
  markInheritedBullets,
  type Relationship,
  readMasterBodyBullets,
  readRelationships,
  readTableSpans,
  relsPathOf,
  slideRelIds,
  slideTitleKind,
  stripInvisibleShapes,
} from "../domain/pptx-xml";
import {
  OoxmlLimitError,
  type OoxmlPackage,
  officeparserLimitCode,
  openOoxmlPackage,
} from "./ooxml-package";
import {
  mapPptxSlides,
  type OfficeNode,
  type SlideSource,
} from "./pptx-slide-mapper";

// document-import T7: the PPTX adapter for the DocumentExtractor port.
//
// Engine (T0 spike): officeparser 8.2 reads the slides' text — title
// placeholders, paragraphs with their runs (bold, italic, underline,
// strike, sub/superscript, colour, links), list paragraphs with their
// level, tables, pictures with their description, equations and the
// speaker notes of every slide. The mapper (pptx-slide-mapper.ts) turns
// that AST into blocks.
//
// Read from the slide XML around it (domain/pptx-xml.ts), because
// officeparser does not report it:
// - the deck order (the presentation's slide list, as officeparser reads
//   it), so each officeparser slide is paired with its part;
// - hidden slides (`show="0"`): skipped, with their notes;
// - hidden shapes (`hidden="1"`) and page furniture (slide number, date,
//   footer, header placeholders — on notes pages too): cut from the XML
//   before officeparser reads it, so their text never reaches the page or
//   the AI;
// - bullets a content placeholder inherits from the slide master's body
//   style: written into the paragraphs first (officeparser only sees a
//   paragraph's own bullet);
// - whether the title is a title slide's (`ctrTitle` → heading 1);
// - table spans (`gridSpan`, `rowSpan`, `hMerge`, `vMerge`): officeparser
//   reports a plain grid;
// - the media part behind each picture, read through the package.
//
// Limits (T9b, as DOCX): the bytes are opened as an OoxmlPackage
// (ooxml-package.ts) — directory guard, then capped lazy inflation — and
// officeparser parses `pkg.xmlArchive()` (stored, XML only: it never
// inflates a byte or reads a picture itself) with its own decompression
// limits as a second fence. Pictures are read one at a time by the mapper
// under IMAGE_LIMITS. A cap breach is err(LIMIT_EXCEEDED); a malformed
// package, or any other failure, UNREADABLE.
const OFFICEPARSER_CONFIG = {
  decompressionLimits: {
    maxUncompressedBytes: OOXML_LIMITS.maxTotalBytes,
    maxZipEntries: OOXML_LIMITS.maxEntries,
    maxXmlElements: OOXML_LIMITS.maxXmlElements,
  },
  extractAttachments: false,
  ignoreNotes: false,
  ignoreComments: true,
  ignoreHeadersAndFooters: true,
  includeBreakNodes: false,
  ocr: false,
  onWarning: () => {},
};

const PRESENTATION_PART = "ppt/presentation.xml";
const SLIDE_PART = /^ppt\/slides\/slide(\d+)\.xml$/;

type DeckSlide = {
  number: number;
  hidden: boolean;
  source: Omit<SlideSource, "node" | "number">;
};

function relationshipsOf(
  pkg: OoxmlPackage,
  part: string,
): Map<string, Relationship> {
  const rels = relsPathOf(part);
  return pkg.has(rels)
    ? readRelationships(pkg.readText(rels), part)
    : new Map();
}

function firstOfType(
  rels: Map<string, Relationship>,
  type: string,
): string | null {
  for (const rel of rels.values()) {
    if (rel.type === type && !rel.external) return rel.target;
  }
  return null;
}

// The slide parts in the order the presentation shows them, exactly as
// officeparser orders them (its slideNumber is the place in this list):
// the slide list's parts, or — when it names none — every slide part by
// its file number.
function slidePartsInOrder(pkg: OoxmlPackage): string[] {
  const rels = relationshipsOf(pkg, PRESENTATION_PART);
  const listed: string[] = [];
  for (const id of slideRelIds(pkg.readText(PRESENTATION_PART))) {
    const target = rels.get(id)?.target;
    if (target && SLIDE_PART.test(target) && pkg.has(target)) {
      if (!listed.includes(target)) listed.push(target);
    }
  }
  if (listed.length > 0) return listed;
  return pkg
    .names()
    .filter((name) => SLIDE_PART.test(name))
    .sort(
      (a, b) =>
        Number(SLIDE_PART.exec(a)?.[1]) - Number(SLIDE_PART.exec(b)?.[1]),
    );
}

// Reads every slide's XML facts and rewrites the parts officeparser will
// read (invisible shapes cut, master bullets written in).
function prepareDeck(pkg: OoxmlPackage): DeckSlide[] {
  if (!pkg.has(PRESENTATION_PART)) throw new Error("not a presentation");
  const masterBullets = new Map<string, BulletKind[]>();
  const bulletsOf = (slideRels: Map<string, Relationship>): BulletKind[] => {
    const layout = firstOfType(slideRels, "slideLayout");
    const master = layout
      ? firstOfType(relationshipsOf(pkg, layout), "slideMaster")
      : null;
    if (!master || !pkg.has(master)) return [];
    let levels = masterBullets.get(master);
    if (!levels) {
      levels = readMasterBodyBullets(pkg.readText(master));
      masterBullets.set(master, levels);
    }
    return levels;
  };

  return slidePartsInOrder(pkg).map((part, index) => {
    const xml = pkg.readText(part);
    const rels = relationshipsOf(pkg, part);
    const hidden = isHiddenSlide(xml);
    const prepared = markInheritedBullets(
      stripInvisibleShapes(xml),
      bulletsOf(rels),
    );
    if (prepared !== xml) pkg.replaceText(part, prepared);
    const notes = firstOfType(rels, "notesSlide");
    if (notes && pkg.has(notes)) {
      const notesXml = pkg.readText(notes);
      const visible = stripInvisibleShapes(notesXml);
      if (visible !== notesXml) pkg.replaceText(notes, visible);
    }
    const pictures = new Map<string, string>();
    for (const rel of rels.values()) {
      if (rel.type !== "image" || rel.external) continue;
      // officeparser names a picture by its target's file name.
      const name = rel.target.slice(rel.target.lastIndexOf("/") + 1);
      if (!pictures.has(name)) pictures.set(name, rel.target);
    }
    return {
      number: index + 1,
      hidden,
      source: {
        titleKind: slideTitleKind(prepared),
        tables: readTableSpans(prepared),
        pictures,
      },
    };
  });
}

function slideNodes(content: unknown): Map<number, OfficeNode> {
  const byNumber = new Map<number, OfficeNode>();
  for (const node of (content ?? []) as OfficeNode[]) {
    const number = node?.metadata?.slideNumber;
    if (node?.type === "slide" && typeof number === "number") {
      if (!byNumber.has(number)) byNumber.set(number, node);
    }
  }
  return byNumber;
}

export class PptxDocumentExtractor implements DocumentExtractor {
  async extract(
    bytes: Uint8Array,
    format: DocumentFormat,
    options?: ExtractOptions,
  ): Promise<Result<ExtractedDocument, DomainError>> {
    if (format !== "pptx") {
      return err(
        new DomainError(
          DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
          `PptxDocumentExtractor cannot read ${format}`,
        ),
      );
    }
    const opened = openOoxmlPackage(bytes);
    if (!opened.ok) return opened;
    const pkg = opened.value;
    // The time budget (processImportJob) aborts the signal; it is checked
    // between the steps and handed to officeparser, which checks it per
    // slide.
    const aborted = () => options?.signal?.aborted === true;
    const abortedResult = () =>
      err(new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, "aborted"));
    try {
      if (aborted()) return abortedResult();
      const deck = prepareDeck(pkg);
      if (aborted()) return abortedResult();
      const ast = await OfficeParser.parseOffice(
        Buffer.from(pkg.xmlArchive()),
        { ...OFFICEPARSER_CONFIG, abortSignal: options?.signal },
      );
      if (aborted()) return abortedResult();
      const nodes = slideNodes(ast.content);
      const visible = deck.filter((slide) => !slide.hidden);
      const mapped = mapPptxSlides(
        visible.map((slide) => ({
          ...slide.source,
          number: slide.number,
          node: nodes.get(slide.number) ?? null,
        })),
        (path) => pkg.readBytes(path),
      );
      return ok({
        content: mapped.content,
        totalPages: visible.length,
        pagesWithoutText: mapped.pagesWithoutText,
        images: mapped.images,
        skippedImages: mapped.skippedImages,
      });
    } catch (error) {
      const limit =
        error instanceof OoxmlLimitError
          ? error.message
          : officeparserLimitCode(error);
      return err(
        limit
          ? new DomainError(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED, limit)
          : new DomainError(
              DOCUMENT_FILE_ERROR.UNREADABLE,
              "the PPTX could not be read or mapped",
            ),
      );
    }
  }
}
