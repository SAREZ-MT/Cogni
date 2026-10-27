import type { ExtractedImage } from "../domain/document-extractor";
import {
  IMAGE_LIMITS,
  type ImageLimits,
  sniffImageMime,
} from "../domain/image-mime";
import {
  itemContent,
  ListBuilder,
  MAX_ALT_LENGTH,
  mergeTexts,
  trimInlines,
} from "../domain/imported-blocks";
import type {
  ImportedBlock,
  ImportedDetails,
  ImportedDoc,
  ImportedHeading,
  ImportedInline,
  ImportedListItem,
  ImportedMark,
  ImportedParagraph,
  ImportedTableCell,
  ImportedTableRow,
  ImportedText,
} from "../domain/imported-doc";
import { hasTextContent } from "../domain/imported-doc";
import {
  dominantColor,
  isMonospaceFont,
  NEUTRAL_COLORS,
  normalizeHexColor,
  safeLinkHref,
} from "../domain/imported-marks";
import { importableLatex } from "../domain/omml-latex";
import type { SlideTitleKind, TableCellSpan } from "../domain/pptx-xml";

// document-import T7: maps officeparser's PPTX AST, slide by slide, to an
// ImportedDoc. See pptx-document-extractor.ts for what is read from the
// slide XML around it (deck order, hidden slides and shapes, master
// bullets, table spans, picture parts).
//
// Per slide, in order: its title as a heading (level 2; level 1 for a
// title slide's centred title, `ctrTitle`; "Diapositiva N" when the slide
// has no title but other content), its body blocks, then its speaker
// notes as a closed `details` block summarised "Notas del orador". No
// separator between slides: each slide already opens with its heading.

// The subset of officeparser's OfficeContentNode the mapper reads.
export type OfficeNode = {
  type: string;
  text?: string;
  children?: OfficeNode[];
  metadata?: Record<string, unknown>;
  formatting?: Record<string, unknown>;
  notes?: OfficeNode[];
};

export type SlideSource = {
  // 1-based place in the deck (hidden slides included), as PowerPoint
  // numbers it.
  number: number;
  titleKind: SlideTitleKind;
  // officeparser's slide node; null when it emitted none (an empty slide).
  node: OfficeNode | null;
  // readTableSpans() of the slide, in officeparser's table order.
  tables: TableCellSpan[][][];
  // Picture file name (officeparser's `attachmentName`) → media part.
  pictures: ReadonlyMap<string, string>;
};

export type MappedPptx = {
  content: ImportedDoc;
  images: ExtractedImage[];
  skippedImages: number;
  pagesWithoutText: number;
};

// Reads a media part; throws when the package refuses it (over the image
// cap, missing, malformed). Limit breaches on XML are not media reads.
export type MediaReader = (path: string) => Uint8Array;

export const NOTES_SUMMARY = "Notas del orador";
export const untitledSlideHeading = (number: number) => `Diapositiva ${number}`;

type Run = { text: string; marks: ImportedMark[] } | { math: string };

function stringOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function children(node: OfficeNode | null | undefined): OfficeNode[] {
  return node?.children ?? [];
}

function hasText(blocks: ImportedBlock[]): boolean {
  return hasTextContent({ type: "doc", content: blocks });
}

class PptxMapper {
  readonly images: ExtractedImage[] = [];
  skippedImages = 0;
  private readonly imageKeys = new Map<string, string | null>();
  private imageBytesRead = 0;
  private dominant: string | null = null;
  private dominantBackground: string | null = null;

  constructor(
    private readonly readMedia: MediaReader,
    private readonly limits: ImageLimits,
  ) {}

  map(slides: readonly SlideSource[]): MappedPptx {
    [this.dominant, this.dominantBackground] = this.dominantColors(slides);
    const mapped = slides.map((slide) => this.slide(slide));
    const deckHasText = mapped.some(
      (slide) => slide.ownText || slide.notesText,
    );
    const content: ImportedBlock[] = [];
    let pagesWithoutText = 0;
    for (const slide of mapped) {
      if (!slide.ownText) pagesWithoutText++;
      if (slide.body.length === 0 && slide.notes.length === 0 && !slide.title) {
        continue;
      }
      // A deck with no text at all keeps no synthesised heading either, so
      // processImportJob still sees it as empty (`empty_document`).
      const heading = slide.title ?? (deckHasText ? slide.untitled : null);
      if (heading) content.push(heading);
      content.push(...slide.body);
      if (slide.notes.length > 0) content.push(notesBlock(slide.notes));
    }
    return {
      content: { type: "doc", content },
      images: this.images,
      skippedImages: this.skippedImages,
      pagesWithoutText,
    };
  }

  // -------------------------------------------------------------------
  // Slides

