import type { HeadingLevel } from "@/shared/kernel/tiptap-catalogue";
import type { ExtractedImage } from "../domain/document-extractor";
import {
  IMAGE_LIMITS,
  type ImageLimits,
  sniffImageMime,
} from "../domain/image-mime";
import {
  itemContent,
  ListBuilder,
  mergeTexts,
  trimInlines,
} from "../domain/imported-blocks";
import type {
  ImportedBlock,
  ImportedInline,
  ImportedMark,
  ImportedTableCell,
  ImportedTableRow,
  ImportedText,
} from "../domain/imported-doc";
import { hasTextContent } from "../domain/imported-doc";
import { safeLinkHref } from "../domain/imported-marks";

// document-import T8: maps officeparser 8.2's PDF AST (page geometry on) to
// ImportedDoc blocks, page by page. pdf-document-extractor.ts decides when
// this structure is used and when the text falls back to textToBlocks.
//
// What a PDF run carries: its text, font name and size, bold/italic (from
// the font), a link (annotation) and its bounding box. Underline, strike,
// colour, highlight and sub/superscript are not reliable in a PDF and are
// not imported. Per node type:
// - heading: `heading` at its level (tags, or font size on untagged
//   pages), 1–6, without the bold every heading run carries;
// - paragraph: `paragraph` with bold/italic/code marks and safe links; a
//   paragraph whose runs are all monospace → one `codeBlock` per run of
//   consecutive such paragraphs, a line per baseline;
// - list: nested `bulletList`/`orderedList` from the flat `indentation`,
//   ordered `start` from the first item's `itemIndex` + 1;
// - table: `table`; header cells (`style: "header"`) → `tableHeader`; no
//   spans (officeparser reports none) and short rows padded with empty
//   cells;
// - image: `image` (`pendingId`, `alt: null`: officeparser exposes no alt
//   text for PDFs) under IMAGE_LIMITS;
// - note (footnotes of a tagged PDF): paragraphs at the end of the page.
//
// Sub/superscripts: officeparser sorts runs by baseline, so a raised
// superscript is read before the line it sits on. A run smaller than the
// document's body size that is out of reading order is dropped; one in
// order keeps its text without a mark ("H2O"), and a paragraph made only
// of a short smaller run (the misplaced superscript on untagged pages)
// is dropped.

export type PdfBounds = { x: number; y: number; width: number; height: number };

// The subset of officeparser's OfficeContentNode the mapper reads.
export type PdfNode = {
  type: string;
  text?: string;
  children?: PdfNode[];
  metadata?: Record<string, unknown>;
  formatting?: Record<string, unknown>;
  bounds?: PdfBounds;
  notes?: PdfNode[];
};

// Decoded bytes of an officeparser attachment, or null when there is none
// by that name or it is refused before decoding (over the per-image cap).
export type AttachmentReader = (name: string) => Uint8Array | null;

export type MappedPdfPage = {
  pageNumber: number;
  blocks: ImportedBlock[];
  hasText: boolean;
};

export type MappedPdf = {
  pages: MappedPdfPage[];
  images: ExtractedImage[];
  skippedImages: number;
};

// A run this much smaller than the body text is a sub/superscript (10 pt
// against 12 pt in the fixtures).
const SCRIPT_SIZE_RATIO = 0.9;
// Two runs whose vertical centres differ by less than this share of the
// body size sit on the same visual line.
const SAME_LINE_RATIO = 0.5;
// Longest text of a stray script-only paragraph that is dropped.
const MAX_STRAY_SCRIPT_CHARS = 3;
const MAX_LIST_LEVEL = 8;

const STRUCTURE_TYPES = new Set(["heading", "list", "table"]);

// Known monospace families (case-insensitive), and "Mono" as a word of
// its own: a CamelCase or spaced suffix ("DejaVuSansMono", "Roboto Mono",
// "SFMono-Regular") or the whole name. "Mono" followed by a lowercase
// letter is part of another word — Monotype Corsiva, Monoline — and is not
// monospace (T8b).
const MONOSPACE_PDF_FAMILY =
  /courier|consolas|menlo|monaco|inconsolata|lucida ?console|lucida ?sans ?typewriter|source ?code|fira ?code|jetbrains ?mono|cascadia|monospace/i;
