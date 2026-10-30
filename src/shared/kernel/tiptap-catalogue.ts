// The Tiptap content catalogue: every node, mark and attribute a Cogni page
// may hold, with its nesting rules (odd/tasks/document-import.md, "Content
// catalogue"). It is the contract between producers of page content (the
// importer, future AI or template features) and the editor that renders it:
// a document that passes `findCatalogueViolations` is one the editor can
// load without dropping anything.
//
// Pure data plus a pure walker, with no dependency on @tiptap/* (shared
// kernel, `domain-is-pure`). The names, attrs and defaults were read from
// the editor's real schema (`createEditorExtensions()` in
// editor/ui/tiptap/extensions, Tiptap 3.31.3) and its `getJSON()` output,
// which includes default attrs such as `textAlign: null`, so null is
// accepted wherever the editor emits it.
//
// The editor imports its palette, callout kinds and global-attr node lists
// from here, and editor/ui/tiptap/extensions/catalogue-parity.test.ts
// proves the editor schema declares exactly these nodes, marks and attrs
// (the sample document lives in ./testing/catalogue-sample-doc.ts).

// The 7 pastel palette names (the editor's highlight mark, text colours and
// node backgrounds all use this list).
export const PALETTE_COLORS = [
  "pink",
  "green",
  "yellow",
  "purple",
  "orange",
  "blue",
  "mint",
] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

// H7 (editor polish round 2): the textStyle `fontFamily` / `fontSize`
// values the editor's "Texto" menu writes. Families are CSS font stacks
// (globals.css maps Inter, Bitter and JetBrains Mono to the self-hosted
// next/font faces); sizes are the non-default steps (Normal = no size).
// Imported content may carry other values within the textStyle checks.
export const EDITOR_FONT_FAMILIES = [
  "Inter, sans-serif",
  "Bitter, serif",
  "JetBrains Mono, monospace",
  "Arial, Helvetica, sans-serif",
  "Times New Roman, Times, serif",
  "Georgia, serif",
  "Verdana, Geneva, sans-serif",
] as const;
export type EditorFontFamily = (typeof EDITOR_FONT_FAMILIES)[number];

export const EDITOR_FONT_SIZES = ["14px", "18px", "22px", "28px"] as const;
export type EditorFontSize = (typeof EDITOR_FONT_SIZES)[number];

export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

// image-node.tsx ImageAlign; default "center".
export const IMAGE_ALIGNS = ["left", "center", "right"] as const;
export type ImageAlign = (typeof IMAGE_ALIGNS)[number];

// The editor callout node's kinds; default "idea".
export const CALLOUT_KINDS = ["idea", "note", "warning"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

// orderedList `type` (HTML <ol type>); the editor emits null by default.
export const ORDERED_LIST_TYPES = ["1", "a", "A", "i", "I"] as const;

// Global attributes and the node types that carry them in the editor.
// blockId: the editor's UniqueID `types` (`attributeName: "blockId"`).
// nodeBackground: the editor's NodeBackground global attribute. textAlign:
// the editor's TextAlign `types`.
export const BLOCK_ID_NODES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "image",
  "callout",
  "table",
] as const;
export const NODE_BACKGROUND_NODES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
] as const;
export const TEXT_ALIGN_NODES = ["heading", "paragraph"] as const;

export const BLOCK_NODES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "image",
  "callout",
  "details",
  "blockMath",
  "tocBlock",
  "youtube",
] as const;
export const INLINE_NODES = [
  "text",
  "hardBreak",
  "inlineMath",
  "emoji",
  "mention",
] as const;

export const CATALOGUE_MARKS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "highlight",
  "subscript",
  "superscript",
  "textStyle",
] as const;
export type CatalogueMarkName = (typeof CATALOGUE_MARKS)[number];

// ---------------------------------------------------------------------------
// Attribute checks

type AttrCheck = (value: unknown) => boolean;

const isString = (value: unknown): value is string => typeof value === "string";
const nonEmpty: AttrCheck = (v) => isString(v) && v.trim().length > 0;
const nullable =
  (check: AttrCheck): AttrCheck =>
  (v) =>
    v === null || check(v);
