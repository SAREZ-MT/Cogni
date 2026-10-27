import { qualifiedAttribute, tags } from "./xml-tags";

// document-import T7: what the PPTX adapter reads from the slide XML
// itself, around officeparser (which reads the text, runs, lists, notes and
// pictures). Pure TypeScript over the tag scanner (xml-tags.ts): no DOM.
//
// Element names are matched with the conventional prefixes (`p:`, `a:`,
// `r:`), exactly as officeparser 8 does (its PowerPointParser looks up
// `p:sp`, `a:tbl`, … by qualified name), so what these readers count lines
// up with what officeparser reads.

export type Relationship = {
  // The last segment of the relationship type URI (`image`, `hyperlink`,
  // `slide`, `notesSlide`, `slideLayout`, `slideMaster`, …).
  type: string;
  // A package part path (`ppt/media/image1.png`) or, when external, the
  // target as written.
  target: string;
  external: boolean;
};

// `ppt/slides/slide1.xml` → `ppt/slides/_rels/slide1.xml.rels`.
export function relsPathOf(partPath: string): string {
  const slash = partPath.lastIndexOf("/");
  const folder = slash === -1 ? "" : partPath.slice(0, slash + 1);
  return `${folder}_rels/${partPath.slice(slash + 1)}.rels`;
}

function resolvePartPath(fromPart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const segments = fromPart.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "..") segments.pop();
    else if (segment !== "." && segment !== "") segments.push(segment);
  }
  return segments.join("/");
}

export function readRelationships(
  relsXml: string,
  partPath: string,
): Map<string, Relationship> {
  const rels = new Map<string, Relationship>();
  for (const tag of tags(relsXml)) {
    if (tag.kind === "close" || !/(^|:)Relationship$/.test(tag.name)) continue;
    const id = qualifiedAttribute(tag.attrs, "Id");
    const type = qualifiedAttribute(tag.attrs, "Type");
    const target = qualifiedAttribute(tag.attrs, "Target");
    if (!id || !type || target === null || rels.has(id)) continue;
    const external =
      qualifiedAttribute(tag.attrs, "TargetMode")?.toLowerCase() === "external";
    rels.set(id, {
      type: type.slice(type.lastIndexOf("/") + 1),
      target: external ? target : resolvePartPath(partPath, target),
      external,
    });
  }
  return rels;
}

// The `r:id` of every `p:sldId` in the presentation's slide list, in the
// order the presentation shows the slides.
export function slideRelIds(presentationXml: string): string[] {
  const ids: string[] = [];
  let inList = false;
  for (const tag of tags(presentationXml)) {
    if (tag.name === "p:sldIdLst") {
      inList = tag.kind === "open";
      continue;
    }
    if (inList && tag.name === "p:sldId" && tag.kind !== "close") {
      const id = qualifiedAttribute(tag.attrs, "r:id");
      if (id) ids.push(id);
    }
  }
  return ids;
}

// A slide hidden from the slide show: `<p:sld show="0">`.
export function isHiddenSlide(slideXml: string): boolean {
  for (const tag of tags(slideXml)) {
    if (tag.kind === "close") continue;
    if (tag.name !== "p:sld") return false;
    const show = qualifiedAttribute(tag.attrs, "show")?.trim().toLowerCase();
    return show === "0" || show === "false";
  }
  return false;
}

export type SlideTitleKind = "ctrTitle" | "title" | null;

// The title placeholder the slide carries: `ctrTitle` (a title slide),
// `title`, or none.
export function slideTitleKind(slideXml: string): SlideTitleKind {
  let kind: SlideTitleKind = null;
  for (const tag of tags(slideXml)) {
    if (tag.kind === "close" || tag.name !== "p:ph") continue;
    const type = qualifiedAttribute(tag.attrs, "type");
    if (type === "ctrTitle") return "ctrTitle";
    if (type === "title") kind = "title";
  }
  return kind;
}

const SHAPES = new Set([
  "p:sp",
  "p:pic",
  "p:graphicFrame",
  "p:grpSp",
  "p:cxnSp",
  "mc:AlternateContent",
]);
// Placeholders that repeat page furniture, not content: slide number,
// date, footer, header. Their text is never imported.
const FURNITURE_PLACEHOLDERS = new Set(["sldNum", "dt", "ftr", "hdr"]);
const TRUE_VALUES = new Set(["1", "true"]);

type ShapeFrame = { name: string; start: number; drop: boolean };