const MONO_WORD = /Mono(?![a-z])|(?:^|[^A-Za-z])mono(?![a-z])|MONO(?![A-Z])/;

function stringOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function children(node: PdfNode | null | undefined): PdfNode[] {
  return node?.children ?? [];
}

function sizeOf(node: PdfNode): number | null {
  const raw = stringOf(node.formatting?.size);
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// PDF font names carry a subset prefix and a style suffix
// ("ABCDEF+CourierNewPS-BoldMT").
export function isMonospacePdfFont(font: string | null): boolean {
  if (!font) return false;
  const name = font.replace(/^[A-Z]{6}\+/, "");
  return MONOSPACE_PDF_FAMILY.test(name) || MONO_WORD.test(name);
}

function isMonospaceRun(node: PdfNode): boolean {
  return isMonospacePdfFont(stringOf(node.formatting?.font));
}

function textRuns(node: PdfNode): PdfNode[] {
  return children(node).filter(
    (child) => child.type === "text" && typeof child.text === "string",
  );
}

function centreOf(node: PdfNode): number | null {
  const bounds = node.bounds;
  return bounds ? bounds.y + bounds.height / 2 : null;
}

function visitRuns(node: PdfNode, visit: (run: PdfNode) => void): void {
  if (node.type === "text" && typeof node.text === "string") {
    visit(node);
    for (const note of node.notes ?? []) visitRuns(note, visit);
    return;
  }
  for (const child of children(node)) visitRuns(child, visit);
  for (const note of node.notes ?? []) visitRuns(note, visit);
}

// The font size carrying most of the document's characters.
function bodySizeOf(pages: readonly PdfNode[]): number {
  const weights = new Map<number, number>();
  for (const page of pages) {
    visitRuns(page, (run) => {
      const size = sizeOf(run);
      if (size === null) return;
      const chars = (run.text ?? "").trim().length;
      weights.set(size, (weights.get(size) ?? 0) + chars);
    });
  }
  let best = 0;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best;
}

export function hasPdfStructure(pages: readonly PdfNode[]): boolean {
  const visit = (node: PdfNode): boolean =>
    STRUCTURE_TYPES.has(node.type) || children(node).some(visit);
  return pages.some(visit);
}

// Characters of every text run per page number (notes included), for the
// page and total text caps.
export function pdfPageTextLengths(
  pages: readonly PdfNode[],
): Map<number, number> {
  const lengths = new Map<number, number>();
  pages.forEach((page, index) => {
    const number = pageNumberOf(page, index);
    let total = lengths.get(number) ?? 0;
    visitRuns(page, (run) => {
      total += (run.text ?? "").length;
    });
    lengths.set(number, total);
  });
  return lengths;
}

function pageNumberOf(page: PdfNode, index: number): number {
  const value = page.metadata?.pageNumber;
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : index + 1;
}

function clampLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_LIST_LEVEL, Math.trunc(value)))
    : 0;
}

function headingLevel(value: unknown): HeadingLevel {
  const level =
    typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.max(1, Math.min(6, level)) as HeadingLevel;
}

function textOf(text: string, marks: ImportedMark[]): ImportedText {
  return marks.length > 0
    ? { type: "text", text, marks }
    : { type: "text", text };
}

class PdfMapper {
  readonly images: ExtractedImage[] = [];
  skippedImages = 0;
  private imageBytesRead = 0;
  private bodySize = 0;

  constructor(
    private readonly readAttachment: AttachmentReader,
    private readonly limits: ImageLimits,
  ) {}