  private slide(slide: SlideSource) {
    const nodes = children(slide.node);
    const titleNodes = nodes.filter((node) => node.type === "heading");
    const titleInlines: ImportedInline[] = [];
    for (const node of titleNodes) {
      const inlines = this.inlines(node, { colorable: false });
      if (inlines.length === 0) continue;
      if (titleInlines.length > 0) titleInlines.push({ type: "hardBreak" });
      titleInlines.push(...inlines);
    }
    const level = slide.titleKind === "ctrTitle" ? 1 : 2;
    const title: ImportedHeading | null =
      titleInlines.length > 0
        ? { type: "heading", attrs: { level }, content: titleInlines }
        : null;
    const tables = [...slide.tables];
    const body = this.blocks(
      nodes.filter((node) => node.type !== "heading"),
      { tables, pictures: slide.pictures },
    );
    const notes = this.blocks(
      (slide.node?.notes ?? []).flatMap((note) => children(note)),
      { tables: [], pictures: new Map() },
    );
    return {
      title,
      untitled: {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: untitledSlideHeading(slide.number) }],
      } satisfies ImportedHeading,
      body,
      notes,
      ownText: title !== null || hasText(body),
      notesText: hasText(notes),
    };
  }

  // -------------------------------------------------------------------
  // Blocks

  private blocks(
    nodes: readonly OfficeNode[],
    context: {
      tables: TableCellSpan[][][];
      pictures: ReadonlyMap<string, string>;
    },
  ): ImportedBlock[] {
    const out: ImportedBlock[] = [];
    let list: ListBuilder | null = null;
    // The bullet the next node may continue (its officeparser node and
    // the item it became, null while its text is still blank). Reset by
    // every node that does not continue it.
    type OpenBullet = { node: OfficeNode; item: ImportedListItem | null };
    let open: OpenBullet | null = null;
    const flushList = () => {
      if (list) out.push(...list.finish());
      list = null;
    };
    const addItem = (
      source: OfficeNode,
      flow: ImportedBlock[],
    ): ImportedListItem => {
      list ??= new ListBuilder();
      return list.add(
        clampLevel(source.metadata?.indentation),
        source.metadata?.listType === "ordered",
        stringOf(source.metadata?.listId),
        () => 1,
        itemContent(flow),
      );
    };
    for (const node of nodes) {
      const bullet: OpenBullet | null = open;
      open = null;
      switch (node.type) {
        case "list": {
          const flow = this.flow(node, { colorable: true });
          open = { node, item: flow.length > 0 ? addItem(node, flow) : null };
          break;
        }
        case "paragraph": {
          const flow = this.flow(node, { colorable: true });
          const first = flow[0];
          const continues =
            bullet !== null && isSoftBreakContinuation(node, bullet.node);
          if (continues && flow.length === 0) {
            // A blank line of the bullet: the next one may still follow.
            open = bullet;
            break;
          }
          if (continues && flow.length === 1 && first.type === "paragraph") {
            // The next line of the same bullet: after a line break in its
            // item, or the item's first line when the text before the
            // break was blank.
            if (bullet.item) {
              const paragraph = bullet.item.content[0];
              paragraph.content = [
                ...(paragraph.content ?? []),
                { type: "hardBreak" },
                ...(first.content ?? []),
              ];
            } else {
              bullet.item = addItem(bullet.node, flow);
            }
            open = bullet;
            break;
          }
          if (flow.length === 0) break;
          flushList();
          out.push(...flow);
          break;
        }
        case "table": {
          flushList();
          const table = this.table(
            node,
            context.tables.shift() ?? null,
            context,
          );
          if (table) out.push(table);
          break;
        }
        case "image": {
          flushList();
          const image = this.image(node, context.pictures);
          if (image) out.push(image);
          break;
        }
        default:
          // Charts (their data is not read), comments and anything else
          // officeparser may add: not imported.
          flushList();
      }
    }
    flushList();
    return out;
  }

  // A paragraph's runs as one paragraph — or, when it holds only
  // equations, one blockMath each.
  private flow(
    node: OfficeNode,
    options: { colorable: boolean },
  ): ImportedBlock[] {
    const runs = this.runs(node, options);
    const equationOnly =
      runs.some((run) => "math" in run) &&
      runs.every((run) => "math" in run || run.text.trim().length === 0);
    if (equationOnly) {
      return runs.flatMap((run): ImportedBlock[] => {
        if (!("math" in run)) return [];
        const latex = importableLatex(run.math);
        return [
          latex
            ? { type: "blockMath", attrs: { latex } }
            : {
                type: "paragraph",
                content: [{ type: "text", text: run.math }],
              },
        ];
      });
    }
    const content = this.inlineRuns(runs);
    return content.length > 0 ? [paragraphOf(content)] : [];
  }

  private inlines(
    node: OfficeNode,
    options: { colorable: boolean },
  ): ImportedInline[] {
    return this.inlineRuns(this.runs(node, options));
  }

  private inlineRuns(runs: Run[]): ImportedInline[] {
    const inlines: ImportedInline[] = [];
    for (const run of runs) {
      if ("math" in run) {
        const latex = importableLatex(run.math);
        inlines.push(
          latex
            ? { type: "inlineMath", attrs: { latex } }
            : { type: "text", text: run.math },
        );
        continue;
      }
      // officeparser writes a line break inside a paragraph as "\n".
      const lines = run.text.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) inlines.push({ type: "hardBreak" });
        if (line.length > 0) inlines.push(textOf(line, run.marks));
      });
    }
    return trimInlines(mergeTexts(inlines));
  }

  private runs(node: OfficeNode, options: { colorable: boolean }): Run[] {
    const runs: Run[] = [];
    for (const child of children(node)) {
      if (child.type === "code" && child.metadata?.math) {
        runs.push({ math: child.text ?? "" });
      } else if (child.type === "text" && typeof child.text === "string") {
        runs.push({ text: child.text, marks: this.marks(child, options) });
      }
    }
    return runs;
  }

  private marks(
    node: OfficeNode,
    options: { colorable: boolean },
  ): ImportedMark[] {
    const format = node.formatting ?? {};
    const linked = node.metadata?.link !== undefined;
    const href =
      node.metadata?.linkType === "external"
        ? safeLinkHref(stringOf(node.metadata?.link))
        : null;
    // Tiptap's code mark excludes every other mark.
    if (isMonospaceFont(stringOf(format.font))) return [{ type: "code" }];
    const marks: ImportedMark[] = [];
    if (format.bold === true) marks.push({ type: "bold" });
    if (format.italic === true) marks.push({ type: "italic" });
    // PowerPoint underlines every hyperlink run: that is the link's look,
    // not an emphasis, and it goes with the link (kept or dropped).
    if (format.underline === true && !linked) marks.push({ type: "underline" });
    if (format.strikethrough === true) marks.push({ type: "strike" });
    if (format.subscript === true) marks.push({ type: "subscript" });
    if (format.superscript === true) marks.push({ type: "superscript" });
    if (options.colorable && !linked) {
      const attrs: { color?: string; backgroundColor?: string } = {};
      const color = normalizeHexColor(stringOf(format.color));
      const background = normalizeHexColor(stringOf(format.backgroundColor));
      if (color && color !== this.dominant && !NEUTRAL_COLORS.has(color)) {
        attrs.color = color;
      }
      if (
        background &&
        background !== this.dominantBackground &&
        !NEUTRAL_COLORS.has(background)
      ) {
        attrs.backgroundColor = background;
      }
      if (attrs.color || attrs.backgroundColor) {
        marks.push({ type: "textStyle", attrs });
      }
    }
    if (href) marks.push({ type: "link", attrs: { href } });
    return marks;
  }

  // The deck's base text colour (≥ 50 % of the body text, titles left out)
  // is the template's look, not an emphasis, and is not imported.
  private dominantColors(
    slides: readonly SlideSource[],
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
    const visit = (node: OfficeNode) => {
      if (node.type === "heading") return;
      if (node.type === "text" && typeof node.text === "string") {
        const size = node.text.length;
        total += size;
        add(colors, normalizeHexColor(stringOf(node.formatting?.color)), size);
        add(
          backgrounds,
          normalizeHexColor(stringOf(node.formatting?.backgroundColor)),
          size,
        );
        return;
      }
      for (const child of children(node)) visit(child);
    };
    for (const slide of slides)
      for (const node of children(slide.node)) visit(node);
    return [dominantColor(colors, total), dominantColor(backgrounds, total)];
  }

  // -------------------------------------------------------------------
  // Tables

  // officeparser reports a plain grid — the cells a span covers come out
  // as empty cells — so spans are taken from the slide XML's table, cell
  // by cell, and the covered cells are left out. When the XML table does
  // not match officeparser's grid, every cell is kept without spans.
  // The first row is the header row; colwidth is null.
  private table(
    node: OfficeNode,
    spans: TableCellSpan[][] | null,
    context: { pictures: ReadonlyMap<string, string> },
  ): ImportedBlock | null {
    const grid = children(node)
      .filter((row) => row.type === "row")
      .map((row) => children(row).filter((cell) => cell.type === "cell"));
    const matches =
      spans !== null &&
      spans.length === grid.length &&
      spans.every((row, index) => row.length === grid[index].length);
    const rows: ImportedTableRow[] = [];
    grid.forEach((cells, rowIndex) => {
      const out: ImportedTableCell[] = [];
      cells.forEach((cell, colIndex) => {
        const span = matches ? spans[rowIndex][colIndex] : null;
        if (span && (span.hMerge || span.vMerge)) return;
        const content = this.blocks(children(cell), {
          tables: [],
          pictures: context.pictures,
        });
        out.push({
          type: rowIndex === 0 ? "tableHeader" : "tableCell",
          attrs: {
            colspan: span?.gridSpan ?? 1,
            rowspan: span?.rowSpan ?? 1,
            colwidth: null,
          },
          content: content.length > 0 ? content : [{ type: "paragraph" }],
        });
      });
      if (out.length > 0) rows.push({ type: "tableRow", content: out });
    });
    return rows.length > 0 ? { type: "table", content: rows } : null;
  }

  // -------------------------------------------------------------------
  // Images

  // One ExtractedImage per media part (a picture shown on several slides
  // is uploaded once); read one at a time, within the count, per-image
  // and total caps (IMAGE_LIMITS, shared with DOCX). A picture that is
  // missing, refused, over a cap or not png/jpeg/gif/webp is skipped and
  // counted.
  private image(
    node: OfficeNode,
    pictures: ReadonlyMap<string, string>,
  ): ImportedBlock | null {
    const name = stringOf(node.metadata?.attachmentName);
    const path = name ? pictures.get(name) : undefined;
    if (!path) {
      this.skippedImages++;
      return null;
    }
    const altText = (stringOf(node.metadata?.altText) ?? "")
      .trim()
      .slice(0, MAX_ALT_LENGTH);
    const alt = altText.length > 0 ? altText : null;
    let key = this.imageKeys.get(path);
    if (key === undefined) {
      key = this.readImage(path, alt);
      this.imageKeys.set(path, key);
    }
    if (key === null) {
      this.skippedImages++;
      return null;
    }
    return { type: "image", attrs: { assetId: null, pendingId: key, alt } };
  }

  private readImage(path: string, alt: string | null): string | null {
    if (this.images.length >= this.limits.maxImages) return null;
    let bytes: Uint8Array;
    try {
      bytes = this.readMedia(path);
    } catch {
      return null;
    }
    if (bytes.length > this.limits.maxImageBytes) return null;
    if (this.imageBytesRead + bytes.length > this.limits.maxTotalBytes) {
      return null;
    }
    const mime = sniffImageMime(bytes);
    if (!mime) return null;
    this.imageBytesRead += bytes.length;
    const key = `image-${this.images.length + 1}`;
    this.images.push({ key, bytes, mime, alt });
    return key;
  }
}

