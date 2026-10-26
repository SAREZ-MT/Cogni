import type { ExtractedImage } from "../domain/document-extractor";
import { sniffImageMime } from "../domain/image-mime";
import type {
  ImportedBlock,
  ImportedBulletList,
  ImportedDoc,
  ImportedInline,
  ImportedListItem,
  ImportedMark,
  ImportedOrderedList,
  ImportedParagraph,
  ImportedTableCell,
  ImportedTableRow,
  ImportedTaskItem,
  ImportedText,
} from "../domain/imported-doc";
import {
  docxHighlightToPalette,
  isMonospaceFont,
  normalizeHexColor,
  safeLinkHref,
} from "../domain/imported-marks";
import { importableLatex } from "../domain/omml-latex";
import {
  alignEnrichments,
  type ColorSpan,
  type ParagraphEnrichment,
} from "./docx-enrichment";
import { OoxmlLimitError } from "./ooxml-package";

// document-import T6: maps mammoth's DOCX document model (captured with
// its `transformDocument` hook) to an ImportedDoc, enriched per paragraph
// with what officeparser read (docx-enrichment.ts). See
// docx-document-extractor.ts for the merge strategy.

// The subset of mammoth's document model (mammoth/lib/documents.js) the
// mapper reads. mammoth ships no type for it.
export type MammothNode = {
  type: string;
  children?: MammothNode[];
  styleId?: string | null;
  styleName?: string | null;
  numbering?: { level?: string | number; isOrdered?: boolean } | null;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  verticalAlignment?: string;
  font?: string | null;
  highlight?: string | null;
  value?: string;
  checked?: boolean;
  href?: string | null;
  breakType?: string;
  altText?: string | null;
  isHeader?: boolean;
  colSpan?: number;
  rowSpan?: number;
  readAsArrayBuffer?: () => Promise<ArrayBuffer>;
};

export type MappedDocx = {
  content: ImportedDoc;
  images: ExtractedImage[];
  skippedImages: number;
  pageBreaks: number;
};

const MAX_ALT_LENGTH = 2000;
// document-import T9b: tables nested deeper than this fail the import
// (OoxmlLimitError → DOCUMENT_LIMIT_EXCEEDED) instead of recursing on;
// real documents rarely nest more than two or three. The XML nesting cap
// (OOXML_LIMITS.maxXmlDepth) already bounds every other recursion here.
export const MAX_TABLE_NESTING = 16;
// A colour carried by at least this share of the body text is the
// document's base colour (set by the Normal style, which officeparser
// folds into every run), not an emphasis: it is not imported.
const DOMINANT_COLOR_SHARE = 0.5;
// Pure black/white text or shading would vanish in one of the editor
// themes; they are the default look, not formatting worth keeping.
const NEUTRAL_COLORS = new Set(["#000000", "#ffffff"]);

const TITLE_STYLE = /^title$/i;
const HEADING_STYLE = /^(heading|t[ií]tulo)\s*([1-9])$/i;
const CODE_STYLE =
  /^(code|code block|source code|html ?preformatted|preformatted text|plain ?text|c[oó]digo)$/i;
const QUOTE_STYLE = /^(quote|intense ?quote|cita|cita destacada|block ?text)$/i;
const CHECKBOX_GLYPH = /^\s*([☐☑☒])\s*/;

type ParagraphKind =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: "code" }
  | { kind: "quote" }
  | { kind: "task"; checked: boolean }
  | { kind: "list"; level: number; ordered: boolean }
  | { kind: "paragraph" };

// One piece of a paragraph's inline flow, before it is cut into blocks.
type Piece =
  | { kind: "text"; text: string; offset: number; run: RunContext }
  | { kind: "hardBreak" }
  | { kind: "pageBreak" }
  | { kind: "image"; node: MammothNode }
  | { kind: "math"; latex: string };

type RunContext = {
  marks: ImportedMark[];
  code: boolean;
  colorable: boolean;
  highlighted: boolean;
};

function styleOf(node: MammothNode): string[] {
  return [node.styleName, node.styleId].filter(
    (value): value is string => typeof value === "string",
  );
}