  map(pages: readonly PdfNode[], imagesOnly: boolean): MappedPdf {
    this.bodySize = bodySizeOf(pages);
    const mapped = pages.map((page, index): MappedPdfPage => {
      const blocks = imagesOnly ? this.pageImages(page) : this.page(page);
      return {
        pageNumber: pageNumberOf(page, index),
        blocks,
        hasText: hasTextContent({ type: "doc", content: blocks }),
      };
    });
    return {
      pages: mapped,
      images: this.images,
      skippedImages: this.skippedImages,
    };
  }

  // -------------------------------------------------------------------
  // Pages

  private page(page: PdfNode): ImportedBlock[] {
    const notes: PdfNode[] = [];
    const blocks = this.blocks(children(page), notes);
    // Footnotes go after the page's own blocks (their own notes, if any,
    // are not followed further).
    const noteBlocks = this.blocks(
      notes.flatMap((note) => (note.type === "note" ? children(note) : [note])),
      [],
    );
    return [...blocks, ...noteBlocks];
  }

  private pageImages(page: PdfNode): ImportedBlock[] {
    const out: ImportedBlock[] = [];
    const visit = (node: PdfNode) => {
      if (node.type === "image") {
        const image = this.image(node);
        if (image) out.push(image);
        return;
      }
      for (const child of children(node)) visit(child);
    };
    visit(page);
    return out;
  }

  // The page as plain text for textToBlocks: a line per baseline, a blank
  // line between officeparser's blocks, misplaced and stray
  // sub/superscripts left out as in the structured mapping.
  private pageText(page: PdfNode): string {
    const blocks: string[] = [];
    const visit = (node: PdfNode) => {
      const runs = textRuns(node);
      if (runs.length > 0) {
        if (this.isStrayScript(node)) return;
        const kept = runs.filter(
          (run, index) => !this.isMisplacedScript(run, runs[index + 1]),
        );
        const text = this.lines(kept).join("\n");
        if (text.trim().length > 0) blocks.push(text);
        return;
      }
      for (const child of children(node)) visit(child);
    };
    for (const child of children(page)) visit(child);
    return blocks.join("\n\n");
  }

  textOf(pages: readonly PdfNode[]): string[] {
    this.bodySize = bodySizeOf(pages);
    return pages.map((page) => this.pageText(page));
  }

  // -------------------------------------------------------------------
  // Blocks

  private blocks(nodes: readonly PdfNode[], notes: PdfNode[]): ImportedBlock[] {
    const out: ImportedBlock[] = [];
    let list: ListBuilder | null = null;
    let code: string[] | null = null;
    const flushList = () => {
      if (list) out.push(...list.finish());
      list = null;
    };
    const flushCode = () => {
      const text = (code ?? []).join("\n").replace(/^\n+|\n+$/g, "");
      if (text.length > 0) {
        out.push({
          type: "codeBlock",
          attrs: { language: null },
          content: [{ type: "text", text }],
        });
      }
      code = null;
    };
    const flush = () => {
      flushList();
      flushCode();
    };

    for (const node of nodes) {
      collectRunNotes(node, notes);
      switch (node.type) {
        case "heading": {
          flush();
          const content = this.inlines(node, { heading: true });
          if (content.length > 0) {
            out.push({
              type: "heading",
              attrs: { level: headingLevel(node.metadata?.level) },
              content,
            });
          }
          break;
        }
        case "paragraph": {
          if (this.isCodeParagraph(node)) {
            flushList();
            code ??= [];
            code.push(...this.codeLines(node));
            break;
          }
          flush();
          if (this.isStrayScript(node)) break;
          const content = this.inlines(node, { heading: false });
          if (content.length > 0) out.push({ type: "paragraph", content });
          break;
        }
        case "list": {
          flushCode();
          const flow = this.listFlow(node, notes);
          if (flow.length === 0) break;
          list ??= new ListBuilder();
          const itemIndex = node.metadata?.itemIndex;
          list.add(
            clampLevel(node.metadata?.indentation),
            node.metadata?.listType === "ordered",
            stringOf(node.metadata?.listId),
            () =>
              typeof itemIndex === "number" && Number.isInteger(itemIndex)
                ? Math.max(0, itemIndex) + 1
                : 1,
            itemContent(flow),
          );
          break;
        }
        case "table": {
          flush();
          const table = this.table(node, notes);
          if (table) out.push(table);
          break;
        }
        case "image": {
          flush();
          const image = this.image(node);
          if (image) out.push(image);
          break;
        }
        case "note":
          flush();
          notes.push(node);
          break;
        default:
          // A container officeparser may emit (sections): its blocks;
          // anything else without children (charts, breaks): not imported.
          flush();
          if (children(node).length > 0) {
            out.push(...this.blocks(children(node), notes));
          }
      }
    }
    flush();
    return out;
  }

