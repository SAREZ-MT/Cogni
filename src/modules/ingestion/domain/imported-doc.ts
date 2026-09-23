// design.md, "Decision: Tipo ImportedDoc estructural" — the TipTap-
// compatible JSON nodes `textToBlocks` produces. A type alias (not
// `interface`) so `attrs` is assignable to `TiptapNode`'s
// `Record<string, unknown>`: `NotebooksPagesAdapter` passes an
// `ImportedDoc` where `notebooks` expects a `TiptapDoc`, and if the
// shapes ever diverge, `tsc --noEmit` fails at that adapter (design.md's
// decision rationale, not here — this module stays free of any import
// from `notebooks`, per `domain-is-pure`).
export type ImportedText = { type: "text"; text: string };
export type ImportedParagraph = {
  type: "paragraph";
  content: [ImportedText];
};
export type ImportedHeading = {
  type: "heading";
  attrs: { level: 1 | 2 | 3 };
  content: [ImportedText];
};
export type ImportedListItem = {
  type: "listItem";
  content: [ImportedParagraph];
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
export type ImportedBlock =
  | ImportedParagraph
  | ImportedHeading
  | ImportedBulletList
  | ImportedOrderedList;
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