const oneOf =
  (values: readonly unknown[]): AttrCheck =>
  (v) =>
    values.includes(v);
const intAtLeast =
  (min: number): AttrCheck =>
  (v) =>
    Number.isInteger(v) && (v as number) >= min;
const isBool: AttrCheck = (v) => typeof v === "boolean";
const matches =
  (pattern: RegExp): AttrCheck =>
  (v) =>
    isString(v) && pattern.test(v);
const shortString: AttrCheck = (v) => isString(v) && v.length <= 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// http(s) with an authority, or mailto; anything else (javascript:, data:,
// vbscript:, relative URLs) is rejected, matching the editor's
// isAllowedLinkUri (extensions/index.ts).
const SAFE_HREF = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s]+)$/i;
const YOUTUBE_SRC =
  /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/(embed\/|watch\?v=)[\w-]+([?&][\w=&%-]*)?$/;
const PALETTE_VAR = new RegExp(
  `^var\\(--color-pastel-(${PALETTE_COLORS.join("|")})(-fg)?\\)$`,
);
const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;

// textStyle colours: hex, rgb()/rgba(), a palette name, or the palette CSS
// variable the editor's color picker writes (block-color-palette.ts
// TEXT_COLOR_VALUES, e.g. `var(--color-pastel-purple-fg)`).
const isColor: AttrCheck = (v) =>
  isString(v) &&
  (HEX_COLOR.test(v) ||
    RGB_COLOR.test(v) ||
    PALETTE_VAR.test(v) ||
    (PALETTE_COLORS as readonly string[]).includes(v));
const palette = oneOf(PALETTE_COLORS);
const blockIdCheck = nullable(matches(/^[\w-]{1,64}$/));

// ---------------------------------------------------------------------------
// Node specs

// A content rule is a sequence of parts, matched greedily in order; each
// part takes between `min` and `max` consecutive children whose type is in
// `of`. An empty rule means a leaf (no children allowed).
type ContentPart = { of: readonly string[]; min: number; max?: number };
type ContentRule = readonly ContentPart[];

interface NodeSpec {
  attrs: Record<string, AttrCheck>;
  required?: readonly string[];
  content: ContentRule;
  inline?: boolean;
  // false: inline children may not carry marks (codeBlock, detailsSummary).
  marks?: boolean;
}

const LEAF: ContentRule = [];
const BLOCKS_1: ContentRule = [{ of: BLOCK_NODES, min: 1 }];
const INLINE_0: ContentRule = [{ of: INLINE_NODES, min: 0 }];
const ITEM: ContentRule = [
  { of: ["paragraph"], min: 1, max: 1 },
  { of: BLOCK_NODES, min: 0 },
];
const cellAttrs: Record<string, AttrCheck> = {
  colspan: intAtLeast(1),
  rowspan: intAtLeast(1),
  colwidth: (v) =>
    v === null || (Array.isArray(v) && v.every((w) => intAtLeast(0)(w))),
  align: nullable(oneOf(["left", "center", "right"])),
};