  // A list node holds paragraphs (tagged) or its runs directly
  // (geometric).
  private listFlow(node: PdfNode, notes: PdfNode[]): ImportedBlock[] {
    if (textRuns(node).length > 0) {
      const content = this.inlines(node, { heading: false });
      return content.length > 0 ? [{ type: "paragraph", content }] : [];
    }
    return this.blocks(children(node), notes);
  }

  private table(node: PdfNode, notes: PdfNode[]): ImportedBlock | null {
    const grid = children(node)
      .filter((row) => row.type === "row")
      .map((row) => children(row).filter((cell) => cell.type === "cell"));
    const width = Math.max(0, ...grid.map((cells) => cells.length));
    const rows: ImportedTableRow[] = [];
    const attrs = { colspan: 1, rowspan: 1, colwidth: null };
    for (const cells of grid) {
      if (cells.length === 0) continue;
      const out: ImportedTableCell[] = cells.map((cell) => {
        const content = this.blocks(children(cell), notes);
        return {
          type: cell.metadata?.style === "header" ? "tableHeader" : "tableCell",
          attrs,
          content: content.length > 0 ? content : [{ type: "paragraph" }],
        };
      });
      while (out.length < width) {
        out.push({
          type: "tableCell",
          attrs,
          content: [{ type: "paragraph" }],
        });
      }
      rows.push({ type: "tableRow", content: out });
    }
    return rows.length > 0 ? { type: "table", content: rows } : null;
  }

  // -------------------------------------------------------------------
  // Code

  private isCodeParagraph(node: PdfNode): boolean {
    const runs = textRuns(node).filter(
      (run) => (run.text ?? "").trim().length > 0,
    );
    return runs.length > 0 && runs.every(isMonospaceRun);
  }

  // The paragraph's text, a line per baseline, trailing spaces trimmed
  // (leading indentation is not in the PDF text).
  private codeLines(node: PdfNode): string[] {
    return this.lines(textRuns(node));
  }

  private lines(runs: readonly PdfNode[]): string[] {
    const lines: string[] = [];
    let current = "";
    let lastCentre: number | null = null;
    for (const run of runs) {
      const centre = centreOf(run);
      const size = sizeOf(run) ?? this.bodySize;
      if (
        lastCentre !== null &&
        centre !== null &&
        Math.abs(centre - lastCentre) > size * SAME_LINE_RATIO
      ) {
        lines.push(current.trimEnd());
        current = "";
      }
      current += run.text ?? "";
      if (centre !== null) lastCentre = centre;
    }
    lines.push(current.trimEnd());
    return lines;
  }

  // -------------------------------------------------------------------
  // Inlines

  private isScript(run: PdfNode): boolean {
    const size = sizeOf(run);
    return (
      size !== null &&
      this.bodySize > 0 &&
      size < this.bodySize * SCRIPT_SIZE_RATIO
    );
  }

  private isStrayScript(node: PdfNode): boolean {
    const runs = textRuns(node);
    const text = runs
      .map((run) => run.text ?? "")
      .join("")
      .trim();
    return (
      runs.length > 0 &&
      text.length > 0 &&
      text.length <= MAX_STRAY_SCRIPT_CHARS &&
      runs.every((run) => this.isScript(run))
    );
  }

