import type {
  CalloutKind,
  HeadingLevel,
  ImageAlign,
  PaletteColor,
  TextAlign,
} from "@/shared/kernel/tiptap-catalogue";

// design.md, "Decision: Tipo ImportedDoc estructural" — the TipTap-
// compatible JSON nodes `textToBlocks` produces. A type alias (not
// `interface`) so `attrs` is assignable to `TiptapNode`'s
// `Record<string, unknown>`: `NotebooksPagesAdapter` passes an
// `ImportedDoc` where `notebooks` expects a `TiptapDoc`, and if the
// shapes ever diverge, `tsc --noEmit` fails at that adapter (design.md's
// decision rationale, not here — this module stays free of any import
// from `notebooks`, per `domain-is-pure`).
//
// T2 (odd/tasks/document-import.md): widened to the whole content catalogue
// (shared/kernel/tiptap-catalogue.ts) so the per-format mappers can emit
// every block the editor renders; writeImportedContent validates the result
// against the same catalogue. Global attrs the importer never sets
// (blockId) are left out on purpose: the editor assigns them on load.
type Nullable<T> = T | null;
type AlignAttrs = {
  textAlign?: Nullable<TextAlign>;
  nodeBackground?: Nullable<PaletteColor>;
};

export type ImportedMark =
  | {
      type:
        | "bold"
        | "italic"
        | "underline"
        | "strike"
        | "code"
        | "subscript"
        | "superscript";
    }
  // href: http, https or mailto only (the catalogue rejects anything else).
  | {
      type: "link";
      attrs: { href: string; target?: Nullable<"_blank">; rel?: string | null };
    }
  | { type: "highlight"; attrs: { color: PaletteColor } }
  | {
      type: "textStyle";
      attrs: {
        color?: string | null;
        backgroundColor?: string | null;
        fontFamily?: string | null;
        fontSize?: string | null;
        lineHeight?: string | null;
      };
    };

export type ImportedText = {
  type: "text";
  text: string;
  marks?: ImportedMark[];
};
export type ImportedInline =
  | ImportedText
  | { type: "hardBreak" }
  | { type: "inlineMath"; attrs: { latex: string } }
  | { type: "emoji"; attrs: { name: string } }
  | {
      type: "mention";
      attrs: { id: string; label?: string | null; notebookId?: string | null };
    };

export type ImportedParagraph = {
  type: "paragraph";
  attrs?: AlignAttrs;
  content?: ImportedInline[];
};
export type ImportedHeading = {
  type: "heading";
  attrs: { level: HeadingLevel } & AlignAttrs;
  content?: ImportedInline[];
};
// listItem/taskItem: a paragraph first, then any blocks (nested lists).
export type ImportedListItem = {
  type: "listItem";
  content: [ImportedParagraph, ...ImportedBlock[]];
};
export type ImportedBulletList = {
  type: "bulletList";
  content: ImportedListItem[];
};
// attrs.start is present only when the first item number is not 1 (spec
// rule 4).
export type ImportedOrderedList = {
  type: "orderedList";
  attrs?: { start: number };
  content: ImportedListItem[];
};
export type ImportedTaskItem = {
  type: "taskItem";
  attrs: { checked: boolean };
  content: [ImportedParagraph, ...ImportedBlock[]];
};
export type ImportedTaskList = {
  type: "taskList";
  content: ImportedTaskItem[];
};
export type ImportedTableCell = {
  type: "tableHeader" | "tableCell";
  attrs?: { colspan?: number; rowspan?: number; colwidth?: number[] | null };
  content: ImportedBlock[];
};
export type ImportedTableRow = {
  type: "tableRow";
  content: ImportedTableCell[];
};
export type ImportedTable = { type: "table"; content: ImportedTableRow[] };
export type ImportedDetails = {
  type: "details";
  attrs?: { open: boolean };
  content: [
    { type: "detailsSummary"; content?: ImportedText[] },
    { type: "detailsContent"; content: ImportedBlock[] },
  ];
};

