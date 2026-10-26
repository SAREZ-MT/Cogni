// document-import T6: what officeparser reads from a DOCX that mammoth
// drops — run colours and shading, the list counters (ordered `start`) and
// the OMML equations as LaTeX — collected per paragraph, plus the alignment
// that pairs each mammoth paragraph with its officeparser paragraph.
//
// Both libraries walk the same `w:p` elements in document order (body,
// then table cells row by row), so the two paragraph sequences line up
// except where one engine merges or drops a paragraph (officeparser keeps
// the empty paragraph of a vertically merged continuation cell, mammoth
// drops that cell). `alignEnrichments` therefore pairs by equal text with
// a short lookahead instead of by index, and a paragraph with no partner
// is mapped from mammoth alone.

// The subset of officeparser's OfficeContentNode the mapper reads. The
// library's own union type is much wider; this keeps the adapter readable
// and fails soft (an unexpected shape just yields no enrichment).
export type OfficeParserNode = {
  type: string;
  text?: string;
  children?: OfficeParserNode[];
  metadata?: Record<string, unknown>;
  formatting?: { color?: unknown; backgroundColor?: unknown };
};

export type ColorSpan = {
  start: number;
  end: number;
  color: string | null;
  backgroundColor: string | null;
};

export type MathSpan = { offset: number; latex: string };

export type ListCounter = { listId: string; level: number; itemIndex: number };

export type ParagraphEnrichment = {
  // Text of the paragraph's text runs (tabs included, line breaks and
  // equations excluded): the coordinate system of `colors` and `math`.
  text: string;
  colors: ColorSpan[];
  math: MathSpan[];
  list: ListCounter | null;
};

const PARAGRAPH_TYPES = new Set(["paragraph", "heading", "list"]);
const LOOKAHEAD = 8;
// Empty paragraphs are common and alike: an empty mammoth paragraph only
// pairs with a nearby one, so it never drags the cursor far ahead.
const EMPTY_LOOKAHEAD = 2;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function listCounter(node: OfficeParserNode): ListCounter | null {
  if (node.type !== "list") return null;
  const metadata = node.metadata ?? {};
  const { listId, indentation, itemIndex } = metadata;
  if (typeof indentation !== "number" || typeof itemIndex !== "number") {
    return null;
  }
  return {
    listId: typeof listId === "string" ? listId : "",
    level: indentation,
    itemIndex,
  };
}

function paragraphEnrichment(node: OfficeParserNode): ParagraphEnrichment {
  const enrichment: ParagraphEnrichment = {
    text: "",
    colors: [],
    math: [],
    list: listCounter(node),
  };
  const visit = (child: OfficeParserNode) => {
    if (child.type === "text") {
      const text = child.text ?? "";
      const start = enrichment.text.length;
      enrichment.text += text;
      const color = stringOrNull(child.formatting?.color);
      const backgroundColor = stringOrNull(child.formatting?.backgroundColor);
      if (text.length > 0 && (color || backgroundColor)) {
        enrichment.colors.push({
          start,
          end: start + text.length,
          color,
          backgroundColor,
        });
      }
      return;
    }
    if (child.type === "code" && child.metadata?.math) {
      const latex = stringOrNull(child.text);
      if (latex) {
        enrichment.math.push({ offset: enrichment.text.length, latex });
      }
      return;
    }
    // A paragraph lifted out of a text box or drawing is its own unit in
    // officeparser's order, not part of this paragraph's text.
    if (PARAGRAPH_TYPES.has(child.type)) return;
    for (const grandchild of child.children ?? []) visit(grandchild);
  };
  for (const child of node.children ?? []) visit(child);
  return enrichment;
}

// Every paragraph officeparser read, in document order (table cells
// included, depth first), as mammoth walks them.
export function collectEnrichments(
  content: readonly OfficeParserNode[],
): ParagraphEnrichment[] {
  const out: ParagraphEnrichment[] = [];
  const visit = (node: OfficeParserNode) => {
    if (PARAGRAPH_TYPES.has(node.type)) {
      out.push(paragraphEnrichment(node));
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of content) visit(node);
  return out;
}

// Pairs each mammoth paragraph text with the enrichment of the same text,
// searching at most LOOKAHEAD officeparser paragraphs past the last match.
// A paragraph whose text officeparser reads differently gets null (its
// marks still come from mammoth; only colour, start and math are lost).
export function alignEnrichments(
  texts: readonly string[],
  enrichments: readonly ParagraphEnrichment[],
): Array<ParagraphEnrichment | null> {
  let next = 0;
  return texts.map((text) => {
    const window = text.length > 0 ? LOOKAHEAD : EMPTY_LOOKAHEAD;
    const limit = Math.min(enrichments.length, next + window);
    for (let index = next; index < limit; index++) {
      if (enrichments[index].text === text) {
        next = index + 1;
        return enrichments[index];
      }
    }
    return null;
  });
}