// officeparser 8.2 splits a bulleted `a:p` at each `a:br` (a soft line
// break, Shift+Enter) into the list node and one paragraph per further
// line, emitted right after it, whose metadata is exactly
// `paragraphIndentation: { left: <the bullet's lvl> }` and the bullet's
// alignment. A separate `a:p` — indented or not — never has that shape, so
// it stays a paragraph of its own. The caller checks adjacency.
function isSoftBreakContinuation(
  node: OfficeNode,
  bullet: OfficeNode,
): boolean {
  const metadata = node.metadata ?? {};
  const indentation = metadata.paragraphIndentation;
  if (
    typeof indentation !== "object" ||
    indentation === null ||
    Object.keys(indentation).join() !== "left"
  ) {
    return false;
  }
  const left = (indentation as { left: unknown }).left;
  return (
    Object.keys(metadata).every(
      (key) => key === "paragraphIndentation" || key === "alignment",
    ) &&
    typeof left === "number" &&
    left === bullet.metadata?.indentation &&
    metadata.alignment === bullet.metadata?.alignment
  );
}

function clampLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(8, Math.trunc(value)))
    : 0;
}

function textOf(text: string, marks: ImportedMark[]): ImportedText {
  return marks.length > 0
    ? { type: "text", text, marks }
    : { type: "text", text };
}

function paragraphOf(content: ImportedInline[]): ImportedParagraph {
  return { type: "paragraph", content };
}

function notesBlock(blocks: ImportedBlock[]): ImportedDetails {
  return {
    type: "details",
    attrs: { open: false },
    content: [
      {
        type: "detailsSummary",
        content: [{ type: "text", text: NOTES_SUMMARY }],
      },
      { type: "detailsContent", content: blocks },
    ],
  };
}

export function mapPptxSlides(
  slides: readonly SlideSource[],
  readMedia: MediaReader,
  imageLimits: ImageLimits = IMAGE_LIMITS,
): MappedPptx {
  return new PptxMapper(readMedia, imageLimits).map(slides);
}