export type ImportedBlock =
  | ImportedParagraph
  | ImportedHeading
  | ImportedBulletList
  | ImportedOrderedList
  | ImportedTaskList
  | ImportedTable
  | ImportedDetails
  | { type: "blockquote"; content: ImportedBlock[] }
  | {
      type: "callout";
      attrs: { kind: CalloutKind };
      content: ImportedBlock[];
    }
  | {
      type: "codeBlock";
      attrs?: { language: string | null };
      content?: ImportedText[];
    }
  | { type: "horizontalRule" }
  | {
      type: "image";
      // assetId: a page_assets row id (T9); align defaults to "center".
      // pendingId (document-import T5): an ExtractedImage key
      // (document-extractor.ts) for an image not uploaded yet. Ingestion-
      // internal: T9 replaces it with assetId before writing, since
      // notebooks' strict content schema does not accept it.
      attrs: {
        assetId: string | null;
        pendingId?: string;
        align?: ImageAlign;
        caption?: string | null;
        alt?: string | null;
      };
    }
  | { type: "blockMath"; attrs: { latex: string } }
  | { type: "tocBlock" }
  | {
      type: "youtube";
      attrs: { src: string; width?: number; height?: number; start?: number };
    };
export type ImportedDoc = { type: "doc"; content: ImportedBlock[] };

// Builders keep `text-to-blocks.ts`'s block-assembly code free of literal
// TipTap node shapes. R10 ("nunca se emiten nodos de texto vacíos ni
// bloques sin contenido") is the caller's responsibility: these builders
// never receive empty text or an empty item list from `text-to-blocks.ts`.
export function importedText(text: string): ImportedText {
  return { type: "text", text };
}

export function importedParagraph(text: string): ImportedParagraph {
  return { type: "paragraph", content: [importedText(text)] };
}

export function importedHeading(
  level: 1 | 2 | 3,
  text: string,
): ImportedHeading {
  return { type: "heading", attrs: { level }, content: [importedText(text)] };
}

export function importedListItem(text: string): ImportedListItem {
  return { type: "listItem", content: [importedParagraph(text)] };
}

export function importedBulletList(items: string[]): ImportedBulletList {
  return { type: "bulletList", content: items.map(importedListItem) };
}

export function importedOrderedList(
  items: string[],
  start?: number,
): ImportedOrderedList {
  const content = items.map(importedListItem);
  if (start != null && start !== 1) {
    return { type: "orderedList", attrs: { start }, content };
  }
  return { type: "orderedList", content };
}

type AnyImportedNode = {
  type: string;
  text?: string;
  attrs?: object;
  content?: readonly unknown[];
};

function hasNonWhitespace(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// Text a reader would see: text runs, LaTeX of math nodes and mention
// labels, at any depth (tables, details, callouts, nested lists, code).
// Images, rules, emoji and the TOC carry no text of their own.
function nodeHasText(node: AnyImportedNode): boolean {
  if (node.type === "text") return hasNonWhitespace(node.text);
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  if (node.type === "inlineMath" || node.type === "blockMath") {
    return hasNonWhitespace(attrs.latex);
  }
  if (node.type === "mention") return hasNonWhitespace(attrs.label);
  return (node.content ?? []).some((child) =>
    nodeHasText(child as AnyImportedNode),
  );
}

// T4 follow-up: a small domain predicate `processImportJob` (T6) uses to
// reject an extracted doc whose blocks carry no real text — only empty
// paragraphs, or blocks that R10 would never actually emit — *before*
// calling `NotebookPagesPort.writeImportedContent` (review follow-up
// R3-empty-invariant-shallow; `textToBlocks`'s own `pagesWithoutText ===
// pageCount` already covers the "no page had text" case, this covers the
// deeper "no block anywhere has text" one). Recursive since T2: every
// catalogue block may nest text.
export function hasTextContent(doc: ImportedDoc): boolean {
  return doc.content.some(nodeHasText);
}
