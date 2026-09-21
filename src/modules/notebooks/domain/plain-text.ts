// Pure AST walk that materializes plain_text from a Tiptap document, with
// no dependency on @tiptap/* or prosemirror-* (design.md, "plain_text como
// recorrido puro de AST en notebooks/domain"). TiptapDoc/TiptapNode are the
// only local shape this module needs; save-page-port.ts re-exports them so
// the rest of the module shares one definition instead of duplicating it.

export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TiptapDoc {
  type: "doc";
  content?: TiptapNode[];
}

// Node types that never contribute text, regardless of their content
// (design.md node table: "image, horizontalRule -> ninguna").
const NO_CONTRIBUTION = new Set(["image", "horizontalRule"]);

// Inline leaf types: siblings of this kind concatenate directly (no
// separator) inside their parent block, instead of being treated as
// sibling blocks separated by a newline.
function isInlineType(type: string): boolean {
  return type === "text" || type === "hardBreak";
}

function nodeText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (NO_CONTRIBUTION.has(node.type)) return "";

  const children = node.content ?? [];
  if (children.length === 0) return "";

  const childTexts = children.map(nodeText);

  // tableRow: cells separated by a tab (design.md node table).
  if (node.type === "tableRow") return childTexts.join("\t");

  // A block whose children are all inline leaves (text/hardBreak)
  // concatenates them directly: they are one line, not sibling blocks.
  if (children.every((child) => isInlineType(child.type))) {
    return childTexts.join("");
  }

  // Otherwise children are sibling blocks (headings, paragraphs, list
  // items, table rows, ...): join with a newline, dropping empty
  // contributions (e.g. an image or a divisor between two paragraphs).
  return childTexts.filter((childText) => childText.length > 0).join("\n");
}

export function extractPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc?.content) return "";
  return doc.content
    .map(nodeText)
    .filter((blockText) => blockText.length > 0)
    .join("\n");
}
