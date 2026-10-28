import { headingId, splitPending } from "./legal-markdown";

// Minimal mdast shapes: only the fields these plugins read or write.
type MdNode = {
  type: string;
  value?: string;
  depth?: number;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

function textOf(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

// Gives every heading the id the side index links to. In a merged source
// (`anchor` set) the h1 becomes an h2 carrying the anchor itself and the
// other headings move one level down, scoped under the anchor.
export function remarkLegalHeadings(options: { anchor?: string }) {
  const { anchor } = options;
  return () => (tree: MdNode) => {
    for (const node of tree.children ?? []) {
      if (node.type !== "heading" || node.depth === undefined) continue;
      const text = textOf(node).trim();
      let id = headingId(text, anchor);
      if (anchor) {
        if (node.depth === 1) id = anchor;
        node.depth = Math.min(node.depth + 1, 6);
      }
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, id },
      };
    }
  };
}

function markPending(node: MdNode): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child): MdNode[] => {
    if (child.type !== "text" || typeof child.value !== "string") {
      markPending(child);
      return [child];
    }
    return splitPending(child.value).map((chunk) =>
      chunk.pending
        ? {
            type: "pendingMark",
            data: {
              hName: "mark",
              hProperties: { "data-pending": "true" },
            },
            children: [{ type: "text", value: chunk.text }],
          }
        : { type: "text", value: chunk.text },
    );
  });
}

// Every `[PENDIENTE: …]` placeholder renders as a <mark data-pending>.
export function remarkPendingMarks() {
  return (tree: MdNode) => markPending(tree);
}
