// Pure AST walk that materializes plain_text from a Tiptap document, with
// no dependency on @tiptap/* or prosemirror-* (design.md, "plain_text como
// recorrido puro de AST en notebooks/domain"). TiptapDoc/TiptapNode are
// defined once in shared/kernel/tiptap-doc.ts (editor/domain needs the same
// shape for its SavePagePort) and re-exported here so every notebooks import
// of them keeps working through this file.
import {
  CATALOGUE_NODES,
  INLINE_NODES,
} from "@/shared/kernel/tiptap-catalogue";
import type { TiptapDoc, TiptapNode } from "@/shared/kernel/tiptap-doc";

export type { TiptapDoc, TiptapNode } from "@/shared/kernel/tiptap-doc";

// Plain text per catalogue node (src/shared/kernel/tiptap-catalogue.ts).
// plain_text feeds search and the AI paragraph split
// (shared/kernel/page-paragraphs.ts: one non-blank line = one paragraph),
// so every block is one or more lines and inline content never breaks a
// line except at a hardBreak. Text read from attrs (latex, mention label,
// caption) has each run of line breaks replaced by one space, so an
// atom never splits its line.
//
// | Node                          | Plain text                                |
// |-------------------------------|-------------------------------------------|
// | text                          | its text                                  |
// | hardBreak                     | "\n"                                      |
// | mention                       | suggestion char + label ("@Tema"); no     |
// |                               | label → nothing (the id is not text)      |
// | emoji                         | ":name:" (the unicode table lives in      |
// |                               | @tiptap/extension-emoji; domain-no-npm)   |
// | inlineMath                    | its latex                                 |
// | blockMath                     | its latex, on its own (single) line       |
// | paragraph, heading,           | its inline content, one line              |
// | detailsSummary, codeBlock     | (codeBlock keeps its own "\n" lines)      |
// | tableRow                      | its cells joined by "\t", one line        |
// | details                       | summary line, then content lines          |
// | callout, blockquote, lists,   | their children's lines                    |
// | taskItem, table, others       | (taskItem: no checkbox glyph)             |
// | image                         | its caption, else nothing (never the alt: |
// |                               | invisible on the page, T9b)               |
// | youtube, horizontalRule,      | nothing                                   |
// | tocBlock                      |                                           |
// | unknown type                  | recurse into its content (never throws);  |
// |                               | among inline siblings it joins their line |
// |                               | instead of starting a new one             |
//
// Documents made only of the pre-catalogue nodes (paragraph, heading,
// lists, table, codeBlock, blockquote, hardBreak) produce byte-identical
// output to the previous implementation, so their paragraph fingerprints
// do not change (plain-text.test.ts pins it). Two changes are deliberate:
// an image now writes its caption (the previous implementation wrote
// nothing for it; its alt was written too until document-import T9b), and an unknown node among inline content no
// longer splits the line; pages with either get new paragraph
// fingerprints once, on their next save.
const INLINE_TYPES: ReadonlySet<string> = new Set(INLINE_NODES);
const KNOWN_TYPES: ReadonlySet<string> = new Set(CATALOGUE_NODES);

const NO_CONTRIBUTION: ReadonlySet<string> = new Set([
  "horizontalRule",
  "youtube",
  "tocBlock",
]);

function attr(node: TiptapNode, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : "";
}

// Attr text stays on one line: every run of CR/LF becomes a single space.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

function attrLine(node: TiptapNode, name: string): string {
  return oneLine(attr(node, name));
}

function nodeText(node: TiptapNode): string {
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "hardBreak":
      return "\n";
    case "mention": {
      const label = attrLine(node, "label");
      return label ? (attr(node, "mentionSuggestionChar") || "@") + label : "";
    }
    case "emoji": {
      const name = attr(node, "name");
      return name ? `:${name}:` : "";
    }
    case "inlineMath":
    case "blockMath":
      return attrLine(node, "latex");
    case "image":
      // Caption only (document-import T9b): alt text is never shown on the
      // page, so it must not feed search or the AI; it stays on the node.
      return attrLine(node, "caption");
  }
  if (NO_CONTRIBUTION.has(node.type)) return "";

  const children = node.content ?? [];
  if (children.length === 0) return "";

  const childTexts = children.map(nodeText);

  // tableRow: cells separated by a tab (design.md node table).
  if (node.type === "tableRow") return childTexts.join("\t");

  // A block whose children are all inline nodes (text, hardBreak and the
  // inline atoms of the catalogue) concatenates them directly: they are
  // one line, not sibling blocks. An unknown node among at least one
  // inline sibling is taken as inline too (its own text kept on the line),
  // so a future inline node never splits a paragraph.
  const isInline = (child: TiptapNode) => INLINE_TYPES.has(child.type);
  const isUnknown = (child: TiptapNode) =>
    !isInline(child) && !KNOWN_TYPES.has(child.type);
  if (
    children.some(isInline) &&
    children.every((child) => isInline(child) || isUnknown(child))
  ) {
    return children
      .map((child, index) =>
        isUnknown(child) ? oneLine(childTexts[index]) : childTexts[index],
      )
      .join("");
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