const BASE_SPECS: Record<string, NodeSpec> = {
  doc: { attrs: {}, content: BLOCKS_1 },
  paragraph: { attrs: {}, content: INLINE_0 },
  text: { attrs: {}, content: LEAF, inline: true },
  heading: {
    attrs: {
      level: oneOf(HEADING_LEVELS),
      // TableOfContents' own global attrs on headings.
      id: nullable(shortString),
      "data-toc-id": nullable(shortString),
    },
    required: ["level"],
    content: INLINE_0,
  },
  blockquote: { attrs: {}, content: BLOCKS_1 },
  codeBlock: {
    attrs: { language: nullable(matches(/^[\w+#.-]{1,32}$/)) },
    content: [{ of: ["text"], min: 0 }],
    marks: false,
  },
  horizontalRule: { attrs: {}, content: LEAF },
  hardBreak: { attrs: {}, content: LEAF, inline: true },
  bulletList: { attrs: {}, content: [{ of: ["listItem"], min: 1 }] },
  orderedList: {
    attrs: {
      // Tiptap accepts 0 (a list numbered from zero).
      start: intAtLeast(0),
      type: nullable(oneOf(ORDERED_LIST_TYPES)),
    },
    content: [{ of: ["listItem"], min: 1 }],
  },
  listItem: { attrs: {}, content: ITEM },
  taskList: { attrs: {}, content: [{ of: ["taskItem"], min: 1 }] },
  taskItem: { attrs: { checked: isBool }, content: ITEM },
  table: { attrs: {}, content: [{ of: ["tableRow"], min: 1 }] },
  tableRow: {
    attrs: {},
    content: [{ of: ["tableHeader", "tableCell"], min: 1 }],
  },
  tableHeader: { attrs: cellAttrs, content: BLOCKS_1 },
  tableCell: { attrs: cellAttrs, content: BLOCKS_1 },
  image: {
    attrs: {
      assetId: nullable(matches(UUID)),
      // Client-side upload state (image-upload-node.tsx); null once stored.
      pendingId: nullable(nonEmpty),
      align: oneOf(IMAGE_ALIGNS),
      caption: nullable(shortString),
      alt: nullable(shortString),
    },
    content: LEAF,
  },
  callout: { attrs: { kind: oneOf(CALLOUT_KINDS) }, content: BLOCKS_1 },
  // @tiptap/extension-details: `open` exists only with `persist: true`,
  // which the editor sets so a collapsed/expanded state survives a save.
  details: {
    attrs: { open: isBool },
    content: [
      { of: ["detailsSummary"], min: 1, max: 1 },
      { of: ["detailsContent"], min: 1, max: 1 },
    ],
  },
  detailsSummary: {
    attrs: {},
    content: [{ of: ["text"], min: 0 }],
    marks: false,
  },
  detailsContent: { attrs: {}, content: BLOCKS_1 },
  blockMath: { attrs: { latex: nonEmpty }, required: ["latex"], content: LEAF },
  inlineMath: {
    attrs: { latex: nonEmpty },
    required: ["latex"],
    content: LEAF,
    inline: true,
  },
  emoji: {
    attrs: { name: matches(/^[\w+-]{1,64}$/) },
    required: ["name"],
    content: LEAF,
    inline: true,
  },
  // mention-node.tsx CogniMention: the stock Mention attrs plus notebookId.
  mention: {
    attrs: {
      id: nonEmpty,
      label: nullable(shortString),
      mentionSuggestionChar: nullable(oneOf(["@"])),
      notebookId: nullable(nonEmpty),
    },
    required: ["id"],
    content: LEAF,
    inline: true,
  },
  tocBlock: { attrs: {}, content: LEAF },
  // @tiptap/extension-youtube attrs (defaults: start 0, width 640, height
  // 480). The src is a youtube.com watch URL or a youtube.com /
  // youtube-nocookie.com embed URL; the editor always renders the iframe
  // from youtube-nocookie.com, the only CSP `frame-src` origin. `start` is
  // in seconds.
  youtube: {
    attrs: {
      src: matches(YOUTUBE_SRC),
      width: intAtLeast(1),
      height: intAtLeast(1),
      start: intAtLeast(0),
    },
    required: ["src"],
    content: LEAF,
  },
};

function withGlobalAttrs(name: string, spec: NodeSpec): NodeSpec {
  const attrs = { ...spec.attrs };
  if ((BLOCK_ID_NODES as readonly string[]).includes(name)) {
    attrs.blockId = blockIdCheck;
  }
  if ((NODE_BACKGROUND_NODES as readonly string[]).includes(name)) {
    attrs.nodeBackground = nullable(palette);
  }
  if ((TEXT_ALIGN_NODES as readonly string[]).includes(name)) {
    attrs.textAlign = nullable(oneOf(TEXT_ALIGNS));
  }
  return { ...spec, attrs };
}

const NODE_SPECS: Record<string, NodeSpec> = Object.fromEntries(
  Object.entries(BASE_SPECS).map(([name, spec]) => [
    name,
    withGlobalAttrs(name, spec),
  ]),
);

export const CATALOGUE_NODES = Object.keys(BASE_SPECS) as readonly string[];

// Attr names per node, global attrs included: what the editor schema must
// declare for that node (catalogue-parity.test.ts).
export const CATALOGUE_NODE_ATTRS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(NODE_SPECS).map(([name, spec]) => [
      name,
      Object.keys(spec.attrs),
    ]),
  );

interface MarkSpec {
  attrs: Record<string, AttrCheck>;
  required?: readonly string[];
}

const MARK_SPECS: Record<CatalogueMarkName, MarkSpec> = {
  bold: { attrs: {} },
  italic: { attrs: {} },
  underline: { attrs: {} },
  strike: { attrs: {} },
  code: { attrs: {} },
  subscript: { attrs: {} },
  superscript: { attrs: {} },
  // The editor's Link adds target="_blank" rel="noopener noreferrer" and
  // emits class/title as null.
  link: {
    attrs: {
      href: matches(SAFE_HREF),
      target: nullable(oneOf(["_blank"])),
      rel: nullable(shortString),
      class: nullable(shortString),
      title: nullable(shortString),
    },
    required: ["href"],
  },
  highlight: { attrs: { color: nullable(palette) } },
  textStyle: {
    attrs: {
      color: nullable(isColor),
      backgroundColor: nullable(isColor),
      fontFamily: nullable(matches(/^[\w\s,"'-]{1,100}$/)),
      fontSize: nullable(matches(/^\d+(\.\d+)?(px|pt|rem|em)$/)),
      lineHeight: nullable(matches(/^\d+(\.\d+)?(px|pt|rem|em|%)?$/)),
    },
  },
};

// Attr names per mark, the mark counterpart of CATALOGUE_NODE_ATTRS.
export const CATALOGUE_MARK_ATTRS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(MARK_SPECS).map(([name, spec]) => [
      name,
      Object.keys(spec.attrs),
    ]),
  );

// ---------------------------------------------------------------------------
// Walker

export type CataloguePath = Array<string | number>;
export interface CatalogueViolation {
  path: CataloguePath;
  message: string;
}

const NODE_KEYS = new Set(["type", "attrs", "content", "text", "marks"]);
const MARK_KEYS = new Set(["type", "attrs"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeOf(value: unknown): string {
  return isRecord(value) && isString(value.type) ? value.type : "?";
}

function checkAttrs(
  attrs: unknown,
  spec: { attrs: Record<string, AttrCheck>; required?: readonly string[] },
  owner: string,
  path: CataloguePath,
  out: CatalogueViolation[],
): void {
  if (attrs !== undefined && !isRecord(attrs)) {
    out.push({ path, message: `${owner}: attrs must be an object` });
    return;
  }
  const record = attrs ?? {};
  for (const [key, value] of Object.entries(record)) {
    const check = spec.attrs[key];
    if (!check) {
      out.push({ path, message: `${owner}: unknown attr "${key}"` });
    } else if (!check(value)) {
      out.push({ path, message: `${owner}: invalid attr "${key}"` });
    }
  }
  for (const key of spec.required ?? []) {
    if (record[key] === undefined) {
      out.push({ path, message: `${owner}: missing attr "${key}"` });
    }
  }
}

function checkMarks(
  marks: unknown,
  path: CataloguePath,
  out: CatalogueViolation[],
): void {
  if (!Array.isArray(marks)) {
    out.push({ path, message: "marks must be an array" });
    return;
  }
  const seen = new Set<string>();
  marks.forEach((mark, index) => {
    const markPath = [...path, index];
    const name = typeOf(mark);
    const spec = MARK_SPECS[name as CatalogueMarkName];
    if (!isRecord(mark) || !spec) {
      out.push({ path: markPath, message: `unknown mark "${name}"` });
      return;
    }
    if (seen.has(name)) {
      out.push({ path: markPath, message: `duplicate mark "${name}"` });
    }
    seen.add(name);
    for (const key of Object.keys(mark)) {
      if (!MARK_KEYS.has(key)) {
        out.push({
          path: markPath,
          message: `mark ${name}: unknown key "${key}"`,
        });
      }
    }
    checkAttrs(mark.attrs, spec, `mark ${name}`, markPath, out);
  });
}

function checkContent(
  owner: string,
  children: unknown[],
  rule: ContentRule,
  path: CataloguePath,
  out: CatalogueViolation[],
): void {
  let index = 0;
  for (const part of rule) {
    let count = 0;
    while (
      index < children.length &&
      count < (part.max ?? Number.POSITIVE_INFINITY) &&
      part.of.includes(typeOf(children[index]))
    ) {
      index++;
      count++;
    }
    if (count < part.min) {
      out.push({
        path,
        message: `${owner}: expected ${part.of.join("|")} at position ${index}`,
      });
    }
  }
  if (index < children.length) {
    out.push({
      path: [...path, index],
      message: `${owner} does not allow "${typeOf(children[index])}" at position ${index}`,
    });
  }
}

function checkNode(
  node: unknown,
  path: CataloguePath,
  marksAllowed: boolean,
  out: CatalogueViolation[],
): void {
  const name = typeOf(node);
  const spec = NODE_SPECS[name];
  if (!isRecord(node) || !spec || name === "doc") {
    out.push({ path, message: `unknown node "${name}"` });
    return;
  }
  for (const key of Object.keys(node)) {
    if (!NODE_KEYS.has(key)) {
      out.push({ path, message: `${name}: unknown key "${key}"` });
    }
  }
  checkAttrs(node.attrs, spec, name, [...path, "attrs"], out);

  if (name === "text") {
    if (!isString(node.text) || node.text.length === 0) {
      out.push({ path, message: "text node must have non-empty text" });
    }
  } else if (node.text !== undefined) {
    out.push({ path, message: `${name}: only text nodes carry text` });
  }

  if (node.marks !== undefined) {
    if (!spec.inline || !marksAllowed) {
      out.push({ path, message: `${name}: marks are not allowed here` });
    } else {
      checkMarks(node.marks, [...path, "marks"], out);
    }
  }
  checkChildren(name, node.content, spec, path, out);
}

function checkChildren(
  owner: string,
  content: unknown,
  spec: NodeSpec,
  path: CataloguePath,
  out: CatalogueViolation[],
): void {
  if (content !== undefined && !Array.isArray(content)) {
    out.push({ path, message: `${owner}: content must be an array` });
    return;
  }
  const children = (content as unknown[] | undefined) ?? [];
  const contentPath = [...path, "content"];
  checkContent(owner, children, spec.content, contentPath, out);
  children.forEach((child, index) => {
    checkNode(child, [...contentPath, index], spec.marks !== false, out);
  });
}

// Every way `value` departs from the catalogue, empty when it conforms.
// Paths are relative to `value` (e.g. ["content", 1, "marks", 0]).
export function findCatalogueViolations(value: unknown): CatalogueViolation[] {
  const out: CatalogueViolation[] = [];
  if (!isRecord(value) || value.type !== "doc") {
    return [{ path: [], message: "root must be a doc node" }];
  }
  for (const key of Object.keys(value)) {
    if (key !== "type" && key !== "content") {
      out.push({ path: [], message: `doc: unknown key "${key}"` });
    }
  }
  checkChildren("doc", value.content, NODE_SPECS.doc, [], out);
  return out;
}

// Same check for one top-level block, used where the doc-level "at least
// one block" rule is owned elsewhere (writeImportedContent invariant 2).
export function findBlockViolations(
  block: unknown,
  path: CataloguePath,
): CatalogueViolation[] {
  const out: CatalogueViolation[] = [];
  const name = typeOf(block);
  if (!(BLOCK_NODES as readonly string[]).includes(name)) {
    out.push({ path, message: `doc does not allow "${name}"` });
  }
  checkNode(block, path, true, out);
  return out;
}