  // A smaller run followed, on the same visual line, by a run that starts
  // left of it: officeparser read it before the line it belongs to.
  private isMisplacedScript(run: PdfNode, next: PdfNode | undefined): boolean {
    if (!next || !this.isScript(run) || !run.bounds || !next.bounds) {
      return false;
    }
    const runCentre = centreOf(run);
    const nextCentre = centreOf(next);
    if (runCentre === null || nextCentre === null) return false;
    return (
      next.bounds.x < run.bounds.x &&
      Math.abs(nextCentre - runCentre) < this.bodySize * SAME_LINE_RATIO
    );
  }

  private inlines(
    node: PdfNode,
    options: { heading: boolean },
  ): ImportedInline[] {
    const runs = textRuns(node);
    const inlines: ImportedInline[] = [];
    runs.forEach((run, index) => {
      if (this.isMisplacedScript(run, runs[index + 1])) return;
      const lines = (run.text ?? "").split("\n");
      const marks = this.marks(run, options);
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) inlines.push({ type: "hardBreak" });
        if (line.length > 0) inlines.push(textOf(line, marks));
      });
    });
    return trimInlines(mergeTexts(inlines));
  }

  private marks(run: PdfNode, options: { heading: boolean }): ImportedMark[] {
    const format = run.formatting ?? {};
    const href =
      run.metadata?.linkType === "external"
        ? safeLinkHref(stringOf(run.metadata?.link))
        : null;
    const marks: ImportedMark[] = [];
    // Tiptap's code mark excludes every other mark.
    if (isMonospaceRun(run)) return [{ type: "code" }];
    if (format.bold === true && !options.heading) marks.push({ type: "bold" });
    if (format.italic === true) marks.push({ type: "italic" });
    if (href) marks.push({ type: "link", attrs: { href } });
    return marks;
  }

  // -------------------------------------------------------------------
  // Images

  // Read one at a time, within the count, per-image and total caps
  // (IMAGE_LIMITS, shared with DOCX/PPTX). A missing attachment, one over
  // a cap or bytes that are not png/jpeg/gif/webp is skipped and counted.
  private image(node: PdfNode): ImportedBlock | null {
    const name = stringOf(node.metadata?.attachmentName);
    const key = name ? this.readImage(name) : null;
    if (key === null) {
      this.skippedImages++;
      return null;
    }
    return {
      type: "image",
      attrs: { assetId: null, pendingId: key, alt: null },
    };
  }

  private readImage(name: string): string | null {
    if (this.images.length >= this.limits.maxImages) return null;
    let bytes: Uint8Array | null;
    try {
      bytes = this.readAttachment(name);
    } catch {
      return null;
    }
    if (!bytes || bytes.length > this.limits.maxImageBytes) return null;
    if (this.imageBytesRead + bytes.length > this.limits.maxTotalBytes) {
      return null;
    }
    const mime = sniffImageMime(bytes);
    if (!mime) return null;
    this.imageBytesRead += bytes.length;
    const key = `image-${this.images.length + 1}`;
    this.images.push({ key, bytes, mime, alt: null });
    return key;
  }
}

// officeparser anchors a tagged footnote on the last text run of the
// paragraph that references it (`run.notes`).
function collectRunNotes(node: PdfNode, notes: PdfNode[]): void {
  for (const run of textRuns(node)) {
    if (run.notes) notes.push(...run.notes);
  }
}

export function mapPdfPages(
  pages: readonly PdfNode[],
  readAttachment: AttachmentReader,
  imageLimits: ImageLimits = IMAGE_LIMITS,
): MappedPdf {
  return new PdfMapper(readAttachment, imageLimits).map(pages, false);
}

// Only each page's images (for the textToBlocks fallback, which places
// them after the page's text).
export function mapPdfPageImages(
  pages: readonly PdfNode[],
  readAttachment: AttachmentReader,
  imageLimits: ImageLimits = IMAGE_LIMITS,
): MappedPdf {
  return new PdfMapper(readAttachment, imageLimits).map(pages, true);
}

// Each page's text for the textToBlocks fallback (see pageText).
export function pdfPageTexts(pages: readonly PdfNode[]): string[] {
  return new PdfMapper(() => null, IMAGE_LIMITS).textOf(pages);
}