// Removes the shapes the audience never sees — hidden ones
// (`p:cNvPr hidden="1"`, a group's hiding its children too) — and the
// page-furniture placeholders (slide number, date, footer, header; on a
// notes page the slide number officeparser would read as a paragraph).
// Everything else stays byte for byte.
export function stripInvisibleShapes(xml: string): string {
  if (!/hidden=|type=["'](sldNum|dt|ftr|hdr)["']/.test(xml)) return xml;
  const stack: ShapeFrame[] = [];
  const removed: Array<[number, number]> = [];
  for (const tag of tags(xml)) {
    if (SHAPES.has(tag.name)) {
      if (tag.kind === "open") {
        stack.push({ name: tag.name, start: tag.start, drop: false });
      } else if (tag.kind === "close") {
        let frame = stack.pop();
        while (frame && frame.name !== tag.name) frame = stack.pop();
        if (frame?.drop) removed.push([frame.start, tag.end]);
      }
      continue;
    }
    if (tag.kind === "close") continue;
    const shape = stack.at(-1);
    if (!shape) continue;
    if (tag.name === "p:cNvPr") {
      const hidden = qualifiedAttribute(tag.attrs, "hidden");
      if (hidden && TRUE_VALUES.has(hidden.trim().toLowerCase())) {
        shape.drop = true;
      }
    } else if (tag.name === "p:ph") {
      const type = qualifiedAttribute(tag.attrs, "type");
      if (type && FURNITURE_PLACEHOLDERS.has(type)) shape.drop = true;
    }
  }
  return cut(xml, removed);
}

function cut(xml: string, removed: Array<[number, number]>): string {
  if (removed.length === 0) return xml;
  removed.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of removed) {
    if (start < cursor) continue; // inside a range already removed
    out += xml.slice(cursor, start);
    cursor = end;
  }
  return out + xml.slice(cursor);
}

export type TableCellSpan = {
  gridSpan: number;
  rowSpan: number;
  // A placeholder cell covered by a span to its left / above.
  hMerge: boolean;
  vMerge: boolean;
};

function positiveInt(value: string | null): number {
  const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function isOn(value: string | null): boolean {
  return value !== null && TRUE_VALUES.has(value.trim().toLowerCase());
}

// Every `a:tbl` of the slide in document order (the order officeparser
// reads them in), as rows of cells with their spans. officeparser reports
// a plain grid (the covered cells as empty ones), so the adapter takes the
// spans from here.
export function readTableSpans(slideXml: string): TableCellSpan[][][] {
  // Registered when opened, so a nested table follows its outer one.
  const tables: TableCellSpan[][][] = [];
  const open: TableCellSpan[][][] = [];
  for (const tag of tags(slideXml)) {
    if (tag.name === "a:tbl") {
      if (tag.kind === "open") {
        const table: TableCellSpan[][] = [];
        tables.push(table);
        open.push(table);
      } else if (tag.kind === "close") {
        open.pop();
      }
      continue;
    }
    const table = open.at(-1);
    if (!table || tag.kind === "close") continue;
    if (tag.name === "a:tr") table.push([]);
    else if (tag.name === "a:tc") {
      table.at(-1)?.push({
        gridSpan: positiveInt(qualifiedAttribute(tag.attrs, "gridSpan")),
        rowSpan: positiveInt(qualifiedAttribute(tag.attrs, "rowSpan")),
        hMerge: isOn(qualifiedAttribute(tag.attrs, "hMerge")),
        vMerge: isOn(qualifiedAttribute(tag.attrs, "vMerge")),
      });
    }
  }
  return tables;
}

export type BulletKind = "bullet" | "number" | "none";
const LEVELS = 9;

// The bullet each of the 9 body levels takes from the slide master
// (`p:txStyles/p:bodyStyle/a:lvlNpPr`). A level the master leaves unset is
// "none".
export function readMasterBodyBullets(masterXml: string): BulletKind[] {
  const levels: BulletKind[] = Array.from({ length: LEVELS }, () => "none");
  let inBody = false;
  let level = -1;
  for (const tag of tags(masterXml)) {
    if (tag.name === "p:bodyStyle") {
      inBody = tag.kind === "open";
      continue;
    }
    if (!inBody) continue;
    const match = /^a:lvl([1-9])pPr$/.exec(tag.name);
    if (match) {
      level = tag.kind === "open" ? Number(match[1]) - 1 : -1;
      continue;
    }
    if (level < 0 || tag.kind === "close") continue;
    const kind = bulletOf(tag.name);
    if (kind) levels[level] = kind;
  }
  return levels;
}

function bulletOf(name: string): BulletKind | null {
  if (name === "a:buChar" || name === "a:buBlip") return "bullet";
  if (name === "a:buAutoNum") return "number";
  if (name === "a:buNone") return "none";
  return null;
}

// Placeholders whose text is body text (bulleted by the master's body
// style): no type (a content placeholder, `obj`), `body` or `obj`.
const BODY_PLACEHOLDER_TYPES = new Set(["body", "obj"]);
const BULLET_MARKUP: Record<Exclude<BulletKind, "none">, string> = {
  bullet: '<a:buChar char="•"/>',
  number: '<a:buAutoNum type="arabicPeriod"/>',
};

type ParagraphFrame = {
  // Where to insert a bullet: right after `<a:p>` (no pPr yet) or after
  // the pPr's start tag (with `selfClosing`, the pPr must be reopened).
  insertAt: number;
  pPr: {
    start: number;
    end: number;
    selfClosing: boolean;
    attrs: string;
  } | null;
  level: number;
  explicit: boolean;
  hasText: boolean;
};

// officeparser marks a paragraph as a list item only when the paragraph
// itself names a bullet (`a:buChar`/`a:buAutoNum`). In PowerPoint the
// bullets of a content placeholder usually come from the slide master's
// body style instead, so without this every bulleted slide would import as
// plain paragraphs. For each paragraph of a body placeholder that sets no
// bullet of its own (and whose shape's list style does not turn the level
// off), the master's bullet for its level is written into the paragraph's
// properties before officeparser reads the slide. Residual: overrides in
// the slide layout's placeholder are not resolved.
export function markInheritedBullets(
  slideXml: string,
  levels: readonly BulletKind[],
): string {
  if (!levels.some((kind) => kind !== "none")) return slideXml;
  const inserts: Array<{ at: number; text: string; replaceTo?: number }> = [];
  let shapeDepth = 0;
  let bodyShape = false;
  let lstStyleOff = new Set<number>();
  let lstLevel = -1;
  let inLstStyle = false;
  let paragraph: ParagraphFrame | null = null;
  let inPPr = false;

  for (const tag of tags(slideXml)) {
    if (tag.name === "p:sp") {
      if (tag.kind === "open") {
        shapeDepth++;
        bodyShape = false;
        lstStyleOff = new Set();
      } else if (tag.kind === "close") {
        shapeDepth = Math.max(0, shapeDepth - 1);
        bodyShape = false;
      }
      continue;
    }
    if (shapeDepth === 0) continue;
    if (tag.name === "p:ph" && tag.kind !== "close") {
      const type = qualifiedAttribute(tag.attrs, "type");
      bodyShape = type === null || BODY_PLACEHOLDER_TYPES.has(type);
      continue;
    }
    if (!bodyShape) continue;
    if (tag.name === "a:lstStyle") {
      inLstStyle = tag.kind === "open";
      continue;
    }
    if (inLstStyle) {
      const match = /^a:lvl([1-9])pPr$/.exec(tag.name);
      if (match) lstLevel = tag.kind === "open" ? Number(match[1]) - 1 : -1;
      else if (lstLevel >= 0 && tag.kind !== "close") {
        const kind = bulletOf(tag.name);
        if (kind === "none") lstStyleOff.add(lstLevel);
      }
      continue;
    }
    if (tag.name === "a:p") {
      if (tag.kind === "open") {
        paragraph = {
          insertAt: tag.end,
          pPr: null,
          level: 0,
          explicit: false,
          hasText: false,
        };
      } else if (tag.kind === "close" && paragraph) {
        const kind = levels[paragraph.level] ?? "none";
        if (
          paragraph.hasText &&
          !paragraph.explicit &&
          kind !== "none" &&
          !lstStyleOff.has(paragraph.level)
        ) {
          const bullet = BULLET_MARKUP[kind];
          const pPr = paragraph.pPr;
          if (!pPr) {
            inserts.push({
              at: paragraph.insertAt,
              text: `<a:pPr>${bullet}</a:pPr>`,
            });
          } else if (pPr.selfClosing) {
            inserts.push({
              at: pPr.start,
              replaceTo: pPr.end,
              text: `<a:pPr${pPr.attrs}>${bullet}</a:pPr>`,
            });
          } else {
            inserts.push({ at: pPr.end, text: bullet });
          }
        }
        paragraph = null;
      }
      continue;
    }
    if (!paragraph) continue;
    if (tag.name === "a:pPr") {
      if (tag.kind === "close") {
        inPPr = false;
        continue;
      }
      const selfClosing = tag.kind === "empty";
      inPPr = !selfClosing;
      const attrs = tag.attrs.replace(/\s*\/$/, "");
      paragraph.pPr = { start: tag.start, end: tag.end, selfClosing, attrs };
      const lvl = Number.parseInt(
        qualifiedAttribute(tag.attrs, "lvl") ?? "0",
        10,
      );
      paragraph.level = Number.isFinite(lvl)
        ? Math.max(0, Math.min(8, lvl))
        : 0;
      continue;
    }
    if (inPPr && tag.kind !== "close" && bulletOf(tag.name)) {
      paragraph.explicit = true;
      continue;
    }
    if (tag.name === "a:t" && tag.kind === "open") paragraph.hasText = true;
  }

  if (inserts.length === 0) return slideXml;
  inserts.sort((a, b) => a.at - b.at);
  let out = "";
  let cursor = 0;
  for (const insert of inserts) {
    out += slideXml.slice(cursor, insert.at) + insert.text;
    cursor = insert.replaceTo ?? insert.at;
  }
  return out + slideXml.slice(cursor);
}