function headingLevel(node: MammothNode): 1 | 2 | 3 | 4 | 5 | 6 | null {
  for (const style of styleOf(node)) {
    if (TITLE_STYLE.test(style)) return 1;
    const match = HEADING_STYLE.exec(style) ?? /^heading([1-9])$/i.exec(style);
    if (match) {
      const level = Number(match[match.length - 1]);
      return Math.min(level, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
  return null;
}

function hasStyle(node: MammothNode, pattern: RegExp): boolean {
  return styleOf(node).some((style) => pattern.test(style));
}

function walkInline(node: MammothNode, visit: (node: MammothNode) => void) {
  for (const child of node.children ?? []) {
    visit(child);
    if (child.type === "run" || child.type === "hyperlink") {
      walkInline(child, visit);
    }
  }
}

// The text officeparser would read for this paragraph: text and tabs, no
// checkbox glyphs, breaks or images. Used only to align the two engines.
function alignmentText(paragraph: MammothNode): string {
  let text = "";
  walkInline(paragraph, (node) => {
    if (node.type === "text") text += node.value ?? "";
    if (node.type === "tab") text += "\t";
  });
  return text;
}

function collectParagraphs(nodes: readonly MammothNode[], out: MammothNode[]) {
  for (const node of nodes) {
    if (node.type === "paragraph") out.push(node);
    else if (
      node.type === "table" ||
      node.type === "tableRow" ||
      node.type === "tableCell"
    ) {
      collectParagraphs(node.children ?? [], out);
    }
  }
}

function collectImages(nodes: readonly MammothNode[], out: MammothNode[]) {
  for (const node of nodes) {
    if (node.type === "image") out.push(node);
    else collectImages(node.children ?? [], out);
  }
}

function addMark(marks: ImportedMark[], mark: ImportedMark): ImportedMark[] {
  return [...marks, mark];
}

function runContext(run: MammothNode, parent: RunContext): RunContext {
  let marks = parent.marks;
  if (run.isBold) marks = addMark(marks, { type: "bold" });
  if (run.isItalic) marks = addMark(marks, { type: "italic" });
  if (run.isUnderline) marks = addMark(marks, { type: "underline" });
  if (run.isStrikethrough) marks = addMark(marks, { type: "strike" });
  if (run.verticalAlignment === "subscript") {
    marks = addMark(marks, { type: "subscript" });
  }
  if (run.verticalAlignment === "superscript") {
    marks = addMark(marks, { type: "superscript" });
  }
  const highlight = docxHighlightToPalette(run.highlight);
  if (highlight) {
    marks = addMark(marks, { type: "highlight", attrs: { color: highlight } });
  }
  return {
    marks,
    code: parent.code || isMonospaceFont(run.font),
    // A character style (Hyperlink, …) brings its own colour: not an
    // author's emphasis.
    colorable: parent.colorable && !run.styleId,
    highlighted: parent.highlighted || run.highlight != null,
  };
}

function sameMarks(
  a: ImportedMark[] | undefined,
  b: ImportedMark[] | undefined,
) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

class DocxMapper {
  private readonly enrichments: Map<MammothNode, ParagraphEnrichment | null>;
  private readonly imageBytes: Map<MammothNode, Uint8Array>;
  private readonly dominantColor: string | null;
  private readonly dominantBackground: string | null;
  // First item index officeparser saw per list id and level: the level's
  // start number (Word restarts nested levels at their start).
  private readonly levelStarts = new Map<string, number>();
  readonly images: ExtractedImage[] = [];
  skippedImages = 0;
  pageBreaks = 0;

  constructor(
    document: MammothNode,
    enrichments: readonly ParagraphEnrichment[] | null,
    imageBytes: Map<MammothNode, Uint8Array>,
  ) {
    this.imageBytes = imageBytes;
    const paragraphs: MammothNode[] = [];
    collectParagraphs(document.children ?? [], paragraphs);
    const aligned = enrichments
      ? alignEnrichments(paragraphs.map(alignmentText), enrichments)
      : paragraphs.map(() => null);
    this.enrichments = new Map(
      paragraphs.map((paragraph, index) => [paragraph, aligned[index]]),
    );
    [this.dominantColor, this.dominantBackground] =
      this.dominantColors(paragraphs);
  }

  private dominantColors(
    paragraphs: MammothNode[],
  ): [string | null, string | null] {
    let total = 0;
    const colors = new Map<string, number>();
    const backgrounds = new Map<string, number>();
    const add = (
      map: Map<string, number>,
      key: string | null,
      size: number,
    ) => {
      if (key) map.set(key, (map.get(key) ?? 0) + size);
    };
    for (const paragraph of paragraphs) {
      const enrichment = this.enrichments.get(paragraph);
      if (!enrichment || !this.isColorableParagraph(paragraph)) continue;
      total += enrichment.text.length;
      for (const span of enrichment.colors) {
        add(colors, normalizeHexColor(span.color), span.end - span.start);
        add(
          backgrounds,
          normalizeHexColor(span.backgroundColor),
          span.end - span.start,
        );
      }
    }
    const dominant = (map: Map<string, number>) => {
      for (const [color, size] of map) {
        if (total > 0 && size / total >= DOMINANT_COLOR_SHARE) return color;
      }
      return null;
    };
    return [dominant(colors), dominant(backgrounds)];
  }

  // Headings, quotes and code take their colour from their style.
  private isColorableParagraph(paragraph: MammothNode): boolean {
    return (
      headingLevel(paragraph) === null &&
      !hasStyle(paragraph, QUOTE_STYLE) &&
      !hasStyle(paragraph, CODE_STYLE)
    );
  }

  // ---------------------------------------------------------------------
  // Inline flow

  private pieces(paragraph: MammothNode): Piece[] {
    const pieces: Piece[] = [];
    let offset = 0;
    const base: RunContext = {
      marks: [],
      code: false,
      colorable: this.isColorableParagraph(paragraph),
      highlighted: false,
    };
    const visit = (node: MammothNode, context: RunContext) => {
      switch (node.type) {
        case "run": {
          const inner = runContext(node, context);
          for (const child of node.children ?? []) visit(child, inner);
          return;
        }
        case "hyperlink": {
          const href = safeLinkHref(node.href);
          const inner: RunContext = href
            ? {
                ...context,
                marks: addMark(context.marks, {
                  type: "link",
                  attrs: { href },
                }),
                colorable: false,
              }
            : context;
          for (const child of node.children ?? []) visit(child, inner);
          return;
        }
        case "text":
        case "tab": {
          const text = node.type === "tab" ? "\t" : (node.value ?? "");
          if (text.length > 0) {
            pieces.push({ kind: "text", text, offset, run: context });
            offset += text.length;
          }
          return;
        }
        case "break":
          if (node.breakType === "page") pieces.push({ kind: "pageBreak" });
          else if (node.breakType !== "column")
            pieces.push({ kind: "hardBreak" });
          return;
        case "image":
          pieces.push({ kind: "image", node });
          return;
        default:
          // checkbox, bookmarks, note and comment references: no content.
          return;
      }
    };
    for (const child of paragraph.children ?? []) visit(child, base);
    return this.enrich(paragraph, pieces);
  }

  // Cuts text pieces at officeparser's colour boundaries and equation
  // offsets, then adds the colour marks and the math pieces.
  private enrich(paragraph: MammothNode, pieces: Piece[]): Piece[] {
    const enrichment = this.enrichments.get(paragraph);
    if (!enrichment) return pieces;
    const cuts = new Set<number>();
    for (const span of enrichment.colors) {
      cuts.add(span.start);
      cuts.add(span.end);
    }
    for (const math of enrichment.math) cuts.add(math.offset);
    const pendingMath = [...enrichment.math];
    const out: Piece[] = [];
    const flushMath = (upTo: number) => {
      while (pendingMath.length > 0 && pendingMath[0].offset <= upTo) {
        const math = pendingMath.shift();
        if (math) out.push({ kind: "math", latex: math.latex });
      }
    };
    for (const piece of pieces) {
      if (piece.kind !== "text") {
        out.push(piece);
        continue;
      }
      const end = piece.offset + piece.text.length;
      const points = [...cuts]
        .filter((cut) => cut > piece.offset && cut < end)
        .sort((a, b) => a - b);
      let start = piece.offset;
      for (const point of [...points, end]) {
        flushMath(start);
        const text = piece.text.slice(
          start - piece.offset,
          point - piece.offset,
        );
        out.push({
          ...piece,
          text,
          offset: start,
          run: this.colored(piece.run, enrichment.colors, start),
        });
        start = point;
      }
    }
    flushMath(Number.POSITIVE_INFINITY);
    return out;
  }

  private colored(
    run: RunContext,
    spans: ColorSpan[],
    offset: number,
  ): RunContext {
    if (!run.colorable || run.code) return run;
    const span = spans.find((s) => s.start <= offset && offset < s.end);
    if (!span) return run;
    const color = normalizeHexColor(span.color);
    const background = run.highlighted
      ? null
      : normalizeHexColor(span.backgroundColor);
    const attrs: { color?: string; backgroundColor?: string } = {};
    if (color && color !== this.dominantColor && !NEUTRAL_COLORS.has(color)) {
      attrs.color = color;
    }
    if (
      background &&
      background !== this.dominantBackground &&
      !NEUTRAL_COLORS.has(background)
    ) {
      attrs.backgroundColor = background;
    }
    if (!attrs.color && !attrs.backgroundColor) return run;
    return { ...run, marks: addMark(run.marks, { type: "textStyle", attrs }) };
  }

  private inline(piece: Piece & { kind: "text" }): ImportedText {
    // Tiptap's code mark excludes every other mark.
    const marks: ImportedMark[] = piece.run.code
      ? [{ type: "code" }]
      : piece.run.marks;
    return marks.length > 0
      ? { type: "text", text: piece.text, marks }
      : { type: "text", text: piece.text };
  }

  // The paragraph's inline flow cut into blocks: `wrap` builds each run of
  // inline content; images, page breaks and (in an equation-only
  // paragraph) equations become blocks of their own.
  private flowToBlocks(
    pieces: Piece[],
    wrap: (content: ImportedInline[]) => ImportedBlock | null,
  ): ImportedBlock[] {
    const blocks: ImportedBlock[] = [];
    const equationOnly =
      pieces.some((piece) => piece.kind === "math") &&
      pieces.every(
        (piece) =>
          piece.kind === "math" ||
          (piece.kind === "text" && piece.text.trim().length === 0),
      );
    let inlines: ImportedInline[] = [];
    const flush = () => {
      const content = trimInlines(mergeTexts(inlines));
      inlines = [];
      if (content.length === 0) return;
      const block = wrap(content);
      if (block) blocks.push(block);
    };
    for (const piece of pieces) {
      switch (piece.kind) {
        case "text":
          if (!equationOnly) inlines.push(this.inline(piece));
          break;
        case "hardBreak":
          inlines.push({ type: "hardBreak" });
          break;
        case "math": {
          const latex = importableLatex(piece.latex);
          if (equationOnly) {
            flush();
            blocks.push(
              latex
                ? { type: "blockMath", attrs: { latex } }
                : {
                    type: "paragraph",
                    content: [{ type: "text", text: piece.latex }],
                  },
            );
          } else {
            inlines.push(
              latex
                ? { type: "inlineMath", attrs: { latex } }
                : { type: "text", text: piece.latex },
            );
          }
          break;
        }
        case "pageBreak":
          flush();
          this.pageBreaks++;
          blocks.push({ type: "horizontalRule" });
          break;
        case "image": {
          flush();
          const image = this.image(piece.node);
          if (image) blocks.push(image);
          break;
        }
      }
    }
    flush();
    return blocks;
  }

  private image(node: MammothNode): ImportedBlock | null {
    const bytes = this.imageBytes.get(node);
    const mime = bytes ? sniffImageMime(bytes) : null;
    if (!bytes || !mime) {
      this.skippedImages++;
      return null;
    }
    const key = `image-${this.images.length + 1}`;
    const altText = (node.altText ?? "").trim().slice(0, MAX_ALT_LENGTH);
    const alt = altText.length > 0 ? altText : null;
    this.images.push({ key, bytes, mime, alt });
    return { type: "image", attrs: { assetId: null, pendingId: key, alt } };
  }

  // ---------------------------------------------------------------------
  // Blocks

  private classify(paragraph: MammothNode, pieces: Piece[]): ParagraphKind {
    const level = headingLevel(paragraph);
    if (level) return { kind: "heading", level };
    const checkbox =
      (paragraph.children ?? []).find((child) => child.type === "checkbox") ??
      findCheckbox(paragraph);
    const firstText = pieces.find((piece) => piece.kind === "text");
    const glyph =
      firstText?.kind === "text" ? CHECKBOX_GLYPH.exec(firstText.text) : null;
    if (checkbox || glyph) {
      return {
        kind: "task",
        checked: checkbox ? checkbox.checked === true : glyph?.[1] !== "☐",
      };
    }
    if (paragraph.numbering) {
      const level = Number(paragraph.numbering.level ?? 0);
      return {
        kind: "list",
        level: Number.isFinite(level) ? Math.max(0, Math.min(8, level)) : 0,
        ordered: paragraph.numbering.isOrdered === true,
      };
    }
    const hasBlocks = pieces.some(
      (piece) => piece.kind === "image" || piece.kind === "pageBreak",
    );
    const texts = pieces.filter(
      (piece): piece is Piece & { kind: "text" } => piece.kind === "text",
    );
    if (!hasBlocks && hasStyle(paragraph, CODE_STYLE)) return { kind: "code" };
    if (
      !hasBlocks &&
      texts.some((piece) => piece.text.trim().length > 0) &&
      texts.every((piece) => piece.run.code || piece.text.trim().length === 0)
    ) {
      return { kind: "code" };
    }
    if (hasStyle(paragraph, QUOTE_STYLE)) return { kind: "quote" };
    return { kind: "paragraph" };
  }

  // Maps a sequence of body or cell children, grouping consecutive list,
  // task, code and quote paragraphs into one block each.
  mapBlocks(nodes: readonly MammothNode[], tableDepth = 0): ImportedBlock[] {
    const blocks: ImportedBlock[] = [];
    let group:
      | { kind: "list"; builder: ListBuilder }
      | { kind: "task"; items: ImportedTaskItem[] }
      | { kind: "code"; lines: string[] }
      | { kind: "quote"; blocks: ImportedBlock[] }
      | null = null;
    const closeGroup = () => {
      if (!group) return;
      if (group.kind === "list") blocks.push(...group.builder.finish());
      if (group.kind === "task" && group.items.length > 0) {
        blocks.push({ type: "taskList", content: group.items });
      }
      if (group.kind === "code") {
        const text = group.lines.join("\n").replace(/\n+$/, "");
        if (text.length > 0) {
          blocks.push({
            type: "codeBlock",
            attrs: { language: null },
            content: [{ type: "text", text }],
          });
        }
      }
      if (group.kind === "quote" && group.blocks.length > 0) {
        blocks.push({ type: "blockquote", content: group.blocks });
      }
      group = null;
    };

    for (const node of nodes) {
      if (node.type === "table") {
        closeGroup();
        const table = this.table(node, tableDepth + 1);
        if (table) blocks.push(table);
        continue;
      }
      if (node.type !== "paragraph") continue;
      const pieces = this.pieces(node);
      const kind = this.classify(node, pieces);
      if (group && group.kind !== kind.kind) closeGroup();
      switch (kind.kind) {
        case "heading":
          blocks.push(
            ...this.flowToBlocks(pieces, (content) => ({
              type: "heading",
              attrs: { level: kind.level },
              content,
            })),
          );
          break;
        case "paragraph":
          blocks.push(...this.flowToBlocks(pieces, paragraphOf));
          break;
        case "code": {
          if (!group) group = { kind: "code", lines: [] };
          if (group.kind === "code") group.lines.push(codeLine(pieces));
          break;
        }
        case "quote": {
          if (!group) group = { kind: "quote", blocks: [] };
          if (group.kind === "quote") {
            group.blocks.push(...this.flowToBlocks(pieces, paragraphOf));
          }
          break;
        }
        case "task": {
          if (!group) group = { kind: "task", items: [] };
          if (group.kind === "task") {
            group.items.push({
              type: "taskItem",
              attrs: { checked: kind.checked },
              content: itemContent(
                this.flowToBlocks(stripCheckboxGlyph(pieces), paragraphOf),
              ),
            });
          }
          break;
        }
        case "list": {
          if (!group) group = { kind: "list", builder: new ListBuilder() };
          if (group.kind === "list") {
            const counter = this.enrichments.get(node)?.list ?? null;
            group.builder.add(
              kind.level,
              kind.ordered,
              counter?.listId ?? null,
              () => this.startFor(kind.level, counter),
              itemContent(this.flowToBlocks(pieces, paragraphOf)),
            );
          }
          break;
        }
      }
    }
    closeGroup();
    return blocks;
  }

  // Ordered `start` from officeparser's counter: itemIndex is the number
  // shown minus one. A nested level restarts at its own start, which is
  // the index of the first item ever seen at that level.
  private startFor(
    level: number,
    counter: ParagraphEnrichment["list"],
  ): number {
    if (!counter) return 1;
    const key = `${counter.listId}:${counter.level}`;
    if (!this.levelStarts.has(key))
      this.levelStarts.set(key, counter.itemIndex);
    const index =
      level === 0 ? counter.itemIndex : (this.levelStarts.get(key) ?? 0);
    return index + 1;
  }

  private table(node: MammothNode, depth: number): ImportedBlock | null {
    if (depth > MAX_TABLE_NESTING) {
      throw new OoxmlLimitError(`tables nested ${depth} deep`);
    }
    const rows: ImportedTableRow[] = [];
    for (const row of node.children ?? []) {
      if (row.type !== "tableRow") continue;
      const cells: ImportedTableCell[] = [];
      for (const cell of row.children ?? []) {
        if (cell.type !== "tableCell") continue;
        const content = this.mapBlocks(cell.children ?? [], depth);
        cells.push({
          type: row.isHeader ? "tableHeader" : "tableCell",
          attrs: {
            colspan: Math.max(1, cell.colSpan ?? 1),
            rowspan: Math.max(1, cell.rowSpan ?? 1),
            colwidth: null,
          },
          content: content.length > 0 ? content : [{ type: "paragraph" }],
        });
      }
      if (cells.length > 0) rows.push({ type: "tableRow", content: cells });
    }
    return rows.length > 0 ? { type: "table", content: rows } : null;
  }
}

function findCheckbox(paragraph: MammothNode): MammothNode | undefined {
  let found: MammothNode | undefined;
  walkInline(paragraph, (node) => {
    if (!found && node.type === "checkbox") found = node;
  });
  return found;
}

function paragraphOf(content: ImportedInline[]): ImportedParagraph {
  return { type: "paragraph", content };
}

// A list or task item must start with a paragraph.
function itemContent(
  blocks: ImportedBlock[],
): [ImportedParagraph, ...ImportedBlock[]] {
  const [first, ...rest] = blocks;
  if (first?.type === "paragraph") return [first, ...rest];
  return [{ type: "paragraph" }, ...blocks];
}

function codeLine(pieces: Piece[]): string {
  return pieces
    .map((piece) => {
      if (piece.kind === "text") return piece.text;
      if (piece.kind === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

// Removes the ☐/☑/☒ glyph (and the space after a checkbox control) that
// opens a task item.
function stripCheckboxGlyph(pieces: Piece[]): Piece[] {
  const index = pieces.findIndex((piece) => piece.kind === "text");
  if (index < 0) return pieces;
  const piece = pieces[index];
  if (piece.kind !== "text") return pieces;
  const text = piece.text.replace(CHECKBOX_GLYPH, "").replace(/^\s+/, "");
  const out = [...pieces];
  if (text.length > 0) out[index] = { ...piece, text };
  else out.splice(index, 1);
  return out;
}

function mergeTexts(inlines: ImportedInline[]): ImportedInline[] {
  const out: ImportedInline[] = [];
  for (const inline of inlines) {
    const last = out.at(-1);
    if (
      inline.type === "text" &&
      last?.type === "text" &&
      sameMarks(last.marks, inline.marks)
    ) {
      out[out.length - 1] = { ...last, text: last.text + inline.text };
    } else if (inline.type !== "text" || inline.text.length > 0) {
      out.push(inline);
    }
  }
  return out;
}

// Drops leading/trailing hard breaks and a content that is only
// whitespace, so no empty paragraph survives.
function trimInlines(inlines: ImportedInline[]): ImportedInline[] {
  let start = 0;
  let end = inlines.length;
  while (start < end && inlines[start].type === "hardBreak") start++;
  while (end > start && inlines[end - 1].type === "hardBreak") end--;
  const content = inlines.slice(start, end);
  const meaningful = content.some(
    (inline) => inline.type !== "text" || inline.text.trim().length > 0,
  );
  return meaningful ? content : [];
}

// Builds nested bullet/ordered lists from flat (level, ordered) items.
class ListBuilder {
  private readonly roots: Array<ImportedBulletList | ImportedOrderedList> = [];
  private stack: Array<{
    list: ImportedBulletList | ImportedOrderedList;
    level: number;
    listId: string | null;
  }> = [];

  add(
    level: number,
    ordered: boolean,
    listId: string | null,
    start: () => number,
    content: ImportedListItem["content"],
  ) {
    while (this.stack.length > 0 && (this.stack.at(-1)?.level ?? 0) > level) {
      this.stack.pop();
    }
    const top = this.stack.at(-1);
    const isOrdered = (list: ImportedBulletList | ImportedOrderedList) =>
      list.type === "orderedList";
    if (
      top &&
      top.level === level &&
      (isOrdered(top.list) !== ordered ||
        (this.stack.length === 1 &&
          listId !== null &&
          top.listId !== null &&
          listId !== top.listId))
    ) {
      this.stack.pop();
    }
    const item: ImportedListItem = { type: "listItem", content };
    const current = this.stack.at(-1);
    if (current && current.level === level) {
      current.list.content.push(item);
      return;
    }
    const list = newList(ordered, start(), item);
    if (current) {
      // Nested under the parent's last item.
      const parentItem = current.list.content.at(-1);
      parentItem?.content.push(list);
    } else {
      this.roots.push(list);
    }
    this.stack.push({ list, level, listId });
  }

  finish(): ImportedBlock[] {
    return this.roots;
  }
}

function newList(
  ordered: boolean,
  start: number,
  item: ImportedListItem,
): ImportedBulletList | ImportedOrderedList {
  if (!ordered) return { type: "bulletList", content: [item] };
  return start !== 1
    ? { type: "orderedList", attrs: { start }, content: [item] }
    : { type: "orderedList", content: [item] };
}

// Reads every image's bytes up front (mammoth's reads are async) so the
// mapping itself stays synchronous.
async function readImages(
  document: MammothNode,
): Promise<Map<MammothNode, Uint8Array>> {
  const nodes: MammothNode[] = [];
  collectImages(document.children ?? [], nodes);
  const entries = await Promise.all(
    nodes.map(async (node): Promise<[MammothNode, Uint8Array] | null> => {
      try {
        const buffer = await node.readAsArrayBuffer?.();
        return buffer ? [node, new Uint8Array(buffer)] : null;
      } catch {
        // A missing or unreadable image part: counted as skipped.
        return null;
      }
    }),
  );
  return new Map(entries.filter((entry) => entry !== null));
}

export async function mapDocxModel(
  document: MammothNode,
  enrichments: readonly ParagraphEnrichment[] | null,
): Promise<MappedDocx> {
  const mapper = new DocxMapper(
    document,
    enrichments,
    await readImages(document),
  );
  const content = mapper.mapBlocks(document.children ?? []);
  return {
    content: { type: "doc", content },
    images: mapper.images,
    skippedImages: mapper.skippedImages,
    pageBreaks: mapper.pageBreaks,
  };
}
